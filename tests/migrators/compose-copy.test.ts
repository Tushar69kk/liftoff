import { describe, expect, test } from "bun:test";
import { composeCopyMigrator } from "../../src/migrators/compose-copy";
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
		services: [],
		steps: [],
	};
	return { source, target, plan, onProgress: () => {}, onLog: () => {} };
}

describe("composeCopyMigrator", () => {
	test("copies compose file and .env to target", async () => {
		const source = new MockSshClient();
		source.fileContents.set(
			"/opt/app/docker-compose.yml",
			"version: '3'\nservices: {}",
		);
		source.fileContents.set("/opt/app/.env", "SECRET=123");

		const target = new MockSshClient((cmd) => {
			if (cmd.includes("mkdir")) return { stdout: "", stderr: "", code: 0 };
			return { stdout: "", stderr: "", code: 0 };
		});

		const result = await composeCopyMigrator.execute(
			{ name: "copy", type: "compose_copy" },
			makeContext(source, target),
		);
		expect(result.success).toBe(true);
		expect(target.writtenFiles.has("/opt/app/docker-compose.yml")).toBe(true);
	});

	test("creates target directory if needed", async () => {
		const source = new MockSshClient();
		source.fileContents.set("/opt/app/docker-compose.yml", "version: '3'");

		const target = new MockSshClient((cmd) => ({
			stdout: "",
			stderr: "",
			code: 0,
		}));

		await composeCopyMigrator.execute(
			{ name: "copy", type: "compose_copy" },
			makeContext(source, target),
		);
		expect(target.commands.some((c) => c.includes("mkdir"))).toBe(true);
	});
});
