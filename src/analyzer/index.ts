import type { SshClient, AnalysisResult, VolumeInfo } from "../types";
import { parseComposeFile } from "./compose-parser";
import { detectDatabases } from "./database-detector";

export async function analyzeStack(
  ssh: SshClient,
  composePath: string,
): Promise<AnalysisResult> {
  // Read compose file from remote server
  const yamlContent = await ssh.readFile(composePath);
  const parsed = parseComposeFile(yamlContent);

  // Detect databases
  const databases = detectDatabases(parsed.services);

  // Enrich services with database type info
  const services = parsed.services.map((service) => {
    const db = databases.find((d) => d.serviceName === service.name);
    if (db) {
      return { ...service, type: db.type as "postgres", version: db.version };
    }
    return service;
  });

  // Get volume details from Docker
  const volumes: VolumeInfo[] = [];
  for (const volName of parsed.volumeNames) {
    const inspectResult = await ssh.exec(
      `docker volume inspect ${volName} --format '{{.Driver}} {{.Mountpoint}}'`,
    );
    if (inspectResult.code === 0) {
      const [driver, mountpoint] = inspectResult.stdout.trim().split(" ");

      // Get volume size
      const duResult = await ssh.exec(`du -sb ${mountpoint} 2>/dev/null`);
      const sizeBytes = duResult.code === 0 ? parseInt(duResult.stdout.split("\t")[0], 10) : 0;

      volumes.push({
        name: volName,
        driver: driver ?? "local",
        mountpoint: mountpoint ?? "",
        sizeBytes,
      });
    }
  }

  return {
    composePath,
    services,
    volumes,
    databases,
  };
}

export { parseComposeFile } from "./compose-parser";
export { detectDatabases } from "./database-detector";
