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

    // Get all volumes from services in the plan
    const volumeMounts = context.plan.services.flatMap((s) => s.volumes);
    const volumeNames = [
      ...new Set(
        volumeMounts
          .map((v) => v.split(":")[0])
          .filter((v) => !v.startsWith("/") && !v.startsWith(".")),
      ),
    ];

    for (const volName of volumeNames) {
      // Get volume mountpoint on source
      const inspectResult = await context.source.exec(
        `docker volume inspect ${volName} --format '{{.Mountpoint}}'`,
      );
      if (inspectResult.code !== 0) {
        return {
          success: false,
          error: `Could not inspect volume ${volName}: ${inspectResult.stderr}`,
          duration: Date.now() - start,
        };
      }

      const sourcePath = inspectResult.stdout.trim();
      const targetHost = context.plan.target.host;

      context.onLog(`Syncing volume ${volName}: ${sourcePath}`);

      // Run rsync from source to target
      const rsyncCmd = [
        "rsync",
        "-azP",
        "--delete",
        `${sourcePath}/`,
        `${targetHost}:${sourcePath}/`,
      ].join(" ");

      const rsyncResult = await context.source.execStream(rsyncCmd, (chunk) => {
        // Parse rsync progress output
        const percentMatch = chunk.match(/(\d+)%/);
        if (percentMatch) {
          context.onProgress({
            stepIndex: 0,
            percent: parseInt(percentMatch[1], 10),
            message: `Syncing ${volName}`,
          });
        }
      });

      if (rsyncResult.code !== 0) {
        return {
          success: false,
          error: `rsync failed for ${volName}: ${rsyncResult.stderr}`,
          duration: Date.now() - start,
        };
      }

      context.onLog(`Volume ${volName} synced`);
    }

    return { success: true, duration: Date.now() - start };
  },

  async estimate(_step: Step, context: MigrationContext): Promise<TimeEstimate> {
    const totalBytes = context.plan.services.flatMap((s) => s.volumes).length * 1000000000; // rough estimate
    const seconds = Math.max(30, Math.ceil(totalBytes / (10 * 1024 * 1024))); // assume 10MB/s
    return { seconds, description: `~${Math.ceil(seconds / 60)} min` };
  },
};
