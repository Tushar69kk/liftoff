import type { DatabaseInfo, Service } from "../types";

interface ImagePattern {
	pattern: RegExp;
	type: "postgres";
}

const DB_PATTERNS: ImagePattern[] = [
	{ pattern: /^(postgres|postgresql)(?::(.+))?$/, type: "postgres" },
	{ pattern: /^bitnami\/postgresql(?::(.+))?$/, type: "postgres" },
	{ pattern: /^postgis\/postgis(?::(.+))?$/, type: "postgres" },
];

export function detectDatabases(services: Service[]): DatabaseInfo[] {
	const databases: DatabaseInfo[] = [];

	for (const service of services) {
		const imageName = service.image;

		for (const { pattern, type } of DB_PATTERNS) {
			const match = imageName.match(pattern);
			if (match) {
				// Version is in the first or second capture group depending on pattern
				const version = match[2] ?? match[1] ?? "latest";
				// If the capture was the image name itself (not a version), use "latest"
				const isVersion = /^[\d.]/.test(version);

				databases.push({
					serviceName: service.name,
					type,
					version: isVersion ? version : "latest",
					containerName: service.name, // Will be refined by actual docker inspect later
				});
				break;
			}
		}
	}

	return databases;
}
