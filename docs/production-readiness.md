# Cadence API Production Readiness

## Required Before Public Production

1. Configure secrets outside the repository.

Use `.env.example` as the contract, but keep real values only in the deployment
platform secret store. `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
and `CORS_ORIGINS` are required for a real production deployment.

2. Protect the Postgres database.

Use the provider secret store for `DATABASE_URL`. Backups, restore tests,
connection limits, and migration rollback planning are operational requirements
before accepting real user data.

3. Put a trusted proxy in front of Bun.

Terminate TLS at the platform/proxy layer, forward only expected headers, and do
not expose debug tooling. The app sets defensive response headers and sanitized
errors, but TLS and process supervision belong to the runtime platform.

4. Keep CORS narrow.

Production startup fails without `CORS_ORIGINS`. Add only browser origins that
must call this API. Native app traffic should authenticate with bearer tokens and
usually does not need CORS.

5. Audit dependencies in CI.

`bun pm scan` currently requires a scanner configured in `bunfig.toml`. Before
production, wire a scanner or equivalent CI dependency audit and fail builds on
high/critical vulnerabilities.

6. Revisit rate limiting if scaling beyond one process.

The current limiter is in-memory and protects a single API process. For multiple
instances, move buckets to Redis or another shared store so brute-force limits
apply across replicas.

## Current App-Level Protections

- Better Auth owns password hashing and bearer sessions.
- Production requires `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and
  `CORS_ORIGINS`.
- Production database access uses Postgres through `DATABASE_URL`.
- Development logs omit payloads, cookies, and authorization tokens.
- Production logs and stack traces are not exposed by the app logger.
- Authenticated routes derive `userId` from the session guard.
- User-owned resources are filtered by `userId`; cross-user access returns 404.
- CORS is restricted to configured origins.
- Security headers are set on responses.
- Mutating requests are rejected when `Content-Length` exceeds
  `MAX_BODY_BYTES`.
- Login/register have stricter rate limits than general API traffic.
- Route inputs use bounded strings and stricter date/color formats.
