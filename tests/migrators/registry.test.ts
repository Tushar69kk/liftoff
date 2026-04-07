import { describe, expect, test } from "bun:test";
import { MigratorRegistry } from "../../src/migrators/registry";
import type {
	Migrator,
	Step,
	StepResult,
	TimeEstimate,
	ValidationResult,
} from "../../src/types";

function makeFakeMigrator(type: Step["type"]): Migrator {
	return {
		type,
		async validate(): Promise<ValidationResult> {
			return { valid: true, errors: [], warnings: [] };
		},
		async execute(): Promise<StepResult> {
			return { success: true, duration: 100 };
		},
		async estimate(): Promise<TimeEstimate> {
			return { seconds: 10, description: "10s" };
		},
	};
}

describe("MigratorRegistry", () => {
	test("registers and resolves a migrator by type", () => {
		const registry = new MigratorRegistry();
		const migrator = makeFakeMigrator("rsync");
		registry.register(migrator);
		expect(registry.resolve("rsync")).toBe(migrator);
	});

	test("throws on unregistered type", () => {
		const registry = new MigratorRegistry();
		expect(() => registry.resolve("rsync")).toThrow(
			/no migrator registered.*rsync/i,
		);
	});

	test("lists all registered types", () => {
		const registry = new MigratorRegistry();
		registry.register(makeFakeMigrator("rsync"));
		registry.register(makeFakeMigrator("compose_up"));
		expect(registry.types().sort()).toEqual(["compose_up", "rsync"]);
	});

	test("prevents duplicate registration", () => {
		const registry = new MigratorRegistry();
		registry.register(makeFakeMigrator("rsync"));
		expect(() => registry.register(makeFakeMigrator("rsync"))).toThrow(
			/already registered/i,
		);
	});
});
