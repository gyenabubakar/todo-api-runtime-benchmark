import { Command } from "commander";

import { BACKENDS } from "./lib/constants";
import { loadLatestResults, formatBackendName, formatInteger, formatMs, formatNumber, describeBackend } from "./lib/results";
import { fail, printMarkdown } from "./lib/ui";

async function buildPerBackendSection() {
  const results = await loadLatestResults();
  if (results.length === 0) {
    fail("No benchmark results were found yet. Run one with make bench-500, make bench-1k, make bench-2k, or make bench-4k.");
  }

  const missingBackends = BACKENDS.filter(
    (backend) => !results.some((result) => result.backend === backend)
  );

  const perBackend = results
    .map((result) =>
      [
        `## ${formatBackendName(result.backend)}`,
        "",
        `- **Latest file:** \`${result.fileName}\``,
        `- **Run time:** ${result.createdAt}`,
        `- **Peak users:** ${formatInteger(result.peakVUs)}`,
        `- **Success rate:** ${formatNumber(result.successRate)}%`,
        `- **Failed requests:** ${formatInteger(result.failedRequests)}`,
        `- **Requests per second:** ${formatNumber(result.requestsPerSecond)}`,
        `- **Average response time:** ${formatMs(result.avgLatencyMs)}`,
        `- **p50 response time:** ${formatMs(result.p50LatencyMs)}`,
        `- **p90 response time:** ${formatMs(result.p90LatencyMs)}`,
        `- **p95 response time:** ${formatMs(result.p95LatencyMs)}`,
        `- **p99 response time:** ${formatMs(result.p99LatencyMs)}`,
        `- **Plain English:** ${describeBackend(result)}`
      ].join("\n")
    )
    .join("\n\n");

  const basics = [
    "# Latest Benchmark Results",
    "",
    "## Simple Meaning",
    "",
    "- **p50:** half of the requests were this fast or faster.",
    "- **p90:** 9 out of 10 requests were this fast or faster.",
    "- **p95:** 95 out of 100 requests were this fast or faster.",
    "- **p99:** 99 out of 100 requests were this fast or faster.",
    "- Lower time is better.",
    "- Higher success rate is better.",
    "- Higher requests per second is better.",
    "",
    ...missingBackends.map(
      (backend) => `- No saved result yet for **${formatBackendName(backend)}**.`
    ),
    "",
    perBackend
  ]
    .filter(Boolean)
    .join("\n");

  return basics;
}

const program = new Command()
  .name("result")
  .description("Show the latest saved result for each backend without comparing them.")
  .action(async () => {
    printMarkdown(await buildPerBackendSection());
  });

await program.parseAsync(process.argv);
