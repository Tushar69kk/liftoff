import { dirname } from "path";
import type { Migrator, Step, MigrationContext, ValidationResult, StepResult, TimeEstimate } from "../types";

export const composeCopyMigrator: Migrator = {
  type: "compose_copy",

  async validate(step: Step, context: MigrationContext): Promise<ValidationResult> {
    const errors: string[] = [];
    if (!context.plan.source.compose_file) {
      errors.push("No compose file path in plan");
    }
    if (!context.plan.target.compose_dir) {
      errors.push("No target directory in plan");
    }
    return { valid: errors.length === 0, errors, warnings: [] };
  },

  async execute(step: Step, context: MigrationContext): Promise<StepResult> {
    const start = Date.now();
    const composePath = context.plan.source.compose_file!;
    const targetDir = context.plan.target.compose_dir!;
    const composeFileName = composePath.split("/").pop()!;

    // Create target directory
    await context.target.exec(`mkdir -p ${targetDir}`);

    // Copy compose file
    context.onLog(`Copying ${composeFileName} to target`);
    const composeContent = await context.source.readFile(composePath);
    await context.target.writeFile(`${targetDir}/${composeFileName}`, composeContent);

    // Try to copy .env file if it exists
    const sourceDir = dirname(composePath);
    try {
      const envContent = await context.source.readFile(`${sourceDir}/.env`);
      await context.target.writeFile(`${targetDir}/.env`, envContent);
      context.onLog("Copied .env file");
    } catch {
      context.onLog("No .env file found (skipping)");
    }

    return { success: true, duration: Date.now() - start };
  },

  async estimate(): Promise<TimeEstimate> {
    return { seconds: 5, description: "~5 sec" };
  },
};
