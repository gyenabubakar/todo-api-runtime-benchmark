export interface AppConfig {
  environment: string;
  port: number;
  baseUrl: string;
  dbHost: string;
  dbPort: number;
  dbUsername: string;
  dbPassword: string;
  dbName: string;
  cacheHost: string;
  cachePort: number;
  jwtSecret: string;
}

function getEnv(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.length > 0 ? value : fallback;
}

function getEnvAsInt(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export const config: AppConfig = {
  environment: getEnv("ENVIRONMENT", "development"),
  port: getEnvAsInt("PORT", 8082),
  baseUrl: getEnv("BASE_URL", "http://localhost:8082"),
  dbHost: getEnv("DB_HOST", "localhost"),
  dbPort: getEnvAsInt("DB_PORT", 5432),
  dbUsername: getEnv("DB_USERNAME", "todos_user"),
  dbPassword: getEnv("DB_PASSWORD", "todos_password"),
  dbName: getEnv("DB_NAME", "hummingbird_todos"),
  cacheHost: getEnv("CACHE_HOST", "localhost"),
  cachePort: getEnvAsInt("CACHE_PORT", 6379),
  jwtSecret: getEnv("JWT_SECRET", "your-super-secret-jwt-key-change-in-production")
};
