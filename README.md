# Monetari Crypto Price Service

A high-performance cryptocurrency price query service built with NestJS. Fetches real-time prices from CoinGecko and intelligently batches concurrent requests — multiple queries for the same asset are grouped into a single external API call.

## Key Features

- **Request Batching** — Concurrent price queries are grouped and served with a single API call
- **Race Condition Safe** — Inflight request deduplication prevents duplicate API calls during flush window
- **In-Memory Cache** — 5-second TTL cache prevents redundant external API calls; cache hits skip DB writes
- **JWT Authentication** — Signup/login flow with bcrypt password hashing; no hardcoded fallback secrets
- **Input Validation** — Coin ID format validation via custom pipe
- **Rate Limiting** — 30 requests/minute per client via `@nestjs/throttler`
- **Security Hardened** — Helmet headers, configurable CORS origin, env-driven secrets
- **Production Ready** — Shutdown hooks, env-driven DB synchronize, optimized Docker image (no dev deps)
- **Price History** — Query historical price records with date filtering and pagination
- **Health Check** — `/health` endpoint with live database connectivity check
- **Swagger UI** — Interactive API documentation at `/api/docs`
- **Structured Logging** — JSON-formatted logs via Pino (single logging layer, no duplicates)
- **Dockerized** — Full stack runs with a single command via `env_file`

## Quick Start

### Docker (Recommended)

```bash
docker-compose up --build
```

The API will be available at `http://localhost:3000` and Swagger at `http://localhost:3000/api/docs`.

### Local Development

```bash
cp .env.example .env          # Configure environment variables

npm install
npm run start:dev              # http://localhost:3000
```

> Requires a running PostgreSQL instance. See `.env.example` for connection details.

## API Usage

```bash
# Register
curl -X POST http://localhost:3000/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username": "demo", "password": "demo123456"}'

# Login
curl -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "monetari", "password": "monetari123"}'

# Get current price (requires Bearer token)
curl http://localhost:3000/v1/price/bitcoin \
  -H "Authorization: Bearer <TOKEN>"

# Get price history
curl "http://localhost:3000/v1/price/bitcoin/history?limit=10" \
  -H "Authorization: Bearer <TOKEN>"
```

A default user (`monetari` / `monetari123`) is seeded on first startup.

## How Batching Works

```
Request 1 (bitcoin) ──┐
Request 2 (bitcoin) ──┼── Queue ── 5s timeout OR 3 requests ── Single API call ── Resolve all
Request 3 (bitcoin) ──┘
```

Every incoming request passes through a **3-layer deduplication** before reaching the external API:

| Layer | Check | Result |
|---|---|---|
| **1. Cache** | TTL (5s) still valid? | Return cached data instantly, skip DB write |
| **2. Inflight** | API call already in progress? | Await the same promise — no new call |
| **3. Batch** | Existing queue for this coin? | Add to queue; flush on timeout or threshold |

| Trigger | Behavior |
|---|---|
| **Timeout** (5s) | All queued requests for a coin are flushed after 5 seconds |
| **Threshold** (3) | If 3 requests queue up, flush immediately without waiting |
| **Independence** | Each coin has its own isolated batch queue |

Both the timeout and threshold are configurable via environment variables.

### Why Inflight Tracking?

Without it, there's a race condition: after `flush()` deletes the batch but before the API responds and populates the cache, new requests see neither a batch nor a cache entry — causing a **duplicate API call**. The inflight layer closes this gap.

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `3000` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USERNAME` | PostgreSQL user | `monetari` |
| `DB_PASSWORD` | PostgreSQL password | `monetari_secret` |
| `DB_DATABASE` | Database name | `monetari_crypto` |
| `DB_SYNCHRONIZE` | Auto-sync schema (disable in prod) | `false` |
| `JWT_SECRET` | JWT signing key (**required**) | — |
| `JWT_EXPIRES_IN` | Token expiration | `1h` |
| `COINGECKO_API_URL` | CoinGecko base URL | `https://api.coingecko.com/api/v3` |
| `COINGECKO_API_KEY` | CoinGecko Demo API key | — |
| `BATCH_WAIT_TIME_MS` | Batch window (ms) | `5000` |
| `BATCH_THRESHOLD` | Immediate flush threshold | `3` |
| `CACHE_TTL_MS` | Cache time-to-live (ms) | `5000` |
| `CORS_ORIGIN` | Allowed CORS origins (comma-separated) | `*` |
| `SEED_USERNAME` | Default seed user username | `monetari` |
| `SEED_PASSWORD` | Default seed user password | `monetari123` |

## Testing

```bash
npm run test          # Unit tests (16 specs)
npm run test:e2e      # E2E tests (6 specs, requires PostgreSQL)
npm run test:cov      # Coverage report
```

### Test Coverage

| Suite | Tests | Covers |
|---|---|---|
| `price-batcher.service.spec` | 8 | Batch flush (timeout & threshold), multi-coin isolation, error propagation, cache hit/miss, inflight race condition |
| `price.service.spec` | 3 | Current price fetch + DB persist, cache hit skips DB write, history query with filters |
| `auth.service.spec` | 5 | Signup (success + conflict), login (success + wrong user + wrong password) |
| `app.e2e-spec` | 6 | Health check, login/signup, auth guard, price endpoints, history |

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS |
| Language | TypeScript (strict mode) |
| Database | PostgreSQL + TypeORM |
| Auth | JWT + Passport + bcrypt |
| Validation | class-validator + custom pipes |
| Security | Helmet + CORS + Throttler |
| Docs | Swagger / OpenAPI |
| Logging | Pino (nestjs-pino) |
| HTTP Client | Axios |
| Testing | Jest + Supertest |
| Container | Docker + docker-compose |

## Project Structure

```
src/
├── auth/               # Authentication (signup, login, JWT)
├── price/              # Price module (batching, CoinGecko, history)
├── health/             # Health check endpoint
├── common/             # Shared (guards, filters, pipes, decorators)
├── config/             # Centralized configuration + validation
├── app.module.ts
└── main.ts
```
