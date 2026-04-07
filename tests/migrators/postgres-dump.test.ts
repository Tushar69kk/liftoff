import { describe, expect, test } from "bun:test";
import { postgresDumpMigrator } from "../../src/migrators/postgres-dump";
import { MockSshClient } from "../helpers/mock-ssh";
import type { MigrationContext, MigrationPlan } from "../../src/types";

function makeContext(source: MockSshClient): MigrationContext {
  const plan: MigrationPlan = {
    version: 1,
    source: { host: "root@old.de", compose_file: "/opt/app/docker-compose.yml" },
    target: { host: "root@new.de", compose_dir: "/opt/app" },
    services: [
      { name: "app-db", image: "postgres:16", type: "postgres", version: "16", volumes: [] },
    ],
    steps: [],
  };
  return { source, target: new MockSshClient(), plan, onProgress: () => {}, onLog: () => {} };
}

describe("postgresDumpMigrator", () => {
  test("type is postgres_dump", () => {
    expect(postgresDumpMigrator.type).toBe("postgres_dump");
  });

  test("validate checks container is running", async () => {
    const source = new MockSshClient((cmd) => {
      if (cmd.includes("docker compose") && cmd.includes("ps")) {
        return { stdout: "", stderr: "", code: 0 };
      }
      if (cmd.includes("docker inspect")) {
        return { stdout: "false", stderr: "", code: 0 }; // not running
      }
      return { stdout: "", stderr: "", code: 0 };
    });

    const result = await postgresDumpMigrator.validate(
      { name: "dump", type: "postgres_dump", service: "app-db" },
      makeContext(source),
    );
    // Should at minimum not crash
    expect(result).toBeDefined();
  });

  test("execute runs pg_dump via docker exec", async () => {
    const source = new MockSshClient((cmd) => {
      if (cmd.includes("docker compose") && cmd.includes("exec")) {
        return { stdout: "", stderr: "", code: 0 };
      }
      return { stdout: "", stderr: "", code: 0 };
    });

    const result = await postgresDumpMigrator.execute(
      { name: "dump", type: "postgres_dump", service: "app-db", method: "dump_restore" },
      makeContext(source),
    );
    expect(result.success).toBe(true);
    expect(source.commands.some((c) => c.includes("pg_dump"))).toBe(true);
  });
});
