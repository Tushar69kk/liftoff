import { describe, expect, test } from "bun:test";
import { generatePlan } from "../../src/planner/index";
import type { AnalysisResult, ServerConfig } from "../../src/types";

const source: ServerConfig = {
	host: "root@old-server.de",
	compose_file: "/opt/nextcloud/docker-compose.yml",
};

const target: ServerConfig = {
	host: "root@new-server.de",
	compose_dir: "/opt/nextcloud",
};

const analysis: AnalysisResult = {
	composePath: "/opt/nextcloud/docker-compose.yml",
	services: [
		{
			name: "nextcloud-app",
			image: "nextcloud:28",
			volumes: ["nextcloud_data:/var/www/html"],
		},
		{
			name: "nextcloud-db",
			image: "postgres:16",
			type: "postgres",
			version: "16",
			volumes: ["nextcloud_db:/var/lib/postgresql/data"],
		},
	],
	volumes: [
		{
			name: "nextcloud_data",
			driver: "local",
			mountpoint: "/var/lib/docker/volumes/nextcloud_data/_data",
			sizeBytes: 5000000000,
		},
		{
			name: "nextcloud_db",
			driver: "local",
			mountpoint: "/var/lib/docker/volumes/nextcloud_db/_data",
			sizeBytes: 1000000000,
		},
	],
	databases: [
		{
			serviceName: "nextcloud-db",
			type: "postgres",
			version: "16",
			containerName: "nextcloud-db",
		},
	],
};

describe("generatePlan", () => {
	test("generates a complete plan with all required steps", () => {
		const plan = generatePlan(source, target, analysis);
		expect(plan.version).toBe(1);
		expect(plan.source).toEqual(source);
		expect(plan.target).toEqual(target);

		const stepTypes = plan.steps.map((s) => s.type);
		expect(stepTypes).toContain("rsync");
		expect(stepTypes).toContain("compose_copy");
		expect(stepTypes).toContain("compose_down");
		expect(stepTypes).toContain("compose_up");
	});

	test("includes postgres dump/restore for detected databases", () => {
		const plan = generatePlan(source, target, analysis);
		const pgDump = plan.steps.find((s) => s.type === "postgres_dump");
		const pgRestore = plan.steps.find((s) => s.type === "postgres_restore");
		expect(pgDump).toBeDefined();
		expect(pgDump?.service).toBe("nextcloud-db");
		expect(pgRestore).toBeDefined();
	});

	test("starts database before restore", () => {
		const plan = generatePlan(source, target, analysis);
		const steps = plan.steps;
		const dbUpIndex = steps.findIndex(
			(s) => s.type === "compose_up" && s.service === "nextcloud-db",
		);
		const restoreIndex = steps.findIndex((s) => s.type === "postgres_restore");
		expect(dbUpIndex).toBeLessThan(restoreIndex);
	});

	test("stops source before final sync", () => {
		const plan = generatePlan(source, target, analysis);
		const steps = plan.steps;
		const downIndex = steps.findIndex((s) => s.type === "compose_down");
		const finalSyncIndex = steps.findIndex(
			(s) => s.type === "rsync" && s.live === false,
		);
		expect(downIndex).toBeLessThan(finalSyncIndex);
	});

	test("pre-sync happens before source stop", () => {
		const plan = generatePlan(source, target, analysis);
		const steps = plan.steps;
		const preSyncIndex = steps.findIndex(
			(s) => s.type === "rsync" && s.live === true,
		);
		const downIndex = steps.findIndex((s) => s.type === "compose_down");
		expect(preSyncIndex).toBeLessThan(downIndex);
	});

	test("ends with health checks", () => {
		const plan = generatePlan(source, target, analysis);
		const lastStep = plan.steps[plan.steps.length - 1];
		expect(["http_check", "container_check"]).toContain(lastStep.type);
	});

	test("generates plan without databases", () => {
		const noDbs: AnalysisResult = {
			...analysis,
			databases: [],
			services: [analysis.services[0]],
		};
		const plan = generatePlan(source, target, noDbs);
		expect(plan.steps.find((s) => s.type === "postgres_dump")).toBeUndefined();
		expect(
			plan.steps.find((s) => s.type === "postgres_restore"),
		).toBeUndefined();
	});

	test("generates correct steps for MySQL and Redis databases", () => {
		const mixedAnalysis: AnalysisResult = {
			composePath: "/opt/app/docker-compose.yml",
			services: [
				{ name: "app", image: "node:20", volumes: [] },
				{
					name: "mysql-db",
					image: "mysql:8",
					type: "mysql",
					version: "8",
					volumes: ["mysql_data:/var/lib/mysql"],
				},
				{
					name: "cache",
					image: "redis:7-alpine",
					type: "redis",
					version: "7",
					volumes: ["redis_data:/data"],
				},
			],
			volumes: [
				{
					name: "mysql_data",
					driver: "local",
					mountpoint: "/var/lib/docker/volumes/mysql_data/_data",
					sizeBytes: 2000000000,
				},
				{
					name: "redis_data",
					driver: "local",
					mountpoint: "/var/lib/docker/volumes/redis_data/_data",
					sizeBytes: 100000000,
				},
			],
			databases: [
				{
					serviceName: "mysql-db",
					type: "mysql",
					version: "8",
					containerName: "mysql-db",
				},
				{
					serviceName: "cache",
					type: "redis",
					version: "7",
					containerName: "cache",
				},
			],
		};

		const plan = generatePlan(source, target, mixedAnalysis);
		const stepTypes = plan.steps.map((s) => s.type);

		// Should have MySQL dump/restore
		expect(stepTypes).toContain("mysql_dump");
		expect(stepTypes).toContain("mysql_restore");

		// Should have Redis dump/restore
		expect(stepTypes).toContain("redis_dump");
		expect(stepTypes).toContain("redis_restore");

		// Should NOT have postgres steps
		expect(stepTypes).not.toContain("postgres_dump");
		expect(stepTypes).not.toContain("postgres_restore");

		// MySQL dump should target the correct service
		const mysqlDump = plan.steps.find((s) => s.type === "mysql_dump");
		expect(mysqlDump?.service).toBe("mysql-db");

		// Redis dump should target the correct service
		const redisDump = plan.steps.find((s) => s.type === "redis_dump");
		expect(redisDump?.service).toBe("cache");

		// Database start should come before restore
		const mysqlUpIndex = plan.steps.findIndex(
			(s) => s.type === "compose_up" && s.service === "mysql-db",
		);
		const mysqlRestoreIndex = plan.steps.findIndex(
			(s) => s.type === "mysql_restore",
		);
		expect(mysqlUpIndex).toBeLessThan(mysqlRestoreIndex);
	});
});
