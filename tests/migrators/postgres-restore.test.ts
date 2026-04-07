import { describe, expect, test } from "bun:test";
import { postgresRestoreMigrator } from "../../src/migrators/postgres-restore";
import type { MigrationContext, MigrationPlan } from "../../src/types";
import { MockSshClient } from "../helpers/mock-ssh";

function makeContext(
	source: MockSshClient,
	target: MockSshClient,
): MigrationContext {
	const plan: MigrationPlan = {
		version: 1,
		source: {
			host: "root@old.de",
			compose_file: "/opt/app/docker-compose.yml",
		},
		target: { host: "root@new.de", compose_dir: "/opt/app" },
		services: [
			{
				name: "app-db",
				image: "postgres:16",
				type: "postgres",
				version: "16",
				volumes: [],
			},
		],
		steps: [],
	};
	return { source, target, plan, onProgress: () => {}, onLog: () => {} };
}

describe("postgresRestoreMigrator", () => {
	test("type is postgres_restore", () => {
		expect(postgresRestoreMigrator.type).toBe("postgres_restore");
	});

	test("execute copies dump and runs pg_restore on target", async () => {
		const source = new MockSshClient(() => ({
			stdout: "",
			stderr: "",
			code: 0,
		}));
		const target = new MockSshClient(() => ({
			stdout: "",
			stderr: "",
			code: 0,
		}));

		const result = await postgresRestoreMigrator.execute(
			{ name: "restore", type: "postgres_restore", service: "app-db" },
			makeContext(source, target),
		);
		expect(result.success).toBe(true);
		expect(
			target.commands.some(
				(c) => c.includes("pg_restore") || c.includes("psql"),
			),
		).toBe(true);
	});
});
