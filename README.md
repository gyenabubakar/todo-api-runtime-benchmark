# Todo API - Hummingbird (Swift) & Go

A complete Todo API built with two different stacks - **Hummingbird (Swift)** and **Go (Gin)** - sharing the same PostgreSQL database and Valkey cache. Both APIs have identical endpoints and authentication.

## Features

- JWT-based authentication (register/login)
- CRUD operations for todos
- PostgreSQL for data persistence
- Valkey for caching
- Docker Compose for easy setup
- Identical API endpoints on both stacks

## Project Structure

```
.
├── docker-compose.yml      # PostgreSQL, Valkey, and both APIs
├── init.sql                # Database schema initialization
├── .env.example            # Environment variables template
├── swift-api/              # Hummingbird (Swift) API
│   ├── Package.swift
│   ├── Dockerfile
│   └── Sources/App/
│       ├── App.swift
│       ├── Application+build.swift
│       ├── Controllers/
│       ├── DTOs/
│       ├── Models/
│       ├── Repositories/
│       ├── Services/
│       └── Middleware/
└── go-api/                 # Go (Gin) API
    ├── go.mod
    ├── Dockerfile
    └── cmd/api/
        └── internal/
            ├── config/
            ├── handlers/
            ├── middleware/
            ├── models/
            ├── repository/
            ├── cache/
            └── auth/
```

## Quick Start

### Prerequisites

- Docker & Docker Compose
- (Optional) Swift 6.0+ for local Swift development
- (Optional) Go 1.23+ for local Go development

### Running with Docker Compose

1. Copy the environment file:
   ```bash
   cp .env.example .env
   ```

2. Start all services:
   ```bash
   docker-compose up -d
   ```

3. The APIs will be available at:
   - **Swift API**: http://localhost:8080
   - **Go API**: http://localhost:8081

### Running Services Individually

Start only the database and Valkey:
```bash
docker-compose up -d postgres valkey
```

Then run either API locally:

**Swift API:**
```bash
cd swift-api
swift run App --hostname 0.0.0.0 --port 8080
```

**Go API:**
```bash
cd go-api
go run ./cmd/api
```

## API Endpoints

Both APIs share the same endpoint structure:

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register a new user |
| POST | `/auth/login` | Login and get JWT token |

### Todos (Requires Authentication)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/todos` | List all todos |
| POST | `/todos` | Create a new todo |
| GET | `/todos/:id` | Get a specific todo |
| PATCH | `/todos/:id` | Update a todo |
| DELETE | `/todos/:id` | Delete a todo |
| DELETE | `/todos` | Delete all todos |

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check endpoint |

## API Usage Examples

### Register a User

```bash
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "name": "John Doe"
  }'
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "John Doe",
    "created_at": "2025-01-27T12:00:00Z",
    "updated_at": "2025-01-27T12:00:00Z"
  }
}
```

### Login

```bash
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

### Create a Todo

```bash
curl -X POST http://localhost:8080/todos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "Buy groceries",
    "order": 1
  }'
```

Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "title": "Buy groceries",
  "order": 1,
  "completed": false,
  "url": "http://localhost:8080/todos/550e8400-e29b-41d4-a716-446655440001",
  "created_at": "2025-01-27T12:00:00Z",
  "updated_at": "2025-01-27T12:00:00Z"
}
```

### List All Todos

```bash
curl http://localhost:8080/todos \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Update a Todo

```bash
curl -X PATCH http://localhost:8080/todos/550e8400-e29b-41d4-a716-446655440001 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "completed": true
  }'
```

### Delete a Todo

```bash
curl -X DELETE http://localhost:8080/todos/550e8400-e29b-41d4-a716-446655440001 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | localhost | PostgreSQL host |
| `DB_PORT` | 5432 | PostgreSQL port |
| `DB_USERNAME` | todos_user | PostgreSQL username |
| `DB_PASSWORD` | todos_password | PostgreSQL password |
| `DB_NAME` | hummingbird_todos | PostgreSQL database name |
| `CACHE_HOST` | localhost | Valkey host |
| `CACHE_PORT` | 6379 | Valkey port |
| `JWT_SECRET` | (default) | Secret key for JWT signing |
| `BASE_URL` | http://localhost:8080 | Base URL for todo URLs |
| `LOG_LEVEL` | info | Logging level |

## Technology Stack

### Swift API (Hummingbird)
- **Hummingbird 2.5+** - Swift web framework
- **PostgresNIO** - PostgreSQL driver
- **hummingbird-valkey** - Valkey integration
- **HummingbirdAuth** - Authentication middleware
- **JWTKit** - JWT handling
- **HummingbirdBcrypt** - Password hashing

### Go API (Gin)
- **Gin 1.10+** - Go web framework
- **pgxpool** - PostgreSQL connection pool (used directly)
- **valkey-go** - Valkey client with automatic pipelining
- **golang-jwt v5** - JWT handling
- **bcrypt** - Password hashing

## Database Schema

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Todos table
CREATE TABLE todos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    "order" INTEGER,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## Caching Strategy

Both APIs implement cache-aside pattern with Valkey:
- Todo lists are cached per user for 5 minutes
- Individual todos are cached for 5 minutes
- Cache is invalidated on create, update, and delete operations

## License

MIT License
