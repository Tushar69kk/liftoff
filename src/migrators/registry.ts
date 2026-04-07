import type { Migrator, Step } from "../types";
import { rsyncMigrator } from "./rsync";
import { postgresDumpMigrator } from "./postgres-dump";
import { postgresRestoreMigrator } from "./postgres-restore";
import { composeDownMigrator } from "./compose-down";
import { composeUpMigrator } from "./compose-up";
import { composeCopyMigrator } from "./compose-copy";
import { httpCheckMigrator } from "./http-check";
import { containerCheckMigrator } from "./container-check";

export class MigratorRegistry {
  private migrators = new Map<string, Migrator>();

  register(migrator: Migrator): void {
    if (this.migrators.has(migrator.type)) {
      throw new Error(`Migrator already registered for type: ${migrator.type}`);
    }
    this.migrators.set(migrator.type, migrator);
  }

  resolve(type: Step["type"]): Migrator {
    const migrator = this.migrators.get(type);
    if (!migrator) {
      throw new Error(`No migrator registered for type: ${type}`);
    }
    return migrator;
  }

  types(): string[] {
    return [...this.migrators.keys()];
  }
}

export function createDefaultRegistry(): MigratorRegistry {
  const registry = new MigratorRegistry();
  registry.register(rsyncMigrator);
  registry.register(postgresDumpMigrator);
  registry.register(postgresRestoreMigrator);
  registry.register(composeDownMigrator);
  registry.register(composeUpMigrator);
  registry.register(composeCopyMigrator);
  registry.register(httpCheckMigrator);
  registry.register(containerCheckMigrator);
  return registry;
}
