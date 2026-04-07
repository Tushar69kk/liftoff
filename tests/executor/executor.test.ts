import { describe, expect, test } from "bun:test";
import { Executor } from "../../src/executor/index";
import { MigratorRegistry } from "../../src/migrators/registry";
import type {
	MigrationContext,
	MigrationPlan,
	Migrator,
	Step,
	StepResult,
	TimeEstimate,
	ValidationResult,
} from "../../src/types";
import { MockSshClient } from "../helpers/mock-ssh";

function makeMockMigrator(type: Step["type"], shouldFail = false): Migrator {
	return {
		type,
		async validate(): Promise<ValidationResult> {
			return { valid: true, errors: [], warnings: [] };
		},
		async execute(step: Step, context: MigrationContext): Promise<StepResult> {
			context.onLog(`Executing ${step.name}`);
			if (shouldFail) {
				return {
					success: false,
					error: "Intentional test failure",
					duration: 10,
				};
			}
			return { success: true, duration: 10 };
		},
		async estimate(): Promise<TimeEstimate> {
			return { seconds: 10, description: "10s" };
		},
	};
}

function makePlan(steps: Step[]): MigrationPlan {
	return {
		version: 1,
		source: {
			host: "root@old.de",
			compose_file: "/opt/app/docker-compose.yml",
		},
		target: { host: "root@new.de", compose_dir: "/opt/app" },
		services: [],
		steps,
	};
}

describe("Executor", () => {
	test("executes all steps sequentially", async () => {
		const registry = new MigratorRegistry();
		registry.register(makeMockMigrator("rsync"));
		registry.register(makeMockMigrator("compose_down"));
		registry.register(makeMockMigrator("compose_up"));

		const plan = makePlan([
			{ name: "Sync", type: "rsync", live: true },
			{ name: "Stop", type: "compose_down" },
			{ name: "Start", type: "compose_up" },
		]);

		const executor = new Executor(registry);
		const logs: string[] = [];
		const result = await executor.execute(plan, {
			source: new MockSshClient(),
			target: new MockSshClient(),
			onLog: (msg) => logs.push(msg),
			onProgress: () => {},
		});

		expect(result.success).toBe(true);
		expect(result.completedSteps).toBe(3);
		expect(logs).toContain("Executing Sync");
		expect(logs).toContain("Executing Stop");
		expect(logs).toContain("Executing Start");
	});

	test("stops on failure and reports which step failed", async () => {
		const registry = new MigratorRegistry();
		registry.register(makeMockMigrator("rsync"));
		registry.register(makeMockMigrator("compose_down", true)); // will fail
		registry.register(makeMockMigrator("compose_up"));

		const plan = makePlan([
			{ name: "Sync", type: "rsync", live: true },
			{ name: "Stop", type: "compose_down" },
			{ name: "Start", type: "compose_up" },
		]);

		const executor = new Executor(registry);
		const result = await executor.execute(plan, {
			source: new MockSshClient(),
			target: new MockSshClient(),
			onLog: () => {},
			onProgress: () => {},
		});

		expect(result.success).toBe(false);
		expect(result.completedSteps).toBe(1);
		expect(result.failedStep).toBe(1);
		expect(result.error).toContain("Intentional test failure");
	});

	test("validates all steps before execution", async () => {
		const registry = new MigratorRegistry();
		const badMigrator: Migrator = {
			type: "rsync",
			async validate(): Promise<ValidationResult> {
				return { valid: false, errors: ["rsync missing"], warnings: [] };
			},
			async execute(): Promise<StepResult> {
				return { success: true, duration: 0 };
			},
			async estimate(): Promise<TimeEstimate> {
				return { seconds: 0, description: "" };
			},
		};
		registry.register(badMigrator);

		const plan = makePlan([{ name: "Sync", type: "rsync", live: true }]);

		const executor = new Executor(registry);
		const result = await executor.validate(plan, {
			source: new MockSshClient(),
			target: new MockSshClient(),
			onLog: () => {},
			onProgress: () => {},
		});

		expect(result.valid).toBe(false);
		expect(result.stepErrors[0]).toContain("rsync missing");
	});
});
