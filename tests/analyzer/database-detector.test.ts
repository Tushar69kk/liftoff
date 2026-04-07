import { describe, expect, test } from "bun:test";
import { detectDatabases } from "../../src/analyzer/database-detector";
import type { Service } from "../../src/types";

describe("detectDatabases", () => {
	test("detects PostgreSQL from image name", () => {
		const services: Service[] = [
			{
				name: "db",
				image: "postgres:16",
				volumes: ["db_data:/var/lib/postgresql/data"],
			},
		];
		const dbs = detectDatabases(services);
		expect(dbs).toHaveLength(1);
		expect(dbs[0].type).toBe("postgres");
		expect(dbs[0].version).toBe("16");
		expect(dbs[0].serviceName).toBe("db");
	});

	test("detects PostgreSQL from bitnami image", () => {
		const services: Service[] = [
			{ name: "db", image: "bitnami/postgresql:15.4", volumes: [] },
		];
		const dbs = detectDatabases(services);
		expect(dbs).toHaveLength(1);
		expect(dbs[0].type).toBe("postgres");
		expect(dbs[0].version).toBe("15.4");
	});

	test("returns empty for non-database services", () => {
		const services: Service[] = [
			{ name: "web", image: "nginx:latest", volumes: [] },
			{ name: "app", image: "nextcloud:28", volumes: [] },
		];
		const dbs = detectDatabases(services);
		expect(dbs).toHaveLength(0);
	});

	test("handles image without version tag", () => {
		const services: Service[] = [
			{ name: "db", image: "postgres", volumes: [] },
		];
		const dbs = detectDatabases(services);
		expect(dbs).toHaveLength(1);
		expect(dbs[0].version).toBe("latest");
	});

	test("detects multiple databases in one stack", () => {
		const services: Service[] = [
			{ name: "main-db", image: "postgres:16", volumes: [] },
			{ name: "cache-db", image: "postgres:15", volumes: [] },
		];
		const dbs = detectDatabases(services);
		expect(dbs).toHaveLength(2);
	});
});
