import { describe, expect, test } from "bun:test";
import type { ExecResult, MigrationPlan, ProgressEvent, Step } from "../src/types";

describe("types", () => {
  test("MigrationPlan structure is valid", () => {
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
          image: "postgres:16",
          type: "postgres",
          version: "16",
          volumes: ["app_db:/var/lib/postgresql/data"],
        },
      ],
      volumes: [],
      steps: [
        {
          name: "Dump DB",
          type: "postgres_dump",
          service: "app-db",
          method: "dump_restore",
        },
      ],
    };
    expect(plan.version).toBe(1);
    expect(plan.source.host).toBe("root@old.de");
    expect(plan.services).toHaveLength(1);
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].type).toBe("postgres_dump");
  });

  test("Step types cover all MVP migrators", () => {
    const stepTypes: Step["type"][] = [
      "rsync",
      "postgres_dump",
      "postgres_restore",
      "mysql_dump",
      "mysql_restore",
      "redis_dump",
      "redis_restore",
      "mongo_dump",
      "mongo_restore",
      "compose_down",
      "compose_up",
      "compose_copy",
      "compose_create",
      "http_check",
      "container_check",
    ];
    expect(stepTypes).toHaveLength(15);
  });

  test("ExecResult captures command output", () => {
    const result: ExecResult = { stdout: "ok", stderr: "", code: 0 };
    expect(result.code).toBe(0);
  });

  test("ProgressEvent carries step progress info", () => {
    const event: ProgressEvent = {
      stepIndex: 0,
      percent: 50,
      message: "Syncing...",
      bytesTransferred: 1024,
      bytesTotal: 2048,
    };
    expect(event.percent).toBe(50);
  });
});
