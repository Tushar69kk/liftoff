#!/usr/bin/env bun

const command = process.argv[2];

switch (command) {
  case "plan":
    console.log("liftoff plan — not yet implemented");
    break;
  case "run":
    console.log("liftoff run — not yet implemented");
    break;
  case "verify":
    console.log("liftoff verify — not yet implemented");
    break;
  default:
    console.log(`
  Liftoff — Migrate Docker Compose stacks between servers

  Usage:
    liftoff plan     Create a migration plan
    liftoff run      Execute a migration plan
    liftoff verify   Run health checks

  Options:
    --help           Show this help
    --version        Show version
    `);
}
