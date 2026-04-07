import { describe, expect, test } from "bun:test";
import { mongoRestoreMigrator } from "../../src/migrators/mongo-restore";
import type { MigrationContext, MigrationPlan } from "../../src/types";
import { MockSshClient } from "../helpers/mock-ssh";

function makeContext(source: MockSshClient, target: MockSshClient): MigrationContext {
  const plan: MigrationPlan = {
    version: 1,
    source: {
      host: "root@old.de",
      compose_file: "/opt/app/docker-compose.yml",
    },
    target: { host: "root@new.de", compose_dir: "/opt/app" },
    services: [
      {
        name: "app-mongo",
        image: "mongo:7",
        type: "mongo",
        version: "7",
        volumes: [],
      },
    ],
    volumes: [],
    steps: [],
  };
  return { source, target, plan, onProgress: () => {}, onLog: () => {} };
}

describe("mongoRestoreMigrator", () => {
  test("type is mongo_restore", () => {
    expect(mongoRestoreMigrator.type).toBe("mongo_restore");
  });

  test("validate fails with missing service", async () => {
    const source = new MockSshClient();
    const target = new MockSshClient();
    const result = await mongoRestoreMigrator.validate(
      { name: "restore", type: "mongo_restore" },
      makeContext(source, target),
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("No service specified");
  });

  test("execute copies dump and runs mongorestore on target", async () => {
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

    const result = await mongoRestoreMigrator.execute(
      { name: "restore", type: "mongo_restore", service: "app-mongo" },
      makeContext(source, target),
    );
    expect(result.success).toBe(true);
    expect(target.commands.some((c) => c.includes("mongorestore"))).toBe(true);
  });
});
