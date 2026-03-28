import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";

import { config } from "../config";
import * as schema from "./schema";

function buildDatabaseUrl() {
  const username = encodeURIComponent(config.dbUsername);
  const password = encodeURIComponent(config.dbPassword);
  return `postgres://${username}:${password}@${config.dbHost}:${config.dbPort}/${config.dbName}?sslmode=disable`;
}

export const sqlClient = new SQL({
  url: buildDatabaseUrl(),
  max: 25,
  idleTimeout: 30,
  maxLifetime: 3600,
  connectionTimeout: 10
});

export const db = drizzle({
  client: sqlClient,
  schema
});

export async function closeDatabase() {
  await sqlClient.close();
}
