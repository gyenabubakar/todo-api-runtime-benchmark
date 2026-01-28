# Benchmark Results: Swift (Hummingbird) vs Go (2000 VUs)

Comparison of a Todo API implemented in both Swift (Hummingbird) and Go, running identical workloads at 2x the base load.

## Test Environment

- **Machine:** MacBook (Apple Silicon), 7.8 GB RAM available to Docker
- **Database:** PostgreSQL 18 (Alpine)
- **Cache:** Redis 7 (Alpine)
- **Load Testing:** k6 with 2000 virtual users peak
- **Both APIs:** Running in Docker containers
- **Bcrypt Cost:** 10 (matching Go's DefaultCost)

## Test Scenario

Each virtual user performs a complete user flow with cache behavior testing:

1. Register new account (bcrypt password hashing)
2. Login
3. List todos (empty)
4. Create todo
5. Get todo by ID (cache miss)
6. Get todo by ID x2 (cache hits)
7. List todos (cache hit after create)
8. Update todo (invalidates cache)
9. Get todo by ID (cache miss after update)
10. Get todo by ID x2 (cache hits after update)
11. List todos (cache miss after update)
12. Delete todo

3-second pause between iterations to simulate realistic usage.

## Overall Results

| Metric | Swift | Go | Go (worker pool) | Winner |
|--------|-------|-----|------------------|--------|
| **Success Rate** | 96.72% | 99.05% | 95.08% | Go |
| **Failed Requests** | 8,450 (3.27%) | 2,173 (0.94%) | 9,986 (4.91%) | Go |
| **Throughput** | 711 req/s | 637 req/s | 561 req/s | Swift |
| **Completed Iterations** | 25,719 | 17,690 | 23,246 | Swift |
| **Avg Latency** | 725ms | 917ms | 958ms | Swift |
| **Median Latency** | 21ms | 158ms | 80ms | Swift |
| **p95 Latency** | 6.22s | 4.68s | 9.63s | Go |
| **p99 Latency** | 10s | 9.82s | 10s | Go |

### Worker Pool Hurts at Extreme Load

The worker pool that helped at 1000 VUs **hurts** at 2000 VUs:

| Metric | Go (no pool) | Go (worker pool) | Change |
|--------|--------------|------------------|--------|
| Success Rate | 99.05% | 95.08% | -4% |
| Failed Requests | 2,173 | 9,986 | +360% |
| Register Success | 92% | 59% | -33% |
| p95 Latency | 4.68s | 9.63s | +106% |

At extreme load, the worker pool creates a bottleneck. Requests queue up waiting for pool slots and timeout. Without the pool, Go lets all goroutines compete for CPU - chaotic but fewer hard timeouts.

## Per-Endpoint Success Rates

| Endpoint | Swift | Go | Go (worker pool) | Winner |
|----------|-------|-----|------------------|--------|
| POST /auth/register | 69% | 92% | 59% | Go |
| POST /auth/login | 96% | 99% | 95% | Go |
| GET /todos | 100% | 99% | 100% | Swift / Go (pool) |
| POST /todos | 100% | 99% | 100% | Swift / Go (pool) |
| GET /todos/:id | 100% | 99% | 100% | Swift / Go (pool) |
| PATCH /todos/:id | 100% | 99% | 100% | Swift / Go (pool) |
| DELETE /todos/:id | 100% | 99% | 100% | Swift / Go (pool) |

## Median Latency by Endpoint

| Endpoint | Swift | Go | Go (worker pool) | Winner |
|----------|-------|-----|------------------|--------|
| Register | 4,149ms | 3,041ms | 6,163ms | Go |
| Login | 1,840ms | 1,175ms | 2,056ms | Go |
| List | 16ms | 271ms | 80ms | Swift |
| Create | 32ms | 497ms | 97ms | Swift |
| Get | 10ms | 34ms | 39ms | Swift |
| Update | 39ms | 208ms | 112ms | Swift |
| Delete | 38ms | 84ms | 110ms | Swift |

## p95 Latency by Endpoint

| Endpoint | Swift | Go | Go (worker pool) | Winner |
|----------|-------|-----|------------------|--------|
| Register | 10,001ms | 10,001ms | 10,001ms | Tie |
| Login | 9,199ms | 5,530ms | 9,490ms | Go |
| List | 75ms | 3,954ms | 259ms | Swift |
| Create | 183ms | 4,186ms | 316ms | Swift |
| Get | 34ms | 1,604ms | 202ms | Swift |
| Update | 178ms | 3,440ms | 345ms | Swift |
| Delete | 172ms | 3,450ms | 339ms | Swift |

## Throughput by Endpoint

| Endpoint | Swift | Go | Go (worker pool) | Winner |
|----------|-------|-----|------------------|--------|
| Register | 49.3/s | 45.4/s | 38.2/s | Swift |
| Login | 47.6/s | 45.0/s | 36.6/s | Swift |
| List | 147.8/s | 135.1/s | 114.7/s | Swift |
| Create | 49.3/s | 45.2/s | 38.2/s | Swift |
| Get | 295.6/s | 270.5/s | 229.3/s | Swift |
| Update | 49.3/s | 44.9/s | 38.2/s | Swift |
| Delete | 49.3/s | 44.9/s | 38.2/s | Swift |

## Key Observations

1. **Go without worker pool handles extreme load best** - At 2000 VUs, Go (no pool) achieved 99.05% success rate vs Swift's 96.72% and Go (pool)'s 95.08%.

2. **Worker pool creates a chokepoint at high load** - The same optimization that helped at 1000 VUs hurts at 2000 VUs. Requests queue up and timeout waiting for pool slots.

3. **Swift's thread pool also becomes a bottleneck** - Register success dropped to 69%. The `NIOThreadPool` queues requests which then timeout.

4. **Go without pool degrades more gracefully** - Letting goroutines compete chaotically for CPU spreads the pain rather than concentrating failures on auth endpoints.

5. **Swift still wins on CRUD latency** - 17-53x faster p95 latency on non-auth endpoints. Redis caching remains highly effective.

6. **Auth endpoints are the bottleneck for all** - Register p95 hit 10s timeout across all configurations. Bcrypt at cost 10 cannot scale to 2000 concurrent users on this hardware.

7. **Worker pool improves CRUD success** - Go (pool) achieved 100% success on all CRUD endpoints vs Go (no pool)'s 99%.

## Comparison: 1000 VUs vs 2000 VUs

| Metric | Swift 1k | Swift 2k | Go 1k | Go 2k | Go (pool) 1k | Go (pool) 2k |
|--------|----------|----------|-------|-------|--------------|--------------|
| Success Rate | 100% | 96.72% | 99.80% | 99.05% | 100% | 95.08% |
| Throughput | 739 req/s | 711 req/s | 574 req/s | 637 req/s | 645 req/s | 561 req/s |
| p95 Latency | 1.96s | 6.22s | 2.4s | 4.68s | 2.17s | 9.63s |
| Register Success | 100% | 69% | 97% | 92% | 100% | 59% |

**Worker pool trade-off:** Helps at moderate load (1k VUs) by preventing CPU thrashing. Hurts at extreme load (2k VUs) by creating a queue bottleneck.

## Resource Usage

| Metric | Swift | Go | Go (worker pool) | Winner |
|--------|-------|-----|------------------|--------|
| **Network In** | 93 MB | 134 MB | 114 MB | Swift |
| **Network Out** | 103 MB | 101 MB | 88 MB | Go (pool) |

## Reproduction

See [BENCHMARK.md](./BENCHMARK.md) for instructions on running these benchmarks.

```bash
# Run 2000 VU benchmark
./benchmark/run.sh swift 2
./benchmark/run.sh go 2
```
