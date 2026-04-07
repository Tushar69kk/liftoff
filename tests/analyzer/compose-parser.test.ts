import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { parseComposeFile } from "../../src/analyzer/compose-parser";

const nextcloudYaml = readFileSync("tests/fixtures/docker-compose-nextcloud.yml", "utf-8");
const simpleYaml = readFileSync("tests/fixtures/docker-compose-simple.yml", "utf-8");

describe("parseComposeFile", () => {
  test("extracts all services from nextcloud stack", () => {
    const result = parseComposeFile(nextcloudYaml);
    expect(result.services).toHaveLength(3);
    expect(result.services.map((s) => s.name).sort()).toEqual([
      "nextcloud-app",
      "nextcloud-db",
      "nextcloud-redis",
    ]);
  });

  test("extracts image names", () => {
    const result = parseComposeFile(nextcloudYaml);
    const db = result.services.find((s) => s.name === "nextcloud-db");
    expect(db?.image).toBe("postgres:16");
  });

  test("extracts named volumes", () => {
    const result = parseComposeFile(nextcloudYaml);
    const db = result.services.find((s) => s.name === "nextcloud-db");
    expect(db?.volumes).toContain("nextcloud_db:/var/lib/postgresql/data");
  });

  test("lists all named volumes", () => {
    const result = parseComposeFile(nextcloudYaml);
    expect(result.volumeNames.sort()).toEqual([
      "nextcloud_data",
      "nextcloud_db",
      "nextcloud_redis",
    ]);
  });

  test("excludes bind mounts from named volumes", () => {
    const result = parseComposeFile(simpleYaml);
    expect(result.volumeNames).toEqual([]);
  });

  test("handles simple compose without volumes section", () => {
    const result = parseComposeFile(simpleYaml);
    expect(result.services).toHaveLength(1);
    expect(result.services[0].name).toBe("web");
  });
});
