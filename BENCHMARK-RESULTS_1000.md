# Benchmark Results: Swift (Hummingbird) vs Go (1000 VUs)

Comparison of a Todo API implemented in both Swift (Hummingbird) and Go, running identical workloads.

## Test Environment

- **Machine:** MacBook (Apple Silicon), 7.8 GB RAM available to Docker
- **Database:** PostgreSQL 18 (Alpine)
- **Cache:** Redis 7 (Alpine)
- **Load Testing:** k6 with 1000 virtual users peak
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
| **Success Rate** | 100% | 99.80% | 100% | Swift / Go (pool) |
| **Failed Requests** | 0 | 273 (0.19%) | 0 | Swift / Go (pool) |
| **Throughput** | 739 req/s | 574 req/s | 645 req/s | Swift |
| **Completed Iterations** | 12,811 | 10,159 | 11,179 | Swift |
| **Avg Latency** | 279ms | 423ms | 357ms | Swift |
| **Median Latency** | 18ms | 20ms | 60ms | Swift |
| **p95 Latency** | 1.96s | 2.4s | 2.17s | Swift |
| **p99 Latency** | 5.37s | 6.17s | 6.31s | Swift |

### Go Worker Pool Impact

The worker pool eliminated all request timeouts and improved Go's performance:

| Metric | Go (no pool) | Go (worker pool) | Change |
|--------|--------------|------------------|--------|
| Success Rate | 99.80% | 100% | Fixed timeouts |
| Throughput | 574 req/s | 645 req/s | +12% |
| Iterations | 10,159 | 11,179 | +10% |
| Register median | 2,005ms | 1,047ms | -48% |

## Per-Endpoint Success Rates

| Endpoint | Swift | Go | Go (worker pool) |
|----------|-------|-----|------------------|
| POST /auth/register | 100% | 97% | 100% |
| POST /auth/login | 100% | 99% | 100% |
| GET /todos | 100% | 99% | 100% |
| POST /todos | 100% | 99% | 100% |
| GET /todos/:id | 100% | 100% | 100% |
| PATCH /todos/:id | 100% | 100% | 100% |
| DELETE /todos/:id | 100% | 100% | 100% |

## Median Latency by Endpoint

| Endpoint | Swift | Go | Go (worker pool) | Winner |
|----------|-------|-----|------------------|--------|
| Register | 1,131ms | 2,005ms | 1,047ms | Go (pool) |
| Login | 1,083ms | 718ms | 936ms | Go |
| List | 14ms | 22ms | 62ms | Swift |
| Create | 30ms | 202ms | 80ms | Swift |
| Get | 9ms | 4ms | 28ms | Go |
| Update | 37ms | 27ms | 88ms | Go |
| Delete | 35ms | 9ms | 83ms | Go |

## p95 Latency by Endpoint

| Endpoint | Swift | Go | Go (worker pool) | Winner |
|----------|-------|-----|------------------|--------|
| Register | 5,636ms | 8,543ms | 6,602ms | Swift |
| Login | 5,502ms | 3,743ms | 6,530ms | Go |
| List | 70ms | 1,463ms | 243ms | Swift |
| Create | 175ms | 1,958ms | 312ms | Swift |
| Get | 33ms | 423ms | 176ms | Swift |
| Update | 173ms | 713ms | 331ms | Swift |
| Delete | 155ms | 230ms | 339ms | Swift |

## Throughput by Endpoint

| Endpoint | Swift | Go | Go (worker pool) | Winner |
|----------|-------|-----|------------------|--------|
| Register | 52.8/s | 40.9/s | 46.1/s | Swift |
| Login | 52.8/s | 40.9/s | 46.1/s | Swift |
| List | 158.4/s | 122.8/s | 138.2/s | Swift |
| Create | 52.8/s | 40.9/s | 46.1/s | Swift |
| Get | 316.8/s | 245.6/s | 276.4/s | Swift |
| Update | 52.8/s | 40.9/s | 46.1/s | Swift |
| Delete | 52.8/s | 40.9/s | 46.1/s | Swift |

## Key Observations

1. **Swift outperforms Go overall** - Swift achieved the highest throughput (739 req/s) and lowest p95 latency (1.96s).

2. **Go worker pool eliminates failures** - The worker pool fixed all timeout errors, achieving 100% success rate like Swift.

3. **Worker pool improves Go's register latency** - Register median dropped from 2,005ms to 1,047ms (-48%), now faster than Swift's 1,131ms.

4. **Swift dominates CRUD p95 latency** - 2-21x faster p95 latency on non-auth endpoints due to effective Redis caching.

5. **Go without pool wins on some median latencies** - But these gains disappear under load (p95) and come with timeout failures.

6. **Both frameworks are production-ready** - With optimizations, both achieved 100% success rate at 1000 VUs.

## Resource Usage

| Metric | Swift | Go | Winner |
|--------|-------|-----|--------|
| **CPU (avg)** | 756% | 645% | Go |
| **CPU (max)** | 1,032% | 1,051% | Swift |
| **Memory (max)** | 102 MiB | 84 MiB | Go |
| **Network In** | 67 MB | 82 MB | Swift |
| **Network Out** | 73 MB | 61 MB | Go |

Swift used ~17% more CPU on average to achieve 29% higher throughput - a favorable trade-off. Go was more memory-efficient, using ~18% less RAM.

## Optimizations Applied

### Swift

1. **Bcrypt on thread pool** - Moved `Bcrypt.hash()` and `Bcrypt.verify()` to `NIOThreadPool.singleton` to avoid blocking the async runtime
2. **Matched bcrypt cost** - Reduced from default 12 to 10 to match Go's `bcrypt.DefaultCost`

```swift
let passwordHash = try await NIOThreadPool.singleton.runIfActive {
    Bcrypt.hash(input.password, cost: 10)
}
```

### Go

Worker pool to limit concurrent bcrypt operations (2x CPU cores):

```go
var bcryptWorkerPool = make(chan struct{}, runtime.NumCPU()*2)

func HashPassword(password string) (string, error) {
    bcryptWorkerPool <- struct{}{} // acquire
    defer func() { <-bcryptWorkerPool }() // release
    
    bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
    return string(bytes), err
}
```

## Reproduction

See [BENCHMARK.md](./BENCHMARK.md) for instructions on running these benchmarks.
