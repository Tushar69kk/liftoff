import { describe, expect, test } from "bun:test";
import { containerCheckMigrator } from "../../src/migrators/container-check";
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

describe("containerCheckMigrator", () => {
  test("type is container_check", () => {
    expect(containerCheckMigrator.type).toBe("container_check");
  });

  test("succeeds when container is running", async () => {
    const target = new MockSshClient((cmd) => {
      if (cmd.includes("ps") && cmd.includes("State")) {
        return { stdout: "running", stderr: "", code: 0 };
      }
      return { stdout: "", stderr: "", code: 0 };
    });

    const result = await containerCheckMigrator.execute(
      { name: "check", type: "container_check", service: "app", expect: "running" },
      makeContext(target),
    );
    expect(result.success).toBe(true);
  });

  test("fails when container is not running", async () => {
    const target = new MockSshClient((cmd) => {
      if (cmd.includes("ps") && cmd.includes("State")) {
        return { stdout: "exited", stderr: "", code: 0 };
      }
      return { stdout: "", stderr: "", code: 0 };
    });

    const result = await containerCheckMigrator.execute(
      { name: "check", type: "container_check", service: "app", expect: "running" },
      makeContext(target),
    );
    expect(result.success).toBe(false);
  });
});
