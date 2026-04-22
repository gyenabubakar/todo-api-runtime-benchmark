import { Command } from "commander";

import { loadLatestResults, formatBackendName, formatInteger, formatMs, formatNumber, pickWinner } from "./lib/results";
import { fail, printMarkdown } from "./lib/ui";

function buildLoadWarning(loads: number[]) {
  const uniqueLoads = [...new Set(loads)];
  if (uniqueLoads.length <= 1) {
    return "";
  }

  return [
    "## Fair Warning",
    "",
    `- These latest runs use different load sizes: ${uniqueLoads.join(", ")} peak users.`,
    "- So this comparison is useful, but not fully fair.",
    "- For a clean comparison, run the same load for all backends first."
  ].join("\n");
}

async function buildComparison() {
  const results = await loadLatestResults();

  if (results.length < 2) {
    fail("You need results from at least two backends before compare can say anything useful.");
  }

  const successWinner = pickWinner(results, (result) => result.successRate, "high");
  const throughputWinner = pickWinner(results, (result) => result.requestsPerSecond, "high");
  const avgWinner = pickWinner(results, (result) => result.avgLatencyMs, "low");
  const p95Winner = pickWinner(results, (result) => result.p95LatencyMs, "low");
  const p99Winner = pickWinner(results, (result) => result.p99LatencyMs, "low");
  const failureWinner = pickWinner(results, (result) => result.failedRequests, "low");
  const backendSections = results
    .map((result) =>
      [
        `### ${formatBackendName(result.backend)}`,
        "",
        `- Peak users: ${formatInteger(result.peakVUs)}`,
        `- Success rate: ${formatNumber(result.successRate)}%`,
        `- Failed requests: ${formatInteger(result.failedRequests)}`,
        `- Requests per second: ${formatNumber(result.requestsPerSecond)}`,
        `- Average response time: ${formatMs(result.avgLatencyMs)}`,
        `- p95 response time: ${formatMs(result.p95LatencyMs)}`,
        `- p99 response time: ${formatMs(result.p99LatencyMs)}`
      ].join("\n")
    )
    .join("\n\n");

  return [
    "# Benchmark Comparison",
    "",
    buildLoadWarning(results.map((result) => result.peakVUs)),
    "",
    "## Latest Runs",
    "",
    backendSections,
    "",
    "## Winners",
    "",
    `- **Best success rate:** ${successWinner ? formatBackendName(successWinner.backend) : "n/a"}`,
    `- **Fewest failed requests:** ${failureWinner ? formatBackendName(failureWinner.backend) : "n/a"}`,
    `- **Best requests per second:** ${throughputWinner ? formatBackendName(throughputWinner.backend) : "n/a"}`,
    `- **Best average response time:** ${avgWinner ? formatBackendName(avgWinner.backend) : "n/a"}`,
    `- **Best p95 response time:** ${p95Winner ? formatBackendName(p95Winner.backend) : "n/a"}`,
    `- **Best p99 response time:** ${p99Winner ? formatBackendName(p99Winner.backend) : "n/a"}`,
    "",
    "## Plain English",
    "",
    `- ${throughputWinner ? formatBackendName(throughputWinner.backend) : "The top backend"} handled the most requests each second.`,
    `- ${avgWinner ? formatBackendName(avgWinner.backend) : "The top backend"} felt fastest on average.`,
    `- ${p95Winner ? formatBackendName(p95Winner.backend) : "The top backend"} stayed calmer when the slower requests showed up.`,
    `- ${failureWinner ? formatBackendName(failureWinner.backend) : "The top backend"} dropped the fewest requests.`
  ]
    .filter(Boolean)
    .join("\n");
}

const program = new Command()
  .name("compare")
  .description("Compare the latest saved result from each backend.")
  .action(async () => {
    printMarkdown(await buildComparison());
  });

await program.parseAsync(process.argv);
