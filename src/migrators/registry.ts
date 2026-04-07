import type { Migrator, Step } from "../types";
import { composeCopyMigrator } from "./compose-copy";
import { composeDownMigrator } from "./compose-down";
import { composeUpMigrator } from "./compose-up";
import { containerCheckMigrator } from "./container-check";
import { httpCheckMigrator } from "./http-check";
import { mongoDumpMigrator } from "./mongo-dump";
import { mongoRestoreMigrator } from "./mongo-restore";
import { mysqlDumpMigrator } from "./mysql-dump";
import { mysqlRestoreMigrator } from "./mysql-restore";
import { postgresDumpMigrator } from "./postgres-dump";
import { postgresRestoreMigrator } from "./postgres-restore";
import { redisDumpMigrator } from "./redis-dump";
import { redisRestoreMigrator } from "./redis-restore";
import { rsyncMigrator } from "./rsync";

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
	registry.register(mysqlDumpMigrator);
	registry.register(mysqlRestoreMigrator);
	registry.register(redisDumpMigrator);
	registry.register(redisRestoreMigrator);
	registry.register(mongoDumpMigrator);
	registry.register(mongoRestoreMigrator);
	registry.register(composeDownMigrator);
	registry.register(composeUpMigrator);
	registry.register(composeCopyMigrator);
	registry.register(httpCheckMigrator);
	registry.register(containerCheckMigrator);
	return registry;
}
