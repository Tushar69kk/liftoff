import { parse } from "yaml";
import type { Service } from "../types";

export interface ComposeParseResult {
  services: Service[];
  volumeNames: string[];
}

interface ComposeFile {
  version?: string;
  services: Record<
    string,
    {
      image?: string;
      volumes?: string[];
      environment?: string[] | Record<string, string>;
      depends_on?: string[] | Record<string, unknown>;
      ports?: string[];
    }
  >;
  volumes?: Record<string, unknown>;
}

export function parseComposeFile(yamlContent: string): ComposeParseResult {
  const compose = parse(yamlContent) as ComposeFile;

  if (!compose.services) {
    throw new Error("Invalid docker-compose.yml: no services found");
  }

  // Top-level named volumes
  const declaredVolumes = compose.volumes ? Object.keys(compose.volumes) : [];

  const services: Service[] = Object.entries(compose.services).map(([name, config]) => {
    const volumes = config.volumes ?? [];

    return {
      name,
      image: config.image ?? "unknown",
      volumes,
    };
  });

  // Named volumes are those declared in top-level volumes section
  // Bind mounts (starting with . or /) are excluded
  const usedNamedVolumes = new Set<string>();
  for (const service of services) {
    for (const vol of service.volumes) {
      const volName = vol.split(":")[0];
      if (declaredVolumes.includes(volName)) {
        usedNamedVolumes.add(volName);
      }
    }
  }

  return {
    services,
    volumeNames: [...usedNamedVolumes].sort(),
  };
}
