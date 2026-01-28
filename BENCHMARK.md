# Benchmark

Load testing suite for comparing Swift (Hummingbird) and Go API performance using [k6](https://k6.io/).

## Prerequisites

- [k6](https://k6.io/) - `brew install k6`
- Docker and Docker Compose
- Go and Swift toolchains (for dependency checks)

## What It Tests

The benchmark simulates a complete user flow with cache behavior testing:

1. **POST /auth/register** - Create new account
2. **POST /auth/login** - Authenticate
3. **GET /todos** - List all todos (empty)
4. **POST /todos** - Create a todo
5. **GET /todos/:id** - Get single todo (cache miss)
6. **GET /todos/:id** x2 - Get todo again (cache hits)
7. **GET /todos** - List todos (cache hit after create)
8. **PATCH /todos/:id** - Update todo (invalidates cache)
9. **GET /todos/:id** - Get todo after update (cache miss)
10. **GET /todos/:id** x2 - Get todo again (cache hits after update)
11. **GET /todos** - List todos after update (cache miss)
12. **DELETE /todos/:id** - Delete todo

Each virtual user (VU) creates a unique account and performs the full CRUD cycle including cache hit/miss scenarios, with a 3-second pause between iterations to simulate realistic usage.

## Load Profile

Base load profile (scale 1 = 1000 VUs):

| Stage | Duration | Virtual Users |
|-------|----------|---------------|
| Warm-up | 30s | 0 → 100 |
| Main load | 1m | 100 → 200 |
| Stress test | 1m | 200 → 500 |
| Peak load | 30s | 500 → 1000 |
| Ramp down | 1m | 1000 → 0 |

**Total duration:** ~4.5 minutes (including graceful stop)

### Scaling

Use the scale parameter to increase load:

```bash
./run.sh swift 2  # 2k VUs, 1.5x duration (~6.75 min)
./run.sh swift 3  # 3k VUs, 2x duration (~9 min)
./run.sh swift 4  # 4k VUs, 2.5x duration (~11.25 min)
```

## Running Benchmarks

For accurate isolated results, benchmark each API separately with a fresh database:

### Benchmark Swift API

```bash
docker compose up -d postgres redis swift-api
cd benchmark
./run.sh swift
```

Clean up results and reset:

```bash
rm -f benchmark/results-*.json benchmark/stats.csv
docker compose down -v
```

### Benchmark Go API

```bash
docker compose up -d postgres redis go-api
cd benchmark
./run.sh go
```

Clean up:

```bash
rm -f benchmark/results-*.json benchmark/stats.csv
docker compose down -v
```

### Alternative: Run k6 directly

```bash
k6 run --env API_URL=http://localhost:8080 benchmark/benchmark.js
```

## Output

The benchmark generates two files in the `benchmark/` directory:

- **results-{api}-{timestamp}.json** - Detailed k6 metrics
- **stats.csv** - Docker container resource usage (CPU, memory, network) sampled every second

## Metrics Collected

### Thresholds
- **http_req_duration** - 95th percentile should be under 500ms
- **http_req_failed** - Error rate should be under 1%

### Custom Metrics
- Per-endpoint success counters
- Per-endpoint latency trends (avg, min, med, max, p90, p95, p99)

### Resource Metrics (stats.csv)
- CPU usage (%)
- Memory usage
- Network I/O
- Block I/O

## Results

- **1000 VUs (~4 minutes):** See [BENCHMARK-RESULTS_1000.md](./BENCHMARK-RESULTS_1000.md)
- **2000 VUs (~6 minutes):** See [BENCHMARK-RESULTS_2000.md](./BENCHMARK-RESULTS_2000.md)
