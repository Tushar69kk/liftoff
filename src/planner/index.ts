import type { AnalysisResult, MigrationPlan, ServerConfig, Step } from "../types";

export function generatePlan(
  source: ServerConfig,
  target: ServerConfig,
  analysis: AnalysisResult,
): MigrationPlan {
  const steps: Step[] = [];

  // 1. Copy compose files to target
  steps.push({
    name: "Copy compose files",
    type: "compose_copy",
  });

  // 2. Create volumes on target (creates containers+volumes without starting services)
  if (analysis.volumes.length > 0) {
    steps.push({
      name: "Create volumes on target",
      type: "compose_create",
    });
  }

  // 3. Pre-sync volumes (live, while stack is still running)
  if (analysis.volumes.length > 0) {
    steps.push({
      name: "Pre-sync volumes",
      type: "rsync",
      live: true,
    });
  }

  // 4. Dump databases (while stack is still running)
  for (const db of analysis.databases) {
    switch (db.type) {
      case "postgres":
        steps.push({
          name: `Dump PostgreSQL (${db.serviceName})`,
          type: "postgres_dump",
          service: db.serviceName,
          method: "dump_restore",
        });
        break;
      case "mysql":
        steps.push({
          name: `Dump MySQL (${db.serviceName})`,
          type: "mysql_dump",
          service: db.serviceName,
        });
        break;
      case "redis":
        steps.push({
          name: `Save Redis (${db.serviceName})`,
          type: "redis_dump",
          service: db.serviceName,
        });
        break;
      case "mongo":
        steps.push({
          name: `Dump MongoDB (${db.serviceName})`,
          type: "mongo_dump",
          service: db.serviceName,
        });
        break;
    }
  }

  // 5. Stop source stack
  steps.push({
    name: "Stop source stack",
    type: "compose_down",
  });

  // 6. Final delta sync (after stop)
  if (analysis.volumes.length > 0) {
    steps.push({
      name: "Final delta sync",
      type: "rsync",
      live: false,
    });
  }

  // 7. Start database containers on target + restore
  for (const db of analysis.databases) {
    steps.push({
      name: `Start target database (${db.serviceName})`,
      type: "compose_up",
      service: db.serviceName,
    });

    switch (db.type) {
      case "postgres":
        steps.push({
          name: `Restore PostgreSQL (${db.serviceName})`,
          type: "postgres_restore",
          service: db.serviceName,
        });
        break;
      case "mysql":
        steps.push({
          name: `Restore MySQL (${db.serviceName})`,
          type: "mysql_restore",
          service: db.serviceName,
        });
        break;
      case "redis":
        steps.push({
          name: `Verify Redis (${db.serviceName})`,
          type: "redis_restore",
          service: db.serviceName,
        });
        break;
      case "mongo":
        steps.push({
          name: `Restore MongoDB (${db.serviceName})`,
          type: "mongo_restore",
          service: db.serviceName,
        });
        break;
    }
  }

  // 8. Start full target stack
  steps.push({
    name: "Start target stack",
    type: "compose_up",
  });

  // 9. Health checks — container check for each service
  for (const service of analysis.services) {
    steps.push({
      name: `Container check (${service.name})`,
      type: "container_check",
      service: service.name,
      expect: "running",
    });
  }

  return {
    version: 1,
    source,
    target,
    services: analysis.services,
    volumes: analysis.volumes,
    steps,
  };
}

export { parsePlanYaml, stringifyPlan } from "./yaml";
