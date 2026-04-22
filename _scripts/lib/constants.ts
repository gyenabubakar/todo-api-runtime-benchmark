import { resolve } from "node:path";

export type Backend = "bun" | "go" | "swift";

export const BACKENDS: Backend[] = ["bun", "go", "swift"];

export const ROOT_DIR = resolve(import.meta.dir, "../..");
export const BENCH_RESULTS_DIR = resolve(ROOT_DIR, "_bench-results");
export const ROOT_ENV_PATH = resolve(ROOT_DIR, ".env");
export const INIT_SQL_PATH = resolve(ROOT_DIR, "init.sql");
export const BENCHMARK_SCRIPT_PATH = resolve(ROOT_DIR, "benchmark/benchmark.js");

export const BACKEND_SERVICE: Record<Backend, string> = {
  bun: "bun-api",
  go: "go-api",
  swift: "swift-api"
};

export const BACKEND_CONTAINER: Record<Backend, string> = {
  bun: "todos-bun-api",
  go: "todos-go-api",
  swift: "todos-swift-api"
};

export const BACKEND_PORT: Record<Backend, number> = {
  bun: 8082,
  go: 8081,
  swift: 8080
};

export const BACKEND_ENV_PATH: Record<Backend, string> = {
  bun: resolve(ROOT_DIR, "bun-api/.env"),
  go: resolve(ROOT_DIR, "go-api/.env"),
  swift: resolve(ROOT_DIR, "swift-api/.env")
};

export const ROOT_ENV = {
  DB_HOST: "localhost",
  DB_PORT: "5432",
  DB_USERNAME: "todos_user",
  DB_PASSWORD: "todos_password",
  DB_NAME: "todos_benchmark",
  CACHE_HOST: "localhost",
  CACHE_PORT: "6379",
  JWT_SECRET: "your-super-secret-jwt-key-change-in-production",
  BASE_URL: "http://localhost:8080",
  PORT: "8082",
  BUN_BASE_URL: "http://localhost:8082",
  LOG_LEVEL: "info",
  ENVIRONMENT: "development"
} as const;

export const BACKEND_ENV: Record<Backend, Record<string, string>> = {
  bun: {
    DB_HOST: "localhost",
    DB_PORT: "5432",
    DB_USERNAME: "todos_user",
    DB_PASSWORD: "todos_password",
    DB_NAME: "todos_benchmark",
    CACHE_HOST: "localhost",
    CACHE_PORT: "6379",
    JWT_SECRET: "your-super-secret-jwt-key-change-in-production",
    BASE_URL: "http://localhost:8082",
    PORT: "8082",
    ENVIRONMENT: "development"
  },
  go: {
    DB_HOST: "localhost",
    DB_PORT: "5432",
    DB_USERNAME: "todos_user",
    DB_PASSWORD: "todos_password",
    DB_NAME: "todos_benchmark",
    CACHE_HOST: "localhost",
    CACHE_PORT: "6379",
    JWT_SECRET: "your-super-secret-jwt-key-change-in-production",
    BASE_URL: "http://localhost:8081",
    PORT: "8081",
    ENVIRONMENT: "development"
  },
  swift: {
    DB_HOST: "localhost",
    DB_PORT: "5432",
    DB_USERNAME: "todos_user",
    DB_PASSWORD: "todos_password",
    DB_NAME: "todos_benchmark",
    CACHE_HOST: "localhost",
    CACHE_PORT: "6379",
    JWT_SECRET: "your-super-secret-jwt-key-change-in-production",
    BASE_URL: "http://localhost:8080",
    LOG_LEVEL: "info"
  }
};
