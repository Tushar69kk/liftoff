import type {
  MigrationContext,
  Migrator,
  Step,
  StepResult,
  TimeEstimate,
  ValidationResult,
} from "../types";

/**
 * Runs `docker compose -p <project> create` on target to pre-create volumes/networks
 * without starting any services. This ensures volume mountpoints exist for rsync.
 */
export const composeCreateMigrator: Migrator = {
  type: "compose_create",

  async validate(_step: Step, context: MigrationContext): Promise<ValidationResult> {
    const errors: string[] = [];
    if (!context.plan.target.compose_dir) {
      errors.push("No target directory in plan");
    }
    return { valid: errors.length === 0, errors, warnings: [] };
  },

  async execute(_step: Step, context: MigrationContext): Promise<StepResult> {
    const start = Date.now();
    const targetDir = context.plan.target.compose_dir!;

    context.onLog("Creating volumes and networks on target (without starting services)...");

    const projectFlag = context.plan.source.project_name
      ? ` -p ${context.plan.source.project_name}`
      : "";

    const result = await context.target.exec(
      `cd ${targetDir} && docker compose${projectFlag} create`,
    );

    if (result.code !== 0) {
      // Fallback: try `up --no-start` which is equivalent
      const fallback = await context.target.exec(
        `cd ${targetDir} && docker compose${projectFlag} up --no-start`,
      );
      if (fallback.code !== 0) {
        return {
          success: false,
          error: `docker compose create failed: ${fallback.stderr || result.stderr}`,
          duration: Date.now() - start,
        };
      }
    }

    context.onLog("Volumes and networks created on target");
    return { success: true, duration: Date.now() - start };
  },

  async estimate(): Promise<TimeEstimate> {
    return { seconds: 15, description: "~15 sec" };
  },
};
