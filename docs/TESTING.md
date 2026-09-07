# Testing

## Running the suite

```bash
npm test
```

51 tests across 9 files: pure unit tests for crypto, the Zoho field mapper,
and validation schemas, plus integration tests that exercise the real
Express app end-to-end via `supertest` for every endpoint, including all
14 scenarios called out in the spec (registration, login, Zoho OAuth,
employee creation, agent enrollment, device auth, activity batch, Zoho
sync, retry, tenant isolation, unauthorized device, invalid organization,
duplicate activity, disabled device).

## Why the integration tests don't hit a real Postgres

`prisma generate` and `prisma migrate` need to download a native query
engine binary from Prisma's own CDN (`binaries.prisma.sh`) the first time
they run for a given engine version/platform. In whatever environment
you're reading this in, that's a normal one-time download over ordinary
outbound internet access and will just work - see "Local setup" in the
README. It was **not** reachable from the sandboxed environment this
project was originally built in (an egress allowlist that didn't include
that host), so `tests/fakePrisma.js` exists to get real coverage anyway:
an in-memory stand-in for `@prisma/client` that implements exactly the
query shapes this project's own repositories issue (`findUnique`,
`findFirst`, `findMany`, `create`, `update`, `updateMany`, `upsert`,
`count`, `groupBy`, plus `include` for the two relations actually used -
`device.employee` and `deviceToken.device`). It is not a general Prisma
reimplementation and doesn't try to be.

Every integration test file does:

```js
jest.mock('../../src/config/prisma', () => {
  const { createFakePrisma } = require('../fakePrisma');
  return { prisma: createFakePrisma() };
});
```

before requiring anything else, so the real repository/service/controller
code runs completely unmodified against the fake - only the bottom-most
layer (actual SQL execution) is swapped out. This is not a weaker
substitute for integration testing; it's the same technique most
Prisma+Express projects use for fast tests regardless of network access,
because a real Postgres round trip through Prisma's engine is slow to
spin up for every test run. It found and fixed three real bugs during
development (documented in git-blame-able commits / commit messages if
you set this up as a repo): two places where application code silently
relied on a Prisma schema `@default(...)` for a value that later fed into
authorization or retry-count arithmetic, and one place where a device
token's `revokedAt`/`nextRetryAt` fields needed `null`-vs-`undefined`
handling that matches how Postgres actually returns an unset nullable
column. All three are now explicit in the application code itself, not
just in the test fake.

## Running against a real database

Once `prisma generate` can reach the network normally:

```bash
cp .env.example .env        # fill in DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY, etc.
npm run prisma:generate
npm run prisma:migrate      # creates bridge_backend and bridge_backend_test locally
npm run prisma:seed         # bootstraps one SUPER_ADMIN from SUPER_ADMIN_EMAIL/PASSWORD
npm start
```

If your own CI or deployment environment has similarly restricted egress,
Prisma supports pointing the engine download at a different host via
`PRISMA_ENGINES_MIRROR=<your-mirror-url>` - worth setting up a mirror
proactively if you know your production environment will be locked down
the same way.

## What's not covered

The repository layer's actual Prisma query construction (the ~150 lines
across `src/models/*.js`) is exercised through the fake, not through real
SQL. Each function is a thin, direct passthrough to a single documented
Prisma call with no branching logic of its own, which is about the
lowest-risk shape of code there is - but it's still worth running
`npm run prisma:migrate` once against a real local Postgres and clicking
through the Postman collection before a first production deploy, simply
because "the fake matches Prisma's real behavior" is an assumption, not
something this suite can verify about itself.
