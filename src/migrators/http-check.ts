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
      // Run curl from the target server so it can reach localhost/container URLs
      const curlResult = await context.target.exec(
        `curl -s -o /dev/null -w '%{http_code}' --max-time 10 -L '${url}'`,
      );

      const statusCode = parseInt(curlResult.stdout.trim(), 10);

      if (curlResult.code === 0 && statusCode === expectedStatus) {
        context.onLog(`HTTP check passed: ${url} returned ${statusCode}`);
        return { success: true, duration: Date.now() - start };
      }

      if (curlResult.code === 0) {
        context.onLog(
          `Attempt ${attempt}/${maxRetries}: got ${statusCode}, expected ${expectedStatus}`,
        );
      } else {
        context.onLog(
          `Attempt ${attempt}/${maxRetries}: connection failed (curl exit ${curlResult.code})`,
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
