# Snip API — URL Shortener Backend

ASP.NET Core 8 Web API for the Snip URL shortener. PostgreSQL for durable
storage, Redis as a cache-aside layer on the redirect hot path, JWT bearer
authentication, and a background worker that persists click analytics
asynchronously.

## Architecture

```
                ┌─────────────┐
                │  Snip.Api   │  Controllers, JWT auth, rate limiting,
                │             │  redirect endpoint, Swagger
                └──────┬──────┘
                       │ references
                ┌──────▼──────────────────┐
                │  Snip.Infrastructure    │  EF Core (PostgreSQL), Redis cache,
                │                         │  click queue + background worker
                └──────┬──────────┬───────┘
                       │          │
                 ┌─────▼───┐  ┌───▼───┐
                 │PostgreSQL│  │ Redis │
                 └─────────┘  └───────┘
```

### Request flows

**Redirect** `GET /{slug}` (public, rate-limited to 120 req/min)
1. Look up the slug in Redis.
2. On a miss, query PostgreSQL (unique index on `slug`), then populate Redis (1h TTL).
3. Enqueue a click record on a bounded in-memory channel — the 302 goes back
   immediately without waiting on analytics I/O.
4. A `BackgroundService` drains the queue in batches, bulk-inserts click
   events, and bumps the denormalized click counters.

**Link management** `/api/links` (JWT required): create (custom alias or
generated), paginated search, toggle active, delete. Deleting or
deactivating a link invalidates its Redis entry immediately.

**Auth** `/api/auth`: register and login issue a signed JWT (HS256,
configurable expiry). Passwords are hashed with PBKDF2-SHA256 (100k
iterations, per-user salt).

**Analytics** `/api/analytics`: summary totals + top links, and per-day
click counts over a configurable window.

## Run it

Prerequisites: .NET 8 SDK, Docker.

```bash
cd backend

# Start PostgreSQL + Redis
docker compose up -d

# Restore, apply migrations (also auto-applied on startup in Development),
# seed the demo user, and run
dotnet run --project src/Snip.Api
```

The API listens on `http://localhost:8080`. Swagger UI is at
`http://localhost:8080/swagger` in Development.

### Demo login

The seeder creates a demo account matching the frontend demo:

- Email: `test@gmail.com`
- Password: `test`

### Configuration

| Setting | Env var | Notes |
|---|---|---|
| `ConnectionStrings__Default` | Postgres connection string | docker-compose default works out of the box |
| `ConnectionStrings__Redis` | Redis connection string | |
| `Jwt__Key` | Signing key | Dev default lives in `appsettings.Development.json` — **replace in production** |
| `App__BaseUrl` | Public base URL | Used to build short URLs in API responses |

## API reference

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | – | Create account → `{ token, email, displayName }` |
| POST | `/api/auth/login` | – | Sign in → `{ token, email, displayName }` |
| GET | `/api/auth/me` | JWT | Current user |
| POST | `/api/links` | JWT | Create link `{ destinationUrl, slug? }` |
| GET | `/api/links?search=&page=&pageSize=` | JWT | Paginated link list |
| GET | `/api/links/{id}` | JWT | One link |
| PATCH | `/api/links/{id}` | JWT | Toggle `{ isActive }` |
| DELETE | `/api/links/{id}` | JWT | Delete link |
| GET | `/{slug}` | – | Redirect (302), records a click |
| GET | `/api/analytics/summary` | JWT | Totals + top 5 links |
| GET | `/api/analytics/clicks?days=30` | JWT | Daily click counts |

## Migrations

```bash
dotnet tool install -g dotnet-ef
dotnet ef migrations add <Name> --project src/Snip.Infrastructure --startup-project src/Snip.Api
```
