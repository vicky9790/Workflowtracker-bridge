# Deployment

## 1. Provision Postgres

Any managed Postgres 14+ works (RDS, Cloud SQL, Neon, Supabase, etc.), or
run the `postgres` service in `docker-compose.yml` on a box you manage
yourself. Note the connection string for `DATABASE_URL`.

## 2. Generate secrets

```bash
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # ENCRYPTION_KEY - must stay exactly this, 32 bytes hex
```

Losing `ENCRYPTION_KEY` after organizations have connected Zoho means
every stored refresh token becomes permanently undecryptable - back it up
somewhere durable (a secrets manager, not a `.env` file in git) before
your first real deployment.

## 3. Zoho API Console

Create one OAuth client at https://api-console.zoho.com (or `.in`/`.eu` to
match your primary data center) of type "Server-based Applications".
Redirect URI must exactly match `ZOHO_REDIRECT_URI`
(`https://<your-domain>/api/zoho/callback`). One client is shared across
every organization that connects through this Bridge - what's
per-organization is each org's own `account_owner_name`/`app_link_name`
and the refresh token they grant during `/api/zoho/connect`, not the
OAuth client itself.

## 4. Environment

Fill in `.env` from `.env.example`. Every variable under "REQUIRED - core"
must be set or the process refuses to start (`assertRequiredEnv()` in
`src/config/env.js` exits immediately with a clear message rather than
failing confusingly on the first request that needs a missing secret).

## 5. Migrate and seed

```bash
npm ci
npx prisma migrate deploy   # applies migrations, does not prompt, safe for CI/CD
npm run prisma:seed         # bootstraps SUPER_ADMIN_EMAIL/PASSWORD from .env
```

## 6. Run

**Docker:**
```bash
docker compose up -d --build
```

**Bare process (behind your own reverse proxy / TLS terminator):**
```bash
npm ci --omit=dev
npx prisma generate
NODE_ENV=production node src/server.js
```
Put this behind a process manager (systemd, pm2) so it restarts on crash,
and behind a reverse proxy (nginx, Caddy, your cloud LB) that terminates
TLS - the app itself speaks plain HTTP; `API_BASE_URL`/`ZOHO_REDIRECT_URI`
should be the `https://` public URL the proxy exposes.

## 7. Verify

```bash
curl https://your-domain/health
# {"status":"ok","database":"connected",...}
```

Then walk the Postman collection (`postman/bridge-backend.postman_collection.json`)
against the real deployment: register an organization, connect Zoho,
create an employee, enroll a device, submit one activity event, confirm
`GET /api/sync/status` shows it move from `PENDING` to `SUCCESS` within
`SYNC_WORKER_INTERVAL_MS`.

## Scaling beyond one instance

Two things in this first version assume a single process and need
attention before running more than one instance behind a load balancer:

- **Zoho access-token cache** (`src/services/zoho/zohoService.js`) is an
  in-process `Map`. With multiple instances, each would independently
  refresh tokens more often than necessary (wasted Zoho API calls, not a
  correctness bug) - move this to Redis if you scale out.
- **Retry worker** (`src/services/sync/retryWorker.js`) runs on a
  `setInterval` in every process. With multiple instances, more than one
  could claim the same due row in the same moment (the fake and the real
  Prisma `claimDue` query aren't currently wrapped in a claim-and-lock
  transaction). Either run the worker in exactly one dedicated instance
  (a separate `node -e "require('./src/services/sync/retryWorker').start()"`
  process, HTTP servers elsewhere with the worker disabled), or add
  `SELECT ... FOR UPDATE SKIP LOCKED` semantics to `claimDue` before
  scaling the worker itself horizontally.

## Rotating the Zoho OAuth client secret

Update `ZOHO_CLIENT_SECRET` and restart. Existing organizations' stored
refresh tokens remain valid - they're tied to the authorization grant, not
the client secret used to redeem them for access tokens - so no
organization needs to reconnect.
