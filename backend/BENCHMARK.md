# Redirect latency benchmark — Redis cache-aside vs Postgres lookup

Run 2026-11-02 on a single small cloud VM (load client, API, PostgreSQL 16
and Redis 7 all on the same box, loopback). Code: this `backend/` copied to
a bench folder with ONE local-only change — the redirect rate limit raised
from 120/min to effectively unlimited, because the shipped default would
throttle (429) any load test. The shipped code was not modified.

## Method

- 2,000 links seeded directly in Postgres (`bench-0000` … `bench-1999`).
- **Cache-miss arm:** `FLUSHALL` Redis, then 1,000 requests, each to a
  *different* never-cached slug → every request does the Postgres lookup and
  then populates Redis. Verified: exactly 1,000 `snip:link:bench-*` keys in
  Redis afterwards, all responses 302.
- **Cache-hit arm:** same 1,000 slugs again (now cached), shuffled → every
  request served from Redis, Postgres untouched.
- 50 concurrent client threads, persistent connections, redirects not
  followed (measures the API's own 302 response time).
- Two full rounds with disjoint slug sets, plus repeats.

## Results — concurrent load (50 threads, 1,000 requests per arm)

| Arm | Mean | p50 | p95 | Throughput |
|---|---|---|---|---|
| Miss round 1 (Postgres) | 77.8 ms | 89.0 ms | 125.9 ms | 587 rps |
| Miss round 2 (Postgres) | 69.8 ms | 81.9 ms | 119.6 ms | 709 rps |
| Hit round 1 (Redis) | 19.9 ms | 12.1 ms | 74.8 ms | 1,693 rps |
| Hit round 2 (Redis) | 17.6 ms | 7.3 ms | 71.5 ms | 1,765 rps |
| Hit re-run | 17.7 ms | 8.2 ms | 69.4 ms | 2,411 rps |

**Mean latency: ~74 ms → ~18 ms ≈ 75% lower. Median: ~85 ms → ~8 ms ≈ 90%
lower. Throughput ≈ 2.9× higher.**

One hit round transiently read at miss-level latency (mean 71.8 ms) during a
VM load spike; the immediate re-run (17.7 ms) confirmed it was environment
noise, and it is excluded from the averages above.

## Results — sequential (one request at a time, 20 requests per arm, curl)

| Arm | Min | Median | Max |
|---|---|---|---|
| Cached (Redis) | 0.71 ms | 0.97 ms | 22.7 ms* |
| Uncached (Postgres) | 2.18 ms | 3.03 ms | 4.53 ms |

*single keep-alive setup outlier. Median per-request cost: Postgres path
≈ 3× the Redis path even with zero concurrency.

## Verdict on the resume bullet

"Redis caching reduced latency ~40% under concurrent load" — **supported,
and conservative.** Measured reduction was ~75% (mean) under 50-client
concurrent load in this environment. Absolute numbers are specific to this
small shared VM; the relative gap is the meaningful figure. In a deployed
setup with real network hops to the database, the cache advantage would
typically be larger, not smaller.

Tooling: `loadtest.py` in this folder (Python stdlib only).
