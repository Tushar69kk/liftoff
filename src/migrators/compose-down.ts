import type {
  MigrationContext,
  Migrator,
  Step,
  StepResult,
  TimeEstimate,
  ValidationResult,
} from "../types";

export const composeDownMigrator: Migrator = {
  type: "compose_down",

  async validate(_step: Step, context: MigrationContext): Promise<ValidationResult> {
    const errors: string[] = [];
    if (!context.plan.source.compose_file) {
      errors.push("No compose file path in plan");
    }
    return { valid: errors.length === 0, errors, warnings: [] };
  },

  async execute(_step: Step, context: MigrationContext): Promise<StepResult> {
    const start = Date.now();
    const composePath = context.plan.source.compose_file!;

    context.onLog("Stopping source stack...");
    const result = await context.source.exec(`docker compose -f ${composePath} down`);

    if (result.code !== 0) {
      return {
        success: false,
        error: `docker compose down failed: ${result.stderr}`,
        duration: Date.now() - start,
      };
    }

    context.onLog("Source stack stopped");
    return { success: true, duration: Date.now() - start };
  },

  async estimate(): Promise<TimeEstimate> {
    return { seconds: 30, description: "~30 sec" };
  },
};
