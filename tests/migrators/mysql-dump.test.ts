import { describe, expect, test } from "bun:test";
import { mysqlDumpMigrator } from "../../src/migrators/mysql-dump";
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
        name: "app-db",
        image: "mysql:8",
        type: "mysql",
        version: "8",
        volumes: [],
      },
    ],
    volumes: [],
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

describe("mysqlDumpMigrator", () => {
  test("type is mysql_dump", () => {
    expect(mysqlDumpMigrator.type).toBe("mysql_dump");
  });

  test("validate fails with missing service", async () => {
    const source = new MockSshClient();
    const result = await mysqlDumpMigrator.validate(
      { name: "dump", type: "mysql_dump" },
      makeContext(source),
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("No service specified");
  });

  test("execute runs mysqldump via docker compose exec", async () => {
    const source = new MockSshClient((cmd) => {
      if (cmd.includes("docker compose") && cmd.includes("exec")) {
        return { stdout: "", stderr: "", code: 0 };
      }
      return { stdout: "", stderr: "", code: 0 };
    });

    const result = await mysqlDumpMigrator.execute(
      {
        name: "dump",
        type: "mysql_dump",
        service: "app-db",
      },
      makeContext(source),
    );
    expect(result.success).toBe(true);
    expect(source.commands.some((c) => c.includes("mysqldump"))).toBe(true);
  });
});
