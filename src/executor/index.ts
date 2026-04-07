import type {
  MigrationPlan,
  SshClient,
  MigrationContext,
  ProgressEvent,
  StepResult,
} from "../types";
import { MigratorRegistry } from "../migrators/registry";

export type FailureAction = "retry" | "skip" | "abort";

export interface ExecutionCallbacks {
  source: SshClient;
  target: SshClient;
  sudoPassword?: string;
  onLog: (message: string) => void;
  onProgress: (event: ProgressEvent) => void;
  onStepStart?: (stepIndex: number, stepName: string) => void;
  onStepComplete?: (stepIndex: number, result: StepResult) => void;
  onStepFailed?: (stepIndex: number, error: string) => Promise<FailureAction>;
}

export interface ExecutionResult {
  success: boolean;
  completedSteps: number;
  failedStep?: number;
  error?: string;
  totalDuration: number;
  stepResults: StepResult[];
}

export interface ValidationReport {
  valid: boolean;
  stepErrors: (string | null)[];
}

export class Executor {
  constructor(private registry: MigratorRegistry) {}

  async validate(
    plan: MigrationPlan,
    callbacks: ExecutionCallbacks,
  ): Promise<ValidationReport> {
    const context = this.buildContext(plan, callbacks);
    const stepErrors: (string | null)[] = [];
    let valid = true;

    for (const step of plan.steps) {
      const migrator = this.registry.resolve(step.type);
      const result = await migrator.validate(step, context);
      if (!result.valid) {
        valid = false;
        stepErrors.push(result.errors.join("; "));
      } else {
        stepErrors.push(null);
      }
    }

    return { valid, stepErrors };
  }

  async execute(
    plan: MigrationPlan,
    callbacks: ExecutionCallbacks,
  ): Promise<ExecutionResult> {
    const context = this.buildContext(plan, callbacks);
    const start = Date.now();
    const stepResults: StepResult[] = [];
    let completedSteps = 0;

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      const migrator = this.registry.resolve(step.type);

      callbacks.onStepStart?.(i, step.name);
      callbacks.onLog(`[${i + 1}/${plan.steps.length}] ${step.name}`);

      // Update progress context for this step
      const stepContext: MigrationContext = {
        ...context,
        onProgress: (event) => {
          callbacks.onProgress({ ...event, stepIndex: i });
        },
      };

      let result = await migrator.execute(step, stepContext);
      stepResults.push(result);
      callbacks.onStepComplete?.(i, result);

      if (!result.success) {
        // Ask the caller what to do: retry, skip, or abort
        const action = callbacks.onStepFailed
          ? await callbacks.onStepFailed(i, result.error ?? "Unknown error")
          : "abort";

        if (action === "retry") {
          // Re-run the same step (decrement i so the loop retries)
          i--;
          stepResults.pop(); // remove the failed result
          continue;
        } else if (action === "skip") {
          callbacks.onLog(`Skipped step: ${step.name}`);
          completedSteps++;
          continue;
        } else {
          return {
            success: false,
            completedSteps,
            failedStep: i,
            error: result.error,
            totalDuration: Date.now() - start,
            stepResults,
          };
        }
      }

      completedSteps++;
    }

    return {
      success: true,
      completedSteps,
      totalDuration: Date.now() - start,
      stepResults,
    };
  }

  private buildContext(
    plan: MigrationPlan,
    callbacks: ExecutionCallbacks,
  ): MigrationContext {
    return {
      source: callbacks.source,
      target: callbacks.target,
      plan,
      sudoPassword: callbacks.sudoPassword,
      onProgress: callbacks.onProgress,
      onLog: callbacks.onLog,
    };
  }
}
