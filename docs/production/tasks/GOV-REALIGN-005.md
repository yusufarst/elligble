# GOV-REALIGN-005 — Integrated CBT-R1 P7–P10 Release Readiness Planning Package

## 1. Contract and current record

| Field | Value |
|---|---|
| Classification | BUILD / PRE-P11 / PRE-BASELINE; NOT COUNTED IN P11 BASELINE |
| Risk | HIGH: release/security/answer-integrity/device/operations planning; no implementation/deployment |
| Status | VERIFYING / NOT DONE; four phase documents DRAFT / SUBMITTED FOR REVIEW |
| Owner authorization | Integrated P7–P10 bounded Task, received 2026-10-30; one branch/content publication/PR/integrated independent review/consolidated Owner review. Seven-file documentation package, controlled content commit/normal push/one PR YES; implementation/new policy/merge/deployment/next Task NO |
| Objective | One coherent P7 functional inventory, P8 verification/DoD, P9 school operations and P10 staging/UAT/recovery plan using accepted P1/P2–P6 assets, actual gaps/UNKNOWN facts and no fabricated readiness |
| Base | `a16cbf59265b7d6c2dae1b1c90c9e0b3eb10439e`, PR #11 MERGED; GOV-REALIGN-004 DONE and P2–P6 planning package APPROVED; O01–O09/PB05 remain OPEN |
| Branch | `task/gov-realign-005-integrated-p7-p10` |
| Dependencies | DEC-044/045, ADR-001, accepted P1 R01–R31/P2–P6 definitions and completed predecessor; CI #86 exact main SHA eight SUCCESS verified. Policy/implementation/real infrastructure gaps are planning dependencies to record, not guesses to approve |
| Parallel safe | NO; one active Owner-authorized integrated Task, not four disconnected Tasks |
| Application / database / API / UI / localization impact | NONE implemented; existing routes/semantics/tokens/copy/accessibility authority reused; no cosmetic design work |
| Cost/vendor impact | No new service/dependency/paid vendor; existing automatic CI usage only. Actual production cost and resources UNKNOWN pending Owner/school facts |
| Independent HIGH-risk Review | PENDING: one integrated review of P7–P10 and cross-phase traceability |
| Consolidated Owner review | PENDING; execution authorization is not approval of draft plans, Oxx/P6 budgets, PB closure, P11 or production |
| Content SHA / CI / PR | Resolved after publication; no commit records its own SHA. Exact-SHA automatic CI and both review results required before final evidence/DONE |

### Exact seven-file allowlist

1. `docs/production/CBT_UX_SCREEN_AND_INTERACTION_INVENTORY.md` (P7 C01–C24/U01–U07 and R01–R31 functional traceability).
2. `docs/production/CBT_VERIFICATION_AND_RELEASE_DOD_PLAN.md` (P8 V01–V18, PB06/PB07 protocols/evidence/DoD).
3. `docs/production/SCHOOL_VPS_OPERATIONS_READINESS_PLAN.md` (P9 S01–S16 UNKNOWN facts, OI01–OI10 checks and RT01–RT08 restore protocol).
4. `docs/production/CBT_RELEASE_UAT_ROLLBACK_PLAN.md` (P10 RR01–RR08 rehearsal, UA01–UA08 UAT, G1–G10 single package gate table, recovery/declarations).
5. `docs/production/tasks/GOV-REALIGN-005.md` (this contract/history/evidence).
6. `docs/production/PRODUCTION_COMPLETION_PLAN.md` (predecessor landing, active Task and continuity).
7. `docs/DOCUMENT_MANIFEST.md` (index package/accepted predecessor status).

No other paths may change without separate Owner authority. No application/UI/test/workflow/fixture/dependency/database changes; no unnecessary visual polish/sticky-header work/new animation/tokens; no policy/ADR approval, PB closure, TASK_PLAN.md/P11 baseline, production access/provisioning/deployment/commands, Docker/heavy suites/browser/DB/load operations, force push/merge or autonomous successor. Minimum functional accessibility/readability/device/critical interaction requirements remain mandatory. Do not reopen completed Tasks or discard work.

## 2. Entry response and predecessor landing

```text
ROLE: EXECUTION AGENT
ACTIVE TASK: GOV-REALIGN-005; HIGH; PRE-P11 / PRE-BASELINE, not counted in P11
TASK STATUS AT ENTRY: READY for bounded documentation only
ROOT: C:/Projects/ELLIGBLE
PHYSICAL ENTRY: completed predecessor branch at 70cc49c, CLEAN; local main behind verified remote
AUTHORIZED MAIN BASE: a16cbf59265b7d6c2dae1b1c90c9e0b3eb10439e
DEPENDENCIES: PASS; PR #11 MERGED; GOV-REALIGN-004 record §5 DONE and consolidated planning approval, O01–O09/PB05 OPEN
MAIN CI: #86, run 41022404842, push attempt 1, exact main SHA, eight SUCCESS on ubuntu-24.04
SYNC: explicit fetch main, clean switch and ff-only; old Task branch/work preserved, tree equality verified
CURRENT MAIN / ORIGIN MAIN: a16cbf59265b7d6c2dae1b1c90c9e0b3eb10439e, CLEAN
OWNER IDENTITY: Yusuf Arif Setiawan <134618411+yusufarst@users.noreply.github.com>; gh user yusufarst
AUTHORIZATION: exact one Task/branch/seven paths/content publication/normal push/one PR; no implementation/production/merge
TOOLCHAIN: Git/Node/gh; source/record inspection; no heavy local suites/Docker/browser services
SAFE TO IMPLEMENT: YES, planning package only; unknown facts/policies remain explicit
P11 / PRODUCTION: NOT APPROVED / NOT ACHIEVED
NEXT SAFE ACTION: create authorized branch and prepare four coordinated drafts with lightweight guards
```

Verified remote [PR #11](https://github.com/yusufarst/elligble/pull/11) MERGED at **2026-10-30T07:49:00Z**, landing **`a16cbf59265b7d6c2dae1b1c90c9e0b3eb10439e`**; its head/evidence `70cc49ca15e3fa58a01403485bd8d3805511df4a` tree equals the fetched main landing. Predecessor approved content `9cf099ac5021c2338c4a74fda96bd0f1ecca7f81`, CI #84 eight SUCCESS and both review/Owner approval results remain in GOV-REALIGN-004 §5 unchanged. [Main CI #86](https://github.com/yusufarst/elligble/actions/runs/41022404842), run **41022404842**, completed attempt **1**, exact main SHA: Runtime, Web, image, mobile-360, tablet-768, desktop-1280, firefox-1280 and webkit-390 all SUCCESS on ubuntu-24.04, independently read from API before branch creation. No open PR at entry. This records predecessor landing, not a restart of completed work.

## 3. Acceptance and verification-order contract

- AC01: Exactly seven approved content paths; no source/test/workflow/fixture/dependency/other document delta or unrelated work; Owner author/committer, software-only raw message without attribution; normal push and exactly one PR.
- AC02: P7 all six role contexts and every R01–R31 mapped to actual/missing screens, interaction/state/real-or-proposed P3 dependency, P5 authorization, responsive/keyboard/focus/touch/copy/recovery acceptance and P8 evidence. No redesign or rendered PASS from code inspection.
- AC03: P8 complete positive/negative/type/identity-race/room-session/answer/timer/submission/scoring/publication/device/release coverage, PB06 physical protocol and PB07 server-state oracle; future tests labelled planned/blocked, none executed/closed by planning.
- AC04: P9 actual school facts UNKNOWN, reference vs observed infrastructure distinct; implementable scoped stack/security/backup/off-host/restore/media/answers/monitoring/incident/cost readiness checks, no production command/action. PB11/PB12 OPEN.
- AC05: P10 staging/migration/release/rollback/recovery-target/each-role-school-UAT/declarations/go-no-go and explicit G1–G10 current statuses; no release, capacity or production-ready approval.
- AC06: Same P1 Rxx/P2 O01–O09/P3 Wxx/Fxx/P5 Axx and P6 proposals used across package; P2 remains sole decision register; P10 sole package gate-disposition table. Existing delivered/missing/planned/evidence-pending/blocked/Owner-external inputs explicit; original completed records and OPEN blockers preserved.
- AC07: Lightweight deterministic path/link/table/ID/traceability/whitespace/identity/secrets/attribution guards then one controlled content commit → normal push/one PR → automatic full CI on exact content SHA, attempt 1, eight SUCCESS on ubuntu-24.04; actual test totals read from own run. No rerun/dispatch/cancel/skip/weaken/retry-to-PASS or heavy local verification.
- AC08: STOP for one integrated Independent HIGH-risk Review and one consolidated Owner review after technical publication. No final evidence commit/DONE before required approvals; no next Task or P11/production authorization.

Owner directly authorizes this Task's CI-first order; previous Task exceptions are not reused. Existing full workflow unchanged: web npm ci/typecheck/full Vitest/build, runtime typecheck/unit/real PostgreSQL integration, image build/smoke, five browser projects. This regression does not prove planned future tests, real devices, school VPS/restore/UAT/load or release gates. Tool versions/limits remain as recorded in TOOLCHAIN.md; relevant design/copy/skill-stack authority read without UI implementation, and Graphify consulted only for derived navigation, never as current infrastructure proof or policy authority.

STOP on failed predecessor/own verification, canonical conflict, missing required authority, unexpected repository state, scope expansion or CI failure. Preserve working evidence; no automatic corrective commit or rerun-to-green. Missing external facts are recorded UNKNOWN with responsible role and gate, not fabricated or used to start production. Any material requirement needing an eighth path requires new Owner scope authority. Local multi-project isolation remains strict; GitHub Actions runners are separate from Owner workstation resources.

## 4. Status history and current evidence

| Date | Status | Evidence |
|---|---|---|
| 2026-10-30 | READY | Owner authorizes GOV-REALIGN-005; physical/main/predecessor/CI #86 guards PASS; O01–O09 and OPEN blockers preserved |
| 2026-10-30 | IN_PROGRESS | Exact branch from verified clean main; selective canonical/source/runbook/design/test review; four integrated phase drafts prepared |
| 2026-10-30 | VERIFYING | Seven-file content ready for deterministic guards and publication; own CI and both consolidated reviews pending, Task NOT DONE |

Four new phase files are DRAFT / SUBMITTED FOR REVIEW. Baseline evidence reused, no new executed device/load/browser/restore/UAT/a11y result. School facts/signatories/recovery objectives/target remain UNKNOWN; P6 budgets PROPOSED; no legal/security/policy/ADR approval or blocker closure. P11 NOT APPROVED, TASK_PLAN.md absent, production readiness NOT ACHIEVED. Content SHA/CI/PR and actual guard results resolved after publication and reported; no prospective PASS or own-SHA embedding. Required Independent HIGH-risk Review PENDING; Owner consolidated review PENDING. No final evidence commit or successor in this execution.
