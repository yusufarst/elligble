**Status:** ACTIVE (DEC-042), operational reference for the current release
**Canonical:** YES for deployment and operations procedure. Does not override LOCKED decisions; open blockers are tracked only in `PRODUCTION_COMPLETION_PLAN.md`.
**Last Updated:** 2026-09-29

# ELLIGBLE Operations Runbook

## 1. Deployment shape

```text
Browser ──HTTPS──> reverse proxy (TLS, HSTS) ──HTTP──> elligble container :3000 ──> PostgreSQL 16
                                                      (API + built web client, one origin)
```

- One Node 24 process serves `/api/*`, `/healthz`, `/readyz` and the built web client (`Dockerfile`, image user `node`).
- HTTPS is mandatory: the session cookie is `__Host-elligble_session` with `Secure`, `HttpOnly`, `SameSite=Strict`. The proxy must forward the original `Host` and should set `X-Request-ID`.
- Configuration is environment only; every variable is validated at startup (`.env.example`). Secrets (database password) come from the platform's secret store or `PGPASSWORD`, never from files in the repository.

## 2. Release procedure

1. Build: `docker build -t elligble:<version> .` (CI builds and smoke-tests the image on every push).
2. Back up the database (section 5) before any release that adds migrations.
3. Migrate, as a release step:
   `docker run --rm -e DATABASE_URL=... -e PGPASSWORD=... elligble:<version> node runtime/secure-assessment/src/ops/migrate-cli.ts`
   Single-node installations may instead set `SA_MIGRATIONS_ON_START=apply` (advisory-locked, safe with concurrent starts).
4. Start the new container. With the default `SA_MIGRATIONS_ON_START=check` it refuses to start while migrations are pending (`preflight_failed`, `reason: pending_migrations`) and waits up to `SA_STARTUP_DB_WAIT_SECONDS` for the database.
5. Verify: `GET /readyz` returns `{"status":"ready"}`; the login page loads; `POST /api/v1/auth/login` with a wrong password returns 401.
6. Switch traffic; stop the old container with `SIGTERM` (in-flight requests finish, then `shutdown_complete`).

Do not deploy during an active exam window unless the release is an incident fix: students keep answering locally, but saves and submissions pause while the service restarts.

## 3. Health, logs and correlation

| Endpoint | Meaning |
|---|---|
| `GET /healthz` | process alive (container `HEALTHCHECK`) |
| `GET /readyz` | database reachable (`SELECT 1`); 503 otherwise |

Logs are JSON lines on stdout/stderr: `runtime_starting` (configuration summary without secrets), `static_site_loaded`, `migrations_verified`, `runtime_started`, one `http_request` per request (`requestId`, `kind`, `method`, `path`, `status`, `durationMs`), `request_failed` (error class and code only), `preflight_failed`, `shutdown_complete`. Requests answered with 5xx are logged at `ERROR`.

Never logged: query strings (attempt ids), request or response bodies, cookies, `Authorization`, passwords, database URLs. Every response carries `X-Request-ID`; quote it when reporting a problem.

## 4. Rollback

- Code-only release: redeploy the previous image.
- Release with migrations: migrations are forward-only. The previous image refuses to start on a database that has migrations it does not know (`reason: unknown_migrations`). Roll forward with a fix, or restore the pre-release backup (section 5) and redeploy the previous image. Restoring loses writes made after the backup, so during an exam window prefer rolling forward.

## 5. Backup and restore

- Backup: `pg_dump --format=custom --no-owner --file=elligble-<date>.dump "$DATABASE_URL"` at least daily and before every release with migrations; keep copies off the database host; encrypt at rest.
- Restore drill: restore into a scratch database with `pg_restore --no-owner --dbname=<scratch> elligble-<date>.dump`, run `migrate:check` against it, start a container on it and confirm `/readyz` and a test login.
- PB11 (backup and restore verification) stays OPEN until the drill has been executed on the production infrastructure and its evidence recorded in the plan. Retention periods are an Owner/legal decision (PB02).

## 6. Incident basics

1. Check `/readyz` and the container state; then `ERROR` log lines, grouped by `requestId`.
2. Database unavailable: students' answers stay in their browsers and are re-sent automatically once the service is back; the server timer keeps running (server-authoritative).
3. Security incident: preserve logs, rotate the database password, and revoke sessions if needed (`UPDATE identity_sessions SET is_revoked = TRUE WHERE ...`; revoked sessions fail closed on the next request). There is no administration screen for this yet. The incident response owner, notification duties and contact list are part of PB12 (Owner decision).

## 7. Local development

`runtime/secure-assessment`: `npm run migrate`, `node test/support/seed-demo.ts` (demo accounts documented there), `ELLIGBLE_ENV=development node src/main.ts`. `frontend/web`: `npm run dev` (Vite proxies `/api` to port 3000). Integration tests: `ELLIGBLE_TEST_DATABASE_URL=postgresql://user@host/postgres npm run test:integration`.
