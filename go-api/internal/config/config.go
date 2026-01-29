package config

import (
	"os"
	"strconv"
)

type Config struct {
	Environment string
	Port        int
	BaseURL     string

	// Database
	DBHost     string
	DBPort     int
	DBUsername string
	DBPassword string
	DBName     string

	// Cache (Valkey)
	CacheHost string
	CachePort int

	// JWT
	JWTSecret string
}

func Load() *Config {
	return &Config{
		Environment: getEnv("ENVIRONMENT", "development"),
		Port:        getEnvAsInt("PORT", 8081),
		BaseURL:     getEnv("BASE_URL", "http://localhost:8081"),

		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnvAsInt("DB_PORT", 5432),
		DBUsername: getEnv("DB_USERNAME", "todos_user"),
		DBPassword: getEnv("DB_PASSWORD", "todos_password"),
		DBName:     getEnv("DB_NAME", "hummingbird_todos"),

		CacheHost: getEnv("CACHE_HOST", "localhost"),
		CachePort: getEnvAsInt("CACHE_PORT", 6379),

		JWTSecret: getEnv("JWT_SECRET", "your-super-secret-jwt-key-change-in-production"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}
