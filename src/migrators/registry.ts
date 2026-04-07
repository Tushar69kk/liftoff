import type { Migrator, Step } from "../types";

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
