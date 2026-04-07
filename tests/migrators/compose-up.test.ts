import { describe, expect, test } from "bun:test";
import { composeUpMigrator } from "../../src/migrators/compose-up";
import { MockSshClient } from "../helpers/mock-ssh";
import type { MigrationContext, MigrationPlan } from "../../src/types";

function makeContext(target: MockSshClient): MigrationContext {
  const plan: MigrationPlan = {
    version: 1,
    source: { host: "root@old.de", compose_file: "/opt/app/docker-compose.yml" },
    target: { host: "root@new.de", compose_dir: "/opt/app" },
    services: [],
    steps: [],
  };
  return { source: new MockSshClient(), target, plan, onProgress: () => {}, onLog: () => {} };
}

describe("composeUpMigrator", () => {
  test("starts all services when no service specified", async () => {
    const target = new MockSshClient(() => ({ stdout: "", stderr: "", code: 0 }));
    const result = await composeUpMigrator.execute(
      { name: "start", type: "compose_up" },
      makeContext(target),
    );
    expect(result.success).toBe(true);
    expect(target.commands.some((c) => c.includes("docker compose up -d"))).toBe(true);
  });

  test("starts single service when specified", async () => {
    const target = new MockSshClient(() => ({ stdout: "", stderr: "", code: 0 }));
    await composeUpMigrator.execute(
      { name: "start db", type: "compose_up", service: "nextcloud-db" },
      makeContext(target),
    );
    expect(target.commands.some((c) => c.includes("up -d nextcloud-db"))).toBe(true);
  });
});
