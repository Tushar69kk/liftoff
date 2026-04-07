import { describe, expect, test } from "bun:test";
import { mysqlRestoreMigrator } from "../../src/migrators/mysql-restore";
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
  return { source, target, plan, onProgress: () => {}, onLog: () => {} };
}

describe("mysqlRestoreMigrator", () => {
  test("type is mysql_restore", () => {
    expect(mysqlRestoreMigrator.type).toBe("mysql_restore");
  });

  test("validate fails with missing service", async () => {
    const source = new MockSshClient();
    const target = new MockSshClient();
    const result = await mysqlRestoreMigrator.validate(
      { name: "restore", type: "mysql_restore" },
      makeContext(source, target),
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("No service specified");
  });

  test("execute copies dump and runs mysql on target", async () => {
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

    const result = await mysqlRestoreMigrator.execute(
      { name: "restore", type: "mysql_restore", service: "app-db" },
      makeContext(source, target),
    );
    expect(result.success).toBe(true);
    expect(target.commands.some((c) => c.includes("mysql"))).toBe(true);
  });
});
