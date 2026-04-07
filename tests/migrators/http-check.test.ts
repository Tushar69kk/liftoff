import { describe, expect, test } from "bun:test";
import { httpCheckMigrator } from "../../src/migrators/http-check";
import type { MigrationContext, MigrationPlan } from "../../src/types";
import { MockSshClient } from "../helpers/mock-ssh";

function makeContext(): MigrationContext {
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
	return {
		source: new MockSshClient(),
		target: new MockSshClient(),
		plan,
		onProgress: () => {},
		onLog: () => {},
	};
}

describe("httpCheckMigrator", () => {
	test("type is http_check", () => {
		expect(httpCheckMigrator.type).toBe("http_check");
	});

	test("validate requires url and expect", async () => {
		const result = await httpCheckMigrator.validate(
			{ name: "check", type: "http_check" },
			makeContext(),
		);
		expect(result.valid).toBe(false);
		expect(result.errors.length).toBeGreaterThan(0);
	});

	test("validate passes with url and expect", async () => {
		const result = await httpCheckMigrator.validate(
			{
				name: "check",
				type: "http_check",
				url: "https://example.com",
				expect: 200,
			},
			makeContext(),
		);
		expect(result.valid).toBe(true);
	});
});
