import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  MigrationContext,
  Migrator,
  Step,
  StepResult,
  TimeEstimate,
  ValidationResult,
} from "../types";

export const rsyncMigrator: Migrator = {
  type: "rsync",

  async validate(_step: Step, context: MigrationContext): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const sourceCheck = await context.source.exec("which rsync");
    if (sourceCheck.code !== 0) errors.push("rsync not installed on source server");

    const targetCheck = await context.target.exec("which rsync");
    if (targetCheck.code !== 0)
      warnings.push("rsync not installed on target — will use SFTP relay (slower)");

    return { valid: errors.length === 0, errors, warnings };
  },

  async execute(_step: Step, context: MigrationContext): Promise<StepResult> {
    const start = Date.now();

    const volumes = context.plan.volumes;

    // Clean up any leftover temp files from a previous run
    await context.source.exec("rm -f /tmp/liftoff-vol-*.tar.gz");
    await context.target.exec("rm -f /tmp/liftoff-vol-*.tar.gz");

    if (volumes.length === 0) {
      context.onLog("No volumes to sync");
      return { success: true, duration: Date.now() - start };
    }

    // Test if rsync over SSH works (agent forwarding, passwordless keys, etc.)
    // We do a quick dry-run to avoid prompting for passphrases/host keys mid-migration
    const targetHost = context.plan.target.host;
    const rsyncSshOpts = "ssh -o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=5";
    const rsyncTestResult = await context.source.exec(
      `rsync --dry-run -e "${rsyncSshOpts}" /dev/null ${targetHost}:/dev/null 2>&1`,
    );
    const useRsync = rsyncTestResult.code === 0;

    if (useRsync) {
      context.onLog("Using rsync for volume sync (fast delta transfer)");
    } else {
      context.onLog("rsync over SSH not available — using SFTP relay");
    }

    for (let vi = 0; vi < volumes.length; vi++) {
      const vol = volumes[vi];
      const sourcePath = vol.mountpoint;

      context.onLog(`Syncing volume ${vol.name} (${vi + 1}/${volumes.length}): ${sourcePath}`);

      // Resolve target mountpoint
      const targetMountResult = await context.target.exec(
        `docker volume inspect ${vol.name} --format '{{.Mountpoint}}'`,
      );
      const targetPath =
        targetMountResult.code === 0 && targetMountResult.stdout.trim()
          ? targetMountResult.stdout.trim()
          : sourcePath;

      if (useRsync) {
        // Fast path: rsync directly from source to target
        const rsyncCmd = [
          "rsync",
          "-azP",
          "--delete",
          `-e "${rsyncSshOpts}"`,
          `${sourcePath}/`,
          `${targetHost}:${targetPath}/`,
        ].join(" ");

        const rsyncResult = await context.source.execStream(rsyncCmd, (chunk) => {
          const percentMatch = chunk.match(/(\d+)%/);
          if (percentMatch) {
            context.onProgress({
              stepIndex: 0,
              percent: Math.round(
                ((vi + Number.parseInt(percentMatch[1], 10) / 100) / volumes.length) * 100,
              ),
              message: `Syncing ${vol.name}`,
            });
          }
        });

        if (rsyncResult.code !== 0) {
          // rsync failed mid-run — fall through to SFTP for this volume
          context.onLog(`  rsync failed for ${vol.name}, falling back to SFTP relay...`);
          await syncViaSftp(vol.name, sourcePath, targetPath, context, vi, volumes.length, start);
        } else {
          context.onLog(`  Volume ${vol.name} synced via rsync`);
        }
      } else {
        // Slow path: tar + SFTP relay
        const result = await syncViaSftp(
          vol.name,
          sourcePath,
          targetPath,
          context,
          vi,
          volumes.length,
          start,
        );
        if (!result.success) return result;
      }

      context.onProgress({
        stepIndex: 0,
        percent: Math.round(((vi + 1) / volumes.length) * 100),
        message: `Volume ${vol.name} synced`,
      });
    }

    return { success: true, duration: Date.now() - start };
  },

  async estimate(_step: Step, context: MigrationContext): Promise<TimeEstimate> {
    const totalBytes = context.plan.volumes.reduce((sum, v) => sum + v.sizeBytes, 0);
    const seconds = Math.max(30, Math.ceil(totalBytes / (10 * 1024 * 1024)));
    return { seconds, description: `~${Math.ceil(seconds / 60)} min` };
  },
};

/** Fallback: sync a volume via tar archive + SFTP relay through the liftoff process */
async function syncViaSftp(
  volName: string,
  sourcePath: string,
  targetPath: string,
  context: MigrationContext,
  volIndex: number,
  totalVols: number,
  startTime: number,
): Promise<StepResult> {
  const remoteTar = `/tmp/liftoff-vol-${volName}.tar.gz`;
  const localTmp = join(tmpdir(), `liftoff-vol-${volName}.tar.gz`);

  // Archive on source
  context.onLog(`  Archiving ${volName}...`);
  const archiveResult = await context.source.exec(`tar czf ${remoteTar} -C ${sourcePath} .`);
  if (archiveResult.code !== 0) {
    return {
      success: false,
      error: `Failed to archive volume ${volName}: ${archiveResult.stderr}`,
      duration: Date.now() - startTime,
    };
  }

  // Report size
  const sizeResult = await context.source.exec(
    `stat -c%s ${remoteTar} 2>/dev/null || stat -f%z ${remoteTar}`,
  );
  const archiveSize = Number.parseInt(sizeResult.stdout.trim(), 10) || 0;
  context.onLog(`  Transferring ${(archiveSize / 1024 / 1024).toFixed(1)} MB...`);

  // Download from source → upload to target
  await context.source.download(remoteTar, localTmp);

  context.onProgress({
    stepIndex: 0,
    percent: Math.round(((volIndex + 0.5) / totalVols) * 100),
    message: `Uploading ${volName} to target`,
  });

  await context.target.upload(localTmp, remoteTar);

  // Extract on target
  context.onLog(`  Extracting on target...`);
  const extractResult = await context.target.exec(
    `mkdir -p ${targetPath} && tar xzf ${remoteTar} -C ${targetPath}`,
  );
  if (extractResult.code !== 0) {
    return {
      success: false,
      error: `Failed to extract volume ${volName} on target: ${extractResult.stderr}`,
      duration: Date.now() - startTime,
    };
  }

  // Clean up
  await context.source.exec(`rm -f ${remoteTar}`);
  await context.target.exec(`rm -f ${remoteTar}`);
  try {
    const { unlinkSync } = await import("node:fs");
    unlinkSync(localTmp);
  } catch {}

  context.onLog(`  Volume ${volName} synced via SFTP`);
  return { success: true, duration: Date.now() - startTime };
}
