# Snip — URL Shortener

A minimal, clean demo of a URL shortener. Shorten links, track clicks, and
browse simple analytics.

## Demo login

The login form is pre-filled with the demo account — just hit **Sign in**:

- Email: `test@gmail.com`
- Password: `test`

## Frontend

Run `npm i` to install the dependencies.

Run `npm run dev` to start the development server.

## Backend (`backend/`)

A real ASP.NET Core 8 API lives in `backend/`: JWT authentication, link
management, Redis cache-aside redirects, and async click analytics backed by
PostgreSQL. See [backend/README.md](backend/README.md) for the architecture
and run instructions.

Quick start (requires .NET 8 SDK and Docker):

```bash
cd backend
docker compose up -d   # PostgreSQL + Redis
dotnet run --project src/Snip.Api
```

The backend seeds the same demo account (`test@gmail.com` / `test`).
