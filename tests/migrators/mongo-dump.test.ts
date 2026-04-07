import { describe, expect, test } from "bun:test";
import { mongoDumpMigrator } from "../../src/migrators/mongo-dump";
import type { MigrationContext, MigrationPlan } from "../../src/types";
import { MockSshClient } from "../helpers/mock-ssh";

function makeContext(source: MockSshClient): MigrationContext {
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
    steps: [],
  };
  return {
    source,
    target: new MockSshClient(),
    plan,
    onProgress: () => {},
    onLog: () => {},
  };
}

describe("mongoDumpMigrator", () => {
  test("type is mongo_dump", () => {
    expect(mongoDumpMigrator.type).toBe("mongo_dump");
  });

  test("validate fails with missing service", async () => {
    const source = new MockSshClient();
    const result = await mongoDumpMigrator.validate(
      { name: "dump", type: "mongo_dump" },
      makeContext(source),
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("No service specified");
  });

  test("execute runs mongodump via docker compose exec", async () => {
    const source = new MockSshClient((cmd) => {
      if (cmd.includes("docker compose") && cmd.includes("exec")) {
        return { stdout: "", stderr: "", code: 0 };
      }
      return { stdout: "", stderr: "", code: 0 };
    });

    const result = await mongoDumpMigrator.execute(
      {
        name: "dump",
        type: "mongo_dump",
        service: "app-mongo",
      },
      makeContext(source),
    );
    expect(result.success).toBe(true);
    expect(source.commands.some((c) => c.includes("mongodump"))).toBe(true);
  });
});
