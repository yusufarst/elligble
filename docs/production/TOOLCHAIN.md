**Status:** ACTIVE (P0, DEC-045; created by GOV-REALIGN-002)
**Canonical:** YES for the verified state of each tool (00.12 §8). Versions pinned in the repository (`package.json`, `package-lock.json`, `.github/workflows/ci.yml`) win over this record; a Task that changes a tool updates its row.
**Last Updated:** 2026-10-26

# ELLIGBLE Toolchain

Each row says what was verified, where and when, and by which evidence. "Not available" is a verified fact, not a gap to work around: a Task that needs such a tool names it, and its installation needs the Owner's authorization in that Task.

## 1. Executor machine (Claude Code Desktop on `C:\Projects\ELLIGBLE`, Windows, Git Bash)

| Tool | Verified state | Evidence |
|---|---|---|
| Git | 2.55.0.windows.3; working tree CRLF, blobs LF (compare files LF-normalized, `tr -d '\r'`) | E2E-002 §5.1 (0.5), 2026-10-24 |
| Node.js / npm | v24.18.0 / 11.16.0 (CI uses Node 24) | E2E-002 §5.1 (0.5) |
| GitHub CLI | gh 2.96.0, authenticated as `yusufarst`; reads runs, jobs and logs through `gh api` | E2E-002 §5.1 (0.5, 0.6) |
| Temporary directory | Git Bash `/tmp` is `C:\Users\YUSUFS~1\AppData\Local\Temp`; Task gates live there, never in the repository | E2E-002 §5.1 (0.5) |
| PostgreSQL for tests | a local PostgreSQL 16 for tests only, provided by the Owner; `ELLIGBLE_TEST_DATABASE_URL` and `PGPASSWORD` set in the session, values never recorded | E2E-002 §5.1 (D2 closed 2026-10-24) |
| Playwright | 1.56.1 (`e2e/package.json`), Chromium headless shell 141.0.7390.37 (build v1194) installed under the E2E-002 authorization; Firefox and WebKit not installed: their evidence comes from CI only | E2E-002 §5.1, §5.2 |
| TypeScript | 7.0.2 in `e2e/` and the runtime packages; the web client pins its own version in `frontend/web/package.json` | package files |
| actionlint | not installed; a Task that changes `.github/workflows/` installs it under its authorization or states how the workflow is checked | E2E-002 §5.1 |
| Context7 | not available in the executor sessions so far; the official documentation of the exact version is used instead and cited in the Task record | E2E-002 §5.1 (0.6) |
| Graphify | repository workflow `.agents/workflows/graphify.md`, derived navigation only (authority guard `.agents/rules/graphify.md`); not yet run under AICWDF; used for impact analysis of HIGH Tasks when the Task names it | 00.12 §8 |
| DesainPakeAI | blocked: the approved project `b5a22aa4-7b38-49d2-9448-443eab6e8075` must be inspectable again before it is used (UI-SYSTEM-005) | living plan §10 |
| Load testing | not chosen; an open-source tool is chosen in P6 (`docs/production/PERFORMANCE_AND_LOAD_PLAN.md`) | 00.12 §8 |

## 2. Continuous integration (GitHub Actions, `.github/workflows/ci.yml`)

| Item | Verified state | Evidence |
|---|---|---|
| Runner image | every job pinned to `ubuntu-24.04` (Owner decision D-4): Playwright 1.56.1 has no browser builds for Ubuntu 26.04, to which `ubuntu-latest` moved from 2026-10-19; a newer image needs a Playwright upgrade first, as its own Task | E2E-003 (landed `b13fd40`, CI run 57); E2E-002 S11 |
| Jobs | eight: runtime (typecheck, unit, PostgreSQL 16 integration), web client (typecheck, tests, build), container image (build and smoke test against PostgreSQL 16), and five browser projects `mobile-360`, `tablet-768`, `desktop-1280` (Chromium), `firefox-1280` (Firefox), `webkit-390` (WebKit, iPhone 13 profile) | `ci.yml` |
| Latest green run on `main` | run 61 (databaseId 40206851655), attempt 1, on `2cf2f2136b617b009e6ed4c1ac670e9b3776b968`: all eight jobs success on `ubuntu-24.04` | GOV-REALIGN-002 §5.1 |
| Known engine limits | Playwright's Firefox driver may miss the load event of a first navigation or a reload and reports a reload as 'navigate'; the suite waits for proof read inside the page instead (`e2e/tests/helpers.ts`). Playwright's WebKit can stall before the first navigation commits (E2E-003 T6, one diagnostic re-run passed). CI engines are not real phones or tablets | E2E-001, E2E-002 §2.12, E2E-003 §2.7 |
| Re-runs | a re-run uses the same commit and workflow; it is never used to turn a failure into evidence without a contract rule and the Owner's authorization naming the run | E2E-002, E2E-003 |

## 3. Development container (cloud agent sessions)

Chromium only; Firefox and WebKit cannot be installed there (living plan §6.2, E2E-001).
