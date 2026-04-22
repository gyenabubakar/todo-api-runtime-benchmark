import { readdirSync } from "node:fs";
import { join } from "node:path";

import { BACKENDS, BENCH_RESULTS_DIR, type Backend } from "./constants";

type MetricValues = Record<string, number>;

interface K6Metric {
  type: string;
  contains: string;
  values: MetricValues;
}

interface StoredResult {
  schemaVersion: number;
  backend: Backend;
  label: string;
  peakVUs: number;
  apiUrl: string;
  createdAt: string;
  summary: {
    metrics: Record<string, K6Metric>;
  };
}

export interface ResultSnapshot {
  backend: Backend;
  filePath: string;
  fileName: string;
  createdAt: string;
  label: string;
  peakVUs: number;
  requestsPerSecond: number;
  failedRequests: number;
  successRate: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p90LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
}

function getMetric(result: StoredResult, name: string) {
  return result.summary.metrics[name];
}

function getMetricValue(result: StoredResult, metricName: string, valueName: string) {
  return getMetric(result, metricName)?.values?.[valueName] ?? 0;
}

async function parseResult(filePath: string) {
  return (await Bun.file(filePath).json()) as StoredResult;
}

export async function loadLatestResult(backend: Backend): Promise<ResultSnapshot | null> {
  let files: string[] = [];

  try {
    files = readdirSync(BENCH_RESULTS_DIR)
      .filter((file) => file.startsWith(`${backend}-`) && file.endsWith(".json"))
      .sort();
  } catch {
    return null;
  }

  const latest = files.at(-1);
  if (!latest) {
    return null;
  }

  const filePath = join(BENCH_RESULTS_DIR, latest);
  const result = await parseResult(filePath);

  const failedRate = getMetricValue(result, "http_req_failed", "rate");
  const requestCount = getMetricValue(result, "http_reqs", "count");
  const failedCount = Math.round(requestCount * failedRate);

  return {
    backend,
    filePath,
    fileName: latest,
    createdAt: result.createdAt,
    label: result.label,
    peakVUs: result.peakVUs,
    requestsPerSecond: getMetricValue(result, "http_reqs", "rate"),
    failedRequests: failedCount,
    successRate: (1 - failedRate) * 100,
    avgLatencyMs: getMetricValue(result, "http_req_duration", "avg"),
    p50LatencyMs: getMetricValue(result, "http_req_duration", "med"),
    p90LatencyMs: getMetricValue(result, "http_req_duration", "p(90)"),
    p95LatencyMs: getMetricValue(result, "http_req_duration", "p(95)"),
    p99LatencyMs: getMetricValue(result, "http_req_duration", "p(99)")
  };
}

export async function loadLatestResults() {
  const results = await Promise.all(BACKENDS.map((backend) => loadLatestResult(backend)));
  return results.filter((result): result is ResultSnapshot => result !== null);
}

export function formatBackendName(backend: Backend) {
  return backend === "go" ? "Go" : backend === "bun" ? "Bun" : "Swift";
}

export function formatNumber(value: number, digits = 2) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(value);
}

export function formatInteger(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0
  }).format(value);
}

export function formatMs(value: number) {
  if (value >= 1000) {
    return `${formatNumber(value / 1000, 2)} s`;
  }
  return `${formatNumber(value, 0)} ms`;
}

export function describeBackend(snapshot: ResultSnapshot) {
  if (snapshot.successRate >= 99 && snapshot.p95LatencyMs < 500) {
    return "This run looked very steady. Most requests stayed fast, and errors were rare.";
  }

  if (snapshot.successRate >= 99 && snapshot.p95LatencyMs >= 500) {
    return "This run stayed reliable, but the slower requests stretched out more than you would want.";
  }

  if (snapshot.successRate >= 95) {
    return "This run was usable, but it started to struggle under load. Some requests failed or got slow.";
  }

  return "This run had clear stress signs. Too many requests failed or slowed down badly.";
}

export function pickWinner(
  results: ResultSnapshot[],
  selector: (result: ResultSnapshot) => number,
  direction: "high" | "low"
) {
  if (results.length === 0) {
    return null;
  }

  return [...results].sort((left, right) => {
    const leftValue = selector(left);
    const rightValue = selector(right);
    return direction === "high" ? rightValue - leftValue : leftValue - rightValue;
  })[0];
}
