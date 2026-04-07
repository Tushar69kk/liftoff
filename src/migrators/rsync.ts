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
    if (targetCheck.code !== 0) errors.push("rsync not installed on target server");

    return { valid: errors.length === 0, errors, warnings };
  },

  async execute(_step: Step, context: MigrationContext): Promise<StepResult> {
    const start = Date.now();

    // Use resolved volumes from the plan instead of re-deriving from service definitions
    const volumes = context.plan.volumes;

    if (volumes.length === 0) {
      context.onLog("No volumes to sync");
      return { success: true, duration: Date.now() - start };
    }

    for (const vol of volumes) {
      const sourcePath = vol.mountpoint;
      const targetHost = context.plan.target.host;

      context.onLog(`Syncing volume ${vol.name}: ${sourcePath}`);

      // Try running rsync locally (works when liftoff is on the source server).
      // The local source.exec runs on the liftoff machine, which can rsync to the target.
      const rsyncCmd = [
        "rsync",
        "-azP",
        "--delete",
        `${sourcePath}/`,
        `${targetHost}:${sourcePath}/`,
      ].join(" ");

      const rsyncResult = await context.source.execStream(rsyncCmd, (chunk) => {
        const percentMatch = chunk.match(/(\d+)%/);
        if (percentMatch) {
          context.onProgress({
            stepIndex: 0,
            percent: parseInt(percentMatch[1], 10),
            message: `Syncing ${vol.name}`,
          });
        }
      });

      if (rsyncResult.code !== 0) {
        // Fallback: relay through the liftoff process using download + upload (SFTP).
        // This works even when source cannot SSH to target directly.
        context.onLog(`Direct rsync failed for ${vol.name}, falling back to SFTP relay...`);

        const localTmp = join(tmpdir(), `liftoff-vol-${vol.name}.tar.gz`);

        // Archive the volume directory on source
        const archiveResult = await context.source.exec(
          `tar czf /tmp/liftoff-vol-${vol.name}.tar.gz -C ${sourcePath} .`,
        );
        if (archiveResult.code !== 0) {
          return {
            success: false,
            error: `Failed to archive volume ${vol.name}: ${archiveResult.stderr}`,
            duration: Date.now() - start,
          };
        }

        // Download archive from source to local temp
        await context.source.download(`/tmp/liftoff-vol-${vol.name}.tar.gz`, localTmp);

        // Upload archive to target
        await context.target.upload(localTmp, `/tmp/liftoff-vol-${vol.name}.tar.gz`);

        // Extract on target
        const extractResult = await context.target.exec(
          `mkdir -p ${sourcePath} && tar xzf /tmp/liftoff-vol-${vol.name}.tar.gz -C ${sourcePath}`,
        );
        if (extractResult.code !== 0) {
          return {
            success: false,
            error: `Failed to extract volume ${vol.name} on target: ${extractResult.stderr}`,
            duration: Date.now() - start,
          };
        }

        // Clean up temp files
        await context.source.exec(`rm -f /tmp/liftoff-vol-${vol.name}.tar.gz`);
        await context.target.exec(`rm -f /tmp/liftoff-vol-${vol.name}.tar.gz`);

        // Clean up local temp file
        try {
          const { unlinkSync } = await import("node:fs");
          unlinkSync(localTmp);
        } catch {
          // ignore cleanup errors
        }
      }

      context.onLog(`Volume ${vol.name} synced`);
    }

    return { success: true, duration: Date.now() - start };
  },

  async estimate(_step: Step, context: MigrationContext): Promise<TimeEstimate> {
    const totalBytes = context.plan.volumes.reduce((sum, v) => sum + v.sizeBytes, 0);
    const seconds = Math.max(30, Math.ceil(totalBytes / (10 * 1024 * 1024))); // assume 10MB/s
    return { seconds, description: `~${Math.ceil(seconds / 60)} min` };
  },
};
