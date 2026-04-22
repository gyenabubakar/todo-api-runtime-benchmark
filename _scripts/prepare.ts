import { mkdirSync } from "node:fs";

import { Command } from "commander";

import {
  BACKEND_ENV,
  BACKEND_ENV_PATH,
  BACKENDS,
  BENCH_RESULTS_DIR,
  INIT_SQL_PATH,
  ROOT_ENV,
  ROOT_ENV_PATH
} from "./lib/constants";
import { captureCommand, runCommand } from "./lib/process";
import { fail, printInfo, printSuccess } from "./lib/ui";

function toEnvFile(values: Record<string, string>) {
  return `${Object.entries(values)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")}\n`;
}

async function waitForPostgres() {
  for (let attempt = 1; attempt <= 30; attempt++) {
    const result = captureCommand(
      [
        "docker",
        "compose",
        "exec",
        "-T",
        "postgres",
        "pg_isready",
        "-U",
        ROOT_ENV.DB_USERNAME,
        "-d",
        ROOT_ENV.DB_NAME
      ],
      { allowFailure: true }
    );

    if (result.exitCode === 0) {
      return;
    }

    await Bun.sleep(1000);
  }

  fail("Postgres did not become ready in time.");
}

async function writeEnvFiles() {
  await Bun.write(ROOT_ENV_PATH, toEnvFile(ROOT_ENV));

  for (const backend of BACKENDS) {
    await Bun.write(BACKEND_ENV_PATH[backend], toEnvFile(BACKEND_ENV[backend]));
  }
}

async function prepare() {
  printInfo("Removing old containers and volumes for a clean run.");
  runCommand(["docker", "compose", "down", "-v", "--remove-orphans"], {
    allowFailure: true
  });

  printInfo("Writing env files.");
  await writeEnvFiles();
  mkdirSync(BENCH_RESULTS_DIR, { recursive: true });

  printInfo("Starting shared containers.");
  runCommand(["docker", "compose", "up", "-d", "postgres", "valkey"]);

  printInfo("Waiting for Postgres.");
  await waitForPostgres();

  printInfo("Running database setup.");
  runCommand([
    "docker",
    "compose",
    "exec",
    "-T",
    "postgres",
    "psql",
    "-U",
    ROOT_ENV.DB_USERNAME,
    "-d",
    ROOT_ENV.DB_NAME,
    "-f",
    "/docker-entrypoint-initdb.d/init.sql"
  ]);

  printSuccess(`Prepare finished. Shared services are up, and migrations from \`${INIT_SQL_PATH}\` were applied.`);
}

const program = new Command()
  .name("prepare")
  .description("Reset Docker state, write env files, and start shared services.")
  .action(prepare);

await program.parseAsync(process.argv);
