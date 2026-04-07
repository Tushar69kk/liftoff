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

	test("detects MySQL from image name", () => {
		const services: Service[] = [{ name: "db", image: "mysql:8", volumes: [] }];
		const dbs = detectDatabases(services);
		expect(dbs).toHaveLength(1);
		expect(dbs[0].type).toBe("mysql");
		expect(dbs[0].version).toBe("8");
	});

	test("detects MariaDB as mysql type", () => {
		const services: Service[] = [
			{ name: "db", image: "mariadb:11", volumes: [] },
		];
		const dbs = detectDatabases(services);
		expect(dbs).toHaveLength(1);
		expect(dbs[0].type).toBe("mysql");
		expect(dbs[0].version).toBe("11");
	});

	test("detects MySQL from bitnami image", () => {
		const services: Service[] = [
			{ name: "db", image: "bitnami/mysql:8.0", volumes: [] },
		];
		const dbs = detectDatabases(services);
		expect(dbs).toHaveLength(1);
		expect(dbs[0].type).toBe("mysql");
		expect(dbs[0].version).toBe("8.0");
	});

	test("detects MariaDB from bitnami image", () => {
		const services: Service[] = [
			{ name: "db", image: "bitnami/mariadb:11.2", volumes: [] },
		];
		const dbs = detectDatabases(services);
		expect(dbs).toHaveLength(1);
		expect(dbs[0].type).toBe("mysql");
		expect(dbs[0].version).toBe("11.2");
	});

	test("detects Redis from image name", () => {
		const services: Service[] = [
			{ name: "cache", image: "redis:7-alpine", volumes: [] },
		];
		const dbs = detectDatabases(services);
		expect(dbs).toHaveLength(1);
		expect(dbs[0].type).toBe("redis");
		expect(dbs[0].serviceName).toBe("cache");
	});

	test("detects Redis from bitnami image", () => {
		const services: Service[] = [
			{ name: "cache", image: "bitnami/redis:7.2", volumes: [] },
		];
		const dbs = detectDatabases(services);
		expect(dbs).toHaveLength(1);
		expect(dbs[0].type).toBe("redis");
	});

	test("detects Valkey as redis type", () => {
		const services: Service[] = [
			{ name: "cache", image: "valkey/valkey:7.2", volumes: [] },
		];
		const dbs = detectDatabases(services);
		expect(dbs).toHaveLength(1);
		expect(dbs[0].type).toBe("redis");
	});

	test("detects MongoDB from image name", () => {
		const services: Service[] = [
			{ name: "mongo-db", image: "mongo:7", volumes: [] },
		];
		const dbs = detectDatabases(services);
		expect(dbs).toHaveLength(1);
		expect(dbs[0].type).toBe("mongo");
		expect(dbs[0].version).toBe("7");
	});

	test("detects MongoDB from bitnami image", () => {
		const services: Service[] = [
			{ name: "mongo-db", image: "bitnami/mongodb:7.0", volumes: [] },
		];
		const dbs = detectDatabases(services);
		expect(dbs).toHaveLength(1);
		expect(dbs[0].type).toBe("mongo");
	});

	test("detects mixed database stack", () => {
		const services: Service[] = [
			{ name: "pg", image: "postgres:16", volumes: [] },
			{ name: "mysql", image: "mysql:8", volumes: [] },
			{ name: "cache", image: "redis:7-alpine", volumes: [] },
			{ name: "docs", image: "mongo:7", volumes: [] },
			{ name: "web", image: "nginx:latest", volumes: [] },
		];
		const dbs = detectDatabases(services);
		expect(dbs).toHaveLength(4);
		expect(dbs.map((d) => d.type).sort()).toEqual([
			"mongo",
			"mysql",
			"postgres",
			"redis",
		]);
	});
});
