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

Logs are JSON lines on stdout/stderr: `runtime_starting` (configuration summary without secrets), `static_site_loaded`, `migrations_verified`, `runtime_started`, one `http_request` per request (`requestId`, `kind`, `method`, `path`, `status`, `durationMs`), `request_failed` (error class and code only), `preflight_failed`, `expired_attempts_finalized` (count), `expiry_finalization_failed` (error class and code, retried on the next sweep), `shutdown_complete`. Requests answered with 5xx are logged at `ERROR`.

Time expiry: every `SA_EXPIRY_SWEEP_SECONDS` (default 15) the process finalizes started attempts whose server deadline passed without a submission, from the answers the server accepted (D04.5-47). The submission records what finalized it (`finalization_source`: `STUDENT_SUBMIT`, `EXPIRY_CLIENT` when the student's device did it, `EXPIRY_SERVER` when the device was away; `EXPIRY_SERVER` is where answers may still wait on the device, D04.5-48). Concurrent instances are safe: busy attempts are skipped and each attempt is finalized once.

Pause and end (Owner decision 2026-09-30): the managing teacher can pause ("Jeda Ujian"), resume ("Lanjutkan Ujian") and end ("Akhiri Ujian") a running exam. A pause freezes every started attempt's remaining time at the recorded boundary (`secure_assessment_exam_pauses`), so the sweep never finalizes an attempt during a pause and a resume continues from exactly the same remaining time; while paused no new start, question content, answer change, review mark or submission is accepted, except an answer the student chose before the boundary. End stops new starts only: running attempts finish by submission or by the sweep at their own deadline, and no result becomes visible to students. Each change is in `secure_assessment_exam_lifecycle_events` with the teacher who made it; a repeated request changes nothing. Student devices ask for the exam state (`GET /api/v1/assessment/timer`) about every 15 s, and every 5 s while the exam is paused; plan capacity for that during large sittings. To check an exam: `SELECT lifecycle_state FROM secure_assessment_exam_instances WHERE id = '<exam>'` and `SELECT paused_at, resumed_at FROM secure_assessment_exam_pauses WHERE exam_instance_id = '<exam>' ORDER BY paused_at`.

Participant lock (D04.6-38/39): the assigned proctor (in their rooms when the exam uses rooms) or the managing teacher can lock one working participant from "Lihat Peserta" or "Pantau Peserta" ("Kunci") and unlock them directly ("Buka Kunci"). A lock does not stop the time: while locked, the student sees no question content and no answer change, mark or submission is accepted, except an answer chosen before the lock; if the time runs out, the sweep finalizes the attempt as usual. Each lock is one row in `secure_assessment_attempt_locks` with who locked and unlocked it and when (never deleted); a repeated request changes nothing. A locked device asks for its state about every 5 s. To check a participant: `SELECT locked_at, locked_by_person_id, unlocked_at, unlocked_by_person_id FROM secure_assessment_attempt_locks WHERE exam_attempt_id = '<attempt>' ORDER BY locked_at`.

Messages to participants (D04.6-49..55): the same supervisors can send a short message ("Kirim Pesan") to the entire exam, one of their rooms or chosen participants; a proctor limited to rooms never reaches the entire exam. Recipients are fixed when the message is sent: everyone in the target who has not submitted. Each message is one row in `secure_assessment_exam_broadcasts` (sender, target, text, time; never changed) with one row per recipient in `secure_assessment_exam_broadcast_recipients`, whose `delivered_at` is set once when the student's device confirms receiving it; nothing records whether it was read. A sender can send one message per exam every 15 s and at most 20 per exam in an hour (HTTP 429 with `Retry-After` otherwise). Devices learn of new messages through the `messageCount` in their regular timer request and fetch them only then, so messages add no steady load. To check an exam's messages: `SELECT b.sent_at, b.target_scope, b.message, count(r.*) AS recipients, count(r.delivered_at) AS delivered FROM secure_assessment_exam_broadcasts b JOIN secure_assessment_exam_broadcast_recipients r ON r.broadcast_id = b.id WHERE b.exam_instance_id = '<exam>' GROUP BY b.id ORDER BY b.sent_at`.

Result finalization: once an ended exam has no attempt still running, the managing teacher finalizes it ("Finalisasi Hasil"). The results are then frozen in `secure_assessment_exam_result_finalizations` (who, when, scoring rule) and `secure_assessment_attempt_results` (one row per participant; ABSENT for those who did not work on it); both tables refuse updates and deletes, so a finalized result cannot be changed by editing data. Finalization publishes nothing to students.

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

## 7. Provisioning a pilot school

Platform staff provision pilot schools with the operator CLI (D02.2-27/28). Every change is validated first (`--dry-run` shows the per-row outcome without writing), applied in one transaction, and recorded in the append-only `platform_provisioning_events` with `--operator` and `--case`; summaries hold counts only. Example templates (fictitious data) are in `docs/production/provisioning-templates/`.

```text
node runtime/secure-assessment/src/ops/provision-cli.ts <command> ... --operator "<name>" --case "<ticket>"
  school create      --label "SMA Negeri 1 Contoh" --time-zone Asia/Jakarta
  school set-time-zone --tenant <id> --time-zone Asia/Makassar
  people import      --tenant <id> --file people.csv --sheet kartu.html [--dry-run] [--link-existing] [--valid-days 7] [--app-url https://...] [--time-zone <IANA>]
  academic import    --tenant <id> --file academic.json [--dry-run]
  exam import        --tenant <id> --file exam.json --questions questions.csv [--dry-run]
  activation reissue --tenant <id> --elligble-id <id> --sheet kartu-baru.html [--full-name "..."]
```

In the container: `docker run --rm -v "$PWD:/work" -w /work -e DATABASE_URL -e PGPASSWORD elligble:<version> node /app/runtime/secure-assessment/src/ops/provision-cli.ts ...`.

- **School time zone** (D04.2-36): every school has an explicit IANA zone, `Asia/Jakarta` (WIB), `Asia/Makassar` (WITA) or `Asia/Jayapura` (WIT). Exam times are shown in it on every device, whatever zone the device is set to; activation cards show their expiry in it unless `--time-zone` is given. `school set-time-zone` corrects it (audited); stored exam times are instants and do not move. Schools created before migration 0043 have no zone until it is set, and their times show in each device's zone.
- **People** (`elligble_id,full_name,kind`, kind `student`, `teacher` or `staff`): accounts start activation-required; each new person gets a single-use activation code on a printable card (`--sheet`, written owner-only, never overwritten). Names only label the cards and are not stored. Print the cards, hand them out, delete the file. There is never a password list (D02.7-38..41). An ELLIGBLE ID that already exists outside the school is linked only with `--link-existing` after confirming it is the same person (D02.7-16..21). Re-running an unchanged file changes nothing.
- **Activation**: the person opens the app, chooses "Belum pernah masuk? Aktifkan akun dengan kode aktivasi" and sets their own password. Codes expire (default 7 days, 1 to 30), die after use and after 10 wrong tries. A lost card or forgotten password: `activation reissue` (ends the old password, code and sessions).
- **Academic setup** (`elligble-academic-v1`): year, periods, grades, groups, subjects, offerings, teaching assignments (teachers must be imported with kind `teacher`), enrollments. Idempotent by label; an existing entity with different facts is refused.
- **Exam** (`elligble-exam-v1` plus questions `no,prompt,option_a..option_e,correct,score`): a teacher-managed exam with five-option single-choice questions in the listed order, participants from the group's enrollments on the exam day (or a listed subset) and proctors. The exam is SCHEDULED; the teacher marks it ready and opens it in "Pelaksanaan Ujian". The same files cannot be imported twice.

## 8. Local development

`runtime/secure-assessment`: `npm run migrate`, `node test/support/seed-demo.ts` (demo accounts documented there), `ELLIGBLE_ENV=development node src/main.ts`. `frontend/web`: `npm run dev` (Vite proxies `/api` to port 3000). Integration tests: `ELLIGBLE_TEST_DATABASE_URL=postgresql://user@host/postgres npm run test:integration`.

Browser end-to-end suite (`e2e/`): build the web client (`cd frontend/web && npm run build`), install the runtime packages, then in `e2e/` run `npm ci`, `npx playwright install chromium` once, and `ELLIGBLE_TEST_DATABASE_URL=postgresql://user@host/postgres npx playwright test` (password in `PGPASSWORD`). The setup creates a fresh database, starts the production process on port 3400 (`E2E_PORT`), provisions two schools, people, the academic setup and an exam only through the operator CLI, and reads the activation codes from the printed card sheet. The teardown stops the process and drops the database, also after a failed setup. `E2E_SERVER_LOG=<file>` keeps the server log; `E2E_KEEP_WORKDIR=1` keeps the CLI input files and card sheet (test data only).
