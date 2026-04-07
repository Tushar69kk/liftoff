import type {
  MigrationContext,
  Migrator,
  Step,
  StepResult,
  TimeEstimate,
  ValidationResult,
} from "../types";

export const httpCheckMigrator: Migrator = {
  type: "http_check",

  async validate(step: Step): Promise<ValidationResult> {
    const errors: string[] = [];
    if (!step.url) errors.push("No URL specified for http_check");
    if (step.expect === undefined) errors.push("No expected status code specified for http_check");
    return { valid: errors.length === 0, errors, warnings: [] };
  },

  async execute(step: Step, context: MigrationContext): Promise<StepResult> {
    const start = Date.now();
    const url = step.url!;
    const expectedStatus = Number(step.expect!);

    context.onLog(`Checking ${url}...`);

    // Retry a few times — services may need a moment after starting
    const maxRetries = 5;
    const retryDelay = 3000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          redirect: "follow",
          signal: AbortSignal.timeout(10000),
        });

        if (response.status === expectedStatus) {
          context.onLog(`HTTP check passed: ${url} returned ${response.status}`);
          return { success: true, duration: Date.now() - start };
        }

        context.onLog(
          `Attempt ${attempt}/${maxRetries}: got ${response.status}, expected ${expectedStatus}`,
        );
      } catch (err) {
        context.onLog(
          `Attempt ${attempt}/${maxRetries}: connection failed (${err instanceof Error ? err.message : "unknown error"})`,
        );
      }

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }

    return {
      success: false,
      error: `HTTP check failed: ${url} did not return ${expectedStatus} after ${maxRetries} attempts`,
      duration: Date.now() - start,
    };
  },

  async estimate(): Promise<TimeEstimate> {
    return { seconds: 15, description: "~15 sec" };
  },
};
