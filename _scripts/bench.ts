import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { Command, InvalidArgumentError } from "commander";

import {
  BACKENDS,
  BACKEND_CONTAINER,
  BACKEND_PORT,
  BENCHMARK_SCRIPT_PATH,
  BENCH_RESULTS_DIR,
  type Backend
} from "./lib/constants";
import { captureCommand, runCommand } from "./lib/process";
import { fail, printInfo, printSuccess, printWarning } from "./lib/ui";

const ALLOWED_LOADS = new Set(["500", "1000", "2000", "4000"]);

function parsePeakVUs(value: string) {
  if (!ALLOWED_LOADS.has(value)) {
    throw new InvalidArgumentError("Choose one benchmark load: 500, 1000, 2000, or 4000.");
  }

  return Number(value);
}

function formatTimestamp(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}_${hours}-${minutes}`;
}

function findActiveBackends() {
  const { stdout } = captureCommand(["docker", "ps", "--format", "{{.Names}}"]);
  const names = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return BACKENDS.filter((backend) => names.includes(BACKEND_CONTAINER[backend]));
}

async function runBenchmark(peakVUs: number) {
  const activeBackends = findActiveBackends();

  if (activeBackends.length === 0) {
    fail("No backend container is active. Start one first with make bun, make go, or make swift.");
  }

  if (activeBackends.length > 1) {
    fail(`More than one backend is active: ${activeBackends.join(", ")}. Keep only one running before benchmarking.`);
  }

  const backend = activeBackends[0] as Backend;
  const createdAt = new Date();
  const label = peakVUs >= 1000 ? `${peakVUs / 1000}k` : String(peakVUs);
  const resultFile = `${backend}-${formatTimestamp(createdAt)}.json`;
  const resultPath = join(BENCH_RESULTS_DIR, resultFile);

  mkdirSync(BENCH_RESULTS_DIR, { recursive: true });

  printInfo(`Running the ${backend} benchmark at ${peakVUs} peak users.`);

  const k6Result = runCommand(
    [
      "k6",
      "run",
      "--summary-mode=full",
      "--summary-time-unit=ms",
      "--summary-trend-stats=avg,min,med,max,p(90),p(95),p(99)",
      "-e",
      `API_URL=http://localhost:${BACKEND_PORT[backend]}`,
      "-e",
      `PEAK_VUS=${peakVUs}`,
      "-e",
      `RESULT_BACKEND=${backend}`,
      "-e",
      `RESULT_LABEL=${label}`,
      "-e",
      `RESULT_PATH=${resultPath}`,
      "-e",
      `RESULT_CREATED_AT=${createdAt.toISOString()}`,
      BENCHMARK_SCRIPT_PATH
    ],
    {
      allowFailure: true,
      env: {
        K6_WEB_DASHBOARD: "false",
        K6_WEB_DASHBOARD_OPEN: "false",
        K6_WEB_DASHBOARD_PORT: "-1"
      }
    }
  );

  if (k6Result.exitCode !== 0) {
    if (!existsSync(resultPath)) {
      fail("k6 failed before it could write a result file.");
    }

    printWarning("k6 finished with a non-zero exit code because one or more thresholds were missed. The result file was still saved.");
  }

  printSuccess(`Benchmark saved to \`${resultPath}\`.`);
}

const program = new Command()
  .name("bench")
  .description("Run a benchmark against the one active backend container.")
  .argument("<peak-vus>", "Peak users: 500, 1000, 2000, or 4000", parsePeakVUs)
  .action(runBenchmark);

await program.parseAsync(process.argv);
