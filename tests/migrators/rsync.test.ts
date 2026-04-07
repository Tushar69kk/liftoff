import { describe, expect, test } from "bun:test";
import { rsyncMigrator } from "../../src/migrators/rsync";
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
    services: [{ name: "app", image: "nginx", volumes: ["app_data:/data"] }],
    volumes: [
      {
        name: "app_data",
        driver: "local",
        mountpoint: "/var/lib/docker/volumes/app_data/_data",
        sizeBytes: 1000000,
      },
    ],
    steps: [],
  };
  return {
    source,
    target,
    plan,
    onProgress: () => {},
    onLog: () => {},
  };
}

describe("rsyncMigrator", () => {
  test("type is rsync", () => {
    expect(rsyncMigrator.type).toBe("rsync");
  });

  test("validate fails when source has no rsync", async () => {
    const source = new MockSshClient((cmd) => {
      if (cmd.includes("which rsync")) return { stdout: "", stderr: "", code: 1 };
      return { stdout: "", stderr: "", code: 0 };
    });
    const target = new MockSshClient(() => ({ stdout: "/usr/bin/rsync", stderr: "", code: 0 }));

    const result = await rsyncMigrator.validate(
      { name: "sync", type: "rsync", live: true },
      makeContext(source, target),
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("source");
  });

  test("validate warns when target has no rsync (SFTP fallback)", async () => {
    const source = new MockSshClient((cmd) => {
      if (cmd.includes("which rsync")) return { stdout: "/usr/bin/rsync", stderr: "", code: 0 };
      return { stdout: "", stderr: "", code: 0 };
    });
    const target = new MockSshClient((cmd) => {
      if (cmd.includes("which rsync")) return { stdout: "", stderr: "", code: 1 };
      return { stdout: "", stderr: "", code: 0 };
    });

    const result = await rsyncMigrator.validate(
      { name: "sync", type: "rsync", live: true },
      makeContext(source, target),
    );
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  test("execute transfers volumes (falls back to SFTP when rsync SSH fails)", async () => {
    const source = new MockSshClient((cmd) => {
      // rsync dry-run fails (no SSH access to target) — triggers SFTP fallback
      if (cmd.includes("rsync --dry-run")) return { stdout: "", stderr: "error", code: 1 };
      if (cmd.includes("docker volume inspect")) {
        return { stdout: "/var/lib/docker/volumes/app_data/_data", stderr: "", code: 0 };
      }
      if (cmd.includes("stat")) return { stdout: "1024", stderr: "", code: 0 };
      return { stdout: "", stderr: "", code: 0 };
    });
    const target = new MockSshClient((cmd) => {
      if (cmd.includes("docker volume inspect")) {
        return { stdout: "/var/lib/docker/volumes/app_data/_data", stderr: "", code: 0 };
      }
      return { stdout: "", stderr: "", code: 0 };
    });

    const result = await rsyncMigrator.execute(
      { name: "sync", type: "rsync", live: true },
      makeContext(source, target),
    );
    expect(result.success).toBe(true);
    // Should use tar (SFTP fallback)
    expect(source.commands.some((c) => c.includes("tar czf"))).toBe(true);
    expect(source.downloadedFiles.length).toBeGreaterThan(0);
    expect(target.uploadedFiles.length).toBeGreaterThan(0);
    expect(target.commands.some((c) => c.includes("tar xzf"))).toBe(true);
  });

  test("execute uses rsync directly when SSH works", async () => {
    const source = new MockSshClient((cmd) => {
      // rsync dry-run succeeds — use direct rsync
      if (cmd.includes("rsync --dry-run")) return { stdout: "", stderr: "", code: 0 };
      if (cmd.includes("rsync -azP")) return { stdout: "100%", stderr: "", code: 0 };
      if (cmd.includes("docker volume inspect")) {
        return { stdout: "/var/lib/docker/volumes/app_data/_data", stderr: "", code: 0 };
      }
      return { stdout: "", stderr: "", code: 0 };
    });
    const target = new MockSshClient((cmd) => {
      if (cmd.includes("docker volume inspect")) {
        return { stdout: "/var/lib/docker/volumes/app_data/_data", stderr: "", code: 0 };
      }
      return { stdout: "", stderr: "", code: 0 };
    });

    const result = await rsyncMigrator.execute(
      { name: "sync", type: "rsync", live: true },
      makeContext(source, target),
    );
    expect(result.success).toBe(true);
    // Should use rsync directly, NOT tar
    expect(source.commands.some((c) => c.includes("rsync -azP"))).toBe(true);
    expect(source.commands.some((c) => c.includes("tar czf"))).toBe(false);
  });
});
