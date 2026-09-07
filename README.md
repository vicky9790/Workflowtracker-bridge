# Bridge Backend

Multi-tenant Node.js/Express service that sits between the existing
TrackFlow Electron Agent and each organization's own Zoho Creator account.

```
Electron Agent → HTTPS → Bridge Backend → per-organization Zoho Creator
```

The Agent's monitoring/collection logic (browser, application, keyboard,
mouse, work-session, screenshot tracking, SQLite queue, batching) is
completely unchanged by this project - only its API/sync destination
changes. See `docs/AGENT_INTEGRATION.md` for the exact, verified diff.

## Project structure

```
bridge-backend/
├── src/
│   ├── controllers/     one file per resource, thin - validation done by middleware
│   ├── routes/          Express routers, mounted in routes/index.js
│   ├── middleware/      auth (admin JWT), deviceAuth (Agent token), rateLimit, validate, errorHandler
│   ├── services/
│   │   ├── zoho/        OAuth flow, ZohoService (REST + custom-API client), field mapper
│   │   ├── enrollment/  org/employee validation, device issuance
│   │   ├── auth/        org admin register/login, JWT issuance
│   │   ├── sync/        durable enqueue + background retry worker
│   │   └── audit/       audit log writer
│   ├── models/          repository layer - every query takes organizationId, tenant isolation lives here
│   ├── utils/           crypto, errors, response envelope, zod schemas
│   ├── config/          env, logger, Prisma client singleton
│   ├── app.js           Express app assembly (no listen())
│   └── server.js        process entrypoint
├── prisma/
│   ├── schema.prisma
│   └── seed.js           bootstraps one SUPER_ADMIN
├── tests/
│   ├── unit/              pure-function tests, no mocking
│   ├── integration/        full HTTP-layer tests via supertest
│   └── fakePrisma.js       in-memory Prisma stand-in used by every integration test - see docs/TESTING.md
├── postman/
│   └── bridge-backend.postman_collection.json
├── docs/
│   ├── API.md              every endpoint, request/response shapes, error codes
│   ├── DEPLOYMENT.md        production setup, scaling notes
│   ├── AGENT_INTEGRATION.md exact Electron Agent diff
│   └── TESTING.md           how the test suite works and how to run it against a real DB
├── .env.example
├── Dockerfile
├── docker-compose.yml       app + local Postgres
└── package.json
```

## Local setup

```bash
npm install
cp .env.example .env
# fill in JWT_SECRET, ENCRYPTION_KEY (openssl rand -hex 32, twice),
# ZOHO_CLIENT_ID/SECRET/REDIRECT_URI from api-console.zoho.com,
# DATABASE_URL (or just start the docker-compose postgres service)

docker compose up -d postgres          # or point DATABASE_URL at any Postgres 14+
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed                    # bootstraps SUPER_ADMIN_EMAIL/PASSWORD

npm run dev                            # nodemon, or `npm start` for a plain run
curl http://localhost:3000/health
```

Then import `postman/bridge-backend.postman_collection.json` and run
through Organizations → Zoho → Employees → Agent - Enrollment → Agent -
Activity in order; each request stores what the next one needs in
collection variables automatically.

## Tests

```bash
npm test
```

51 tests, all passing, covering every endpoint and all 14 scenarios from
the spec (see `docs/TESTING.md` for exactly how - short version: real
HTTP requests through the real Express app, with only the database layer
swapped for an in-memory fake, because this specific project's build
environment couldn't reach Prisma's engine-binary CDN; your environment
almost certainly can).

## Build phases (as delivered)

1. **Foundation** - Express/Prisma project, Organization/Employee/Device
   models, JWT + device-token auth.
2. **Enrollment** - org code + employee validation, device
   create-or-re-enroll, token issuance, heartbeat.
3. **Zoho** - OAuth connect/callback/status/disconnect, encrypted refresh
   token storage, `ZohoService` (REST v2.1 primitives + custom-API
   calling), per-organization access-token cache.
4. **Activity** - all 7 event endpoints + batch, durable enqueue
   (never blocks on Zoho), idempotent on the Agent's own `event_id`,
   background retry worker with exponential backoff and rate-limit
   awareness, dead-letter after `SYNC_MAX_ATTEMPTS`.
5. **Hardening** - structured logging with secret redaction, rate
   limiting, full test suite, Docker/Compose, deployment docs.

Known first-version scope limits (each with a one-line fix path) are
listed at the bottom of `docs/API.md` and in the "Scaling beyond one
instance" section of `docs/DEPLOYMENT.md` - none of them are silent; all
are things to revisit before running this at real multi-instance scale,
not things this version got wrong.
# Workflowtracker-bridge
