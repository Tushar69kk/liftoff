import { describe, expect, test } from "bun:test";
import { redisRestoreMigrator } from "../../src/migrators/redis-restore";
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
				name: "cache",
				image: "redis:7-alpine",
				type: "redis",
				version: "7",
				volumes: [],
			},
		],
		steps: [],
	};
	return { source, target, plan, onProgress: () => {}, onLog: () => {} };
}

describe("redisRestoreMigrator", () => {
	test("type is redis_restore", () => {
		expect(redisRestoreMigrator.type).toBe("redis_restore");
	});

	test("validate fails with missing service", async () => {
		const source = new MockSshClient();
		const target = new MockSshClient();
		const result = await redisRestoreMigrator.validate(
			{ name: "restore", type: "redis_restore" },
			makeContext(source, target),
		);
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain("No service specified");
	});

	test("execute checks redis-cli DBSIZE on target", async () => {
		const source = new MockSshClient(() => ({
			stdout: "",
			stderr: "",
			code: 0,
		}));
		const target = new MockSshClient((cmd) => {
			if (cmd.includes("redis-cli DBSIZE")) {
				return { stdout: "db0:keys=42", stderr: "", code: 0 };
			}
			return { stdout: "", stderr: "", code: 0 };
		});

		const result = await redisRestoreMigrator.execute(
			{ name: "restore", type: "redis_restore", service: "cache" },
			makeContext(source, target),
		);
		expect(result.success).toBe(true);
		expect(
			target.commands.some((c) => c.includes("redis-cli")),
		).toBe(true);
	});
});
