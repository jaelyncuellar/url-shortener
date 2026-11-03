#!/usr/bin/env python3
"""Load test for Snip redirect endpoint: cache-miss vs cache-hit latency.

Stdlib only. Each worker thread keeps a persistent HTTP connection.
Redirects are NOT followed; we measure the 302 response time, which is
the API's own work (Redis lookup and/or Postgres lookup + cache write).
"""
import http.client
import json
import random
import statistics
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor

HOST, PORT = "localhost", 8080
CONCURRENCY = 50
N = 1000


def make_conn():
    return http.client.HTTPConnection(HOST, PORT, timeout=30)


thread_local = threading.local()


def fetch(slug):
    """One timed GET. Returns (status, latency_ms)."""
    conn = getattr(thread_local, "conn", None)
    if conn is None:
        conn = make_conn()
        thread_local.conn = conn
    start = time.perf_counter()
    try:
        conn.request("GET", f"/{slug}", headers={"User-Agent": "snip-loadtest"})
        resp = conn.getresponse()
        resp.read()
        status = resp.status
    except Exception:
        # Reconnect once on a broken keep-alive connection.
        try:
            conn.close()
        except Exception:
            pass
        conn = make_conn()
        thread_local.conn = conn
        conn.request("GET", f"/{slug}", headers={"User-Agent": "snip-loadtest"})
        resp = conn.getresponse()
        resp.read()
        status = resp.status
    return status, (time.perf_counter() - start) * 1000.0


def run_arm(label, slugs):
    with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
        t0 = time.perf_counter()
        results = list(pool.map(fetch, slugs))
        wall = time.perf_counter() - t0
    lat = sorted(ms for _, ms in results)
    statuses = {}
    for s, _ in results:
        statuses[s] = statuses.get(s, 0) + 1

    def pct(p):
        return lat[min(len(lat) - 1, int(len(lat) * p))]

    out = {
        "arm": label,
        "n": len(lat),
        "statuses": statuses,
        "mean_ms": round(statistics.mean(lat), 3),
        "p50_ms": round(pct(0.50), 3),
        "p95_ms": round(pct(0.95), 3),
        "p99_ms": round(pct(0.99), 3),
        "max_ms": round(lat[-1], 3),
        "throughput_rps": round(len(lat) / wall, 1),
        "wall_s": round(wall, 2),
    }
    print(json.dumps(out), flush=True)
    return out


def main():
    mode = sys.argv[1]  # warmup list comes from stdin-independent args
    if mode == "warmup":
        slugs = [f"bench-{i:04d}" for i in range(1000, 1060)]
        with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
            list(pool.map(fetch, slugs))
        print("warmup done", flush=True)
    elif mode == "miss":
        lo = int(sys.argv[2])
        slugs = [f"bench-{i:04d}" for i in range(lo, lo + N)]
        run_arm(f"miss[{lo}-{lo + N - 1}]", slugs)
    elif mode == "hit":
        lo = int(sys.argv[2])
        slugs = [f"bench-{i:04d}" for i in range(lo, lo + N)]
        random.Random(42).shuffle(slugs)
        run_arm(f"hit[{lo}-{lo + N - 1}]", slugs)


if __name__ == "__main__":
    main()
