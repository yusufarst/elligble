# GOV-REALIGN-004 — Integrated CBT-R1 P2–P6 Implementation Planning Package

## 1. Contract and current record

| Field | Value |
|---|---|
| Classification | BUILD / PRE-P11 / PRE-BASELINE; NOT COUNTED IN P11 BASELINE |
| Risk | HIGH: security/identity/answer-integrity/concurrency specifications, not production implementation |
| Status | VERIFYING; Task NOT DONE; all five phase artifacts DRAFT / SUBMITTED FOR REVIEW |
| Owner authorization | Integrated P2–P6 fast-track package, received 2026-10-30: one Task/branch, bounded eight-file documentation package, controlled content commit/normal push/one PR YES; merge/new implementation/new unresolved policy approval/next Task NO |
| Objective | One internally consistent P2–P6 package ready for consolidated review and later bounded implementation planning; reuse proven capabilities, identify rather than invent OPEN decisions |
| Base | `2c6a4860a71a40b5cfb344eae3b964dd5b983125` on main; PR #10 MERGED, GOV-REALIGN-003 DONE, P1 Owner APPROVED |
| Branch | `task/gov-realign-004-integrated-p2-p6` |
| Dependencies | DEC-044/045 and ADR-001; approved P1 R01–R31; completed predecessor and main CI #83 independently reverified; non-superseded LOCKED/FROZEN sources |
| Parallel safe | NO; one active Task, not five sequential Tasks or additional Task authorization |
| Product / database / API / UI / localization impact | NONE implemented; future contracts PROPOSED only; current routes/payloads and Bahasa Indonesia/shared UI authority preserved |
| Cost/vendor impact | No new vendor/dependency or recurring production cost selected; existing automatic GitHub CI only. Future load/media choices remain submitted |
| Independent HIGH-risk Review | PENDING: one integrated review of all five documents and cross-phase consistency |
| Consolidated Owner review | PENDING; execution authorization is not approval of phase drafts, Oxx policies, proposed budgets, P11 or production |
| Content SHA / PR / own CI | Resolved after publication; a content commit never records its own SHA. Exact automatic CI results and review disposition required before final evidence |

### Exact eight-file allowlist

1. `docs/production/CBT_DOMAIN_RULES_SPECIFICATION.md` (P2, single consolidated R01–R31 mapping and O01–O09 register).
2. `docs/production/ROUTE_INTERACTION_MATRIX.md` (P3, actual Wxx vs proposed-only Fxx).
3. `docs/production/CBT_ARCHITECTURE_DELTA_REVIEW.md` (P4, necessary A01–A05 deltas/decision briefs, no ADR approval).
4. `docs/production/CBT_PERMISSION_MATRIX.md` (P5, A01–A14 actor/object/enforcer/negative-test matrix; PB05 OPEN).
5. `docs/production/PERFORMANCE_AND_LOAD_PLAN.md` (P6, L01–L10 and B01–B10 PROPOSED / OWNER APPROVAL REQUIRED).
6. `docs/production/tasks/GOV-REALIGN-004.md` (this contract/history/evidence).
7. `docs/production/PRODUCTION_COMPLETION_PLAN.md` (predecessor landing, active Task and continuity).
8. `docs/DOCUMENT_MANIFEST.md` (index the package; preserve historical descriptors).

All other paths prohibited. No application/test/fixture/workflow/dependency changes, new ADR, policy approval, release-scope change, blocker closure, TASK_PLAN.md/P11 declaration, cosmetics, deployment, Docker/heavy local suites/browser/DB operations or other-project resource use. No destructive Git cleanup/history rewrite/force push/merge. Exactly one PR; no final evidence commit or DONE until required reviews/Owner acceptance are complete and separately applicable final authorization/gates hold.

## 2. First executor response and predecessor landing

```text
ROLE: EXECUTION AGENT
ACTIVE TASK: GOV-REALIGN-004; PRE-P11 / PRE-BASELINE; not counted in P11
TASK STATUS AT ENTRY: READY for bounded documentation only
ROOT: C:/Projects/ELLIGBLE
PHYSICAL ENTRY: completed predecessor branch at 35aa43e, CLEAN, local main behind remote
REMOTE MAIN / AUTHORIZED BASE: 2c6a4860a71a40b5cfb344eae3b964dd5b983125
DEPENDENCIES: PASS; PR #10 MERGED; predecessor Task record §6 DONE/P1 APPROVED
SYNC: explicit main fetch, clean switch and ff-only; old Task branch/work retained
CURRENT MAIN / ORIGIN MAIN: 2c6a4860a71a40b5cfb344eae3b964dd5b983125, CLEAN
OWNER IDENTITY: Yusuf Arif Setiawan <134618411+yusufarst@users.noreply.github.com>; gh user yusufarst
CI BASELINE: #83 (41010216177), push attempt 1, exact base SHA, eight SUCCESS, ubuntu-24.04
AUTHORIZATION: one exact branch/eight documentation paths/content commit/normal push/one PR YES; implementation/merge NO
RISK: HIGH
DATABASE/API/UI/VENDOR IMPACT: none implemented
SAFE TO IMPLEMENT: YES, this planning package only; unresolved policy decisions are recorded, never silently approved
P11 / PRODUCTION GATES: NOT APPROVED / NOT ACHIEVED
NEXT SAFE ACTION: prepare one mutually consistent P2–P6 draft package and deterministic guards
```

Remote [PR #10](https://github.com/yusufarst/elligble/pull/10) MERGED at **2026-10-30T05:45:41Z**, landing **`2c6a4860a71a40b5cfb344eae3b964dd5b983125`**. Its head/evidence `35aa43e0fd524e196cd63b74d6cc4b48f68436c8` has the same tree as the fetched main landing. Predecessor final content `6c9d3111674230dfafd78a152f10ba3b16ce9985`, CI #81 and both approval PASS results remain in GOV-REALIGN-003 §6, unchanged. Main [CI #83](https://github.com/yusufarst/elligble/actions/runs/41010216177), attempt 1: Runtime, Web, image, mobile-360, tablet-768, desktop-1280, firefox-1280 and webkit-390 all SUCCESS on ubuntu-24.04, independently read from GitHub before branch creation. This records the predecessor landing under DEC-045; it does not repeat completed work.

## 3. Acceptance and CI-first publication contract

- AC01: Exactly the eight approved content paths; no runtime/test/workflow/fixture/dependency/other document change; no unrelated staged/untracked work. Owner identity and raw software-only commit message without attribution; normal push only.
- AC02: P2 covers all eight formats, validation/scoring/manual grading, identity/claims/recovery/uniqueness/concurrency, room transfer, risk/incidents and both exam governance modes; existing contracts vs missing/unresolved details explicit.
- AC03: P3 actual paths/methods/typed behavior/enforcers/errors/states/evidence verified against router/clients; future Fxx routes visibly PROPOSED ONLY / NOT IMPLEMENTED, all six required roles represented.
- AC04: P4 only necessary deltas, existing boundaries reused; follow-up decision briefs not approved ADRs. P5 covers each action/actor/tenant/exam/room/participant/object and mandatory negatives, R/C/A gaps and approval boundary; PB05 stays OPEN.
- AC05: P6 covers 1,000-student profile, polling/NAT/DB/restart/media/signal/answer-integrity workload and metrics; numeric budgets PROPOSED / OWNER APPROVAL REQUIRED, no executed load/capacity claim.
- AC06: Single P2 consolidated mapping contains each R01–R31 once, same Oxx definitions across phases, P3/P4/P5/P6 cross-dependencies resolve. Local path/reference/table/coverage/whitespace guards PASS; no silent new policy, scope reduction or PB closure.
- AC07: Controlled content commit → normal push → one PR; automatic exact-content-SHA CI, push attempt 1, all eight existing jobs SUCCESS on ubuntu-24.04 with actual complete inventories recorded. No heavy local tests, CI rerun/dispatch/cancel or weakening to obtain PASS.
- AC08: One Independent HIGH-risk integrated Review and one consolidated Owner review required; no individual phase approval inferred. Unresolved Oxx decisions must retain their statuses unless explicitly decided. No final evidence/DONE before approvals; no P11 or production approval.

Owner authorized this Task's CI-first order directly; no earlier UI Task amendment is reused. Existing full workflow runs unchanged: web install/typecheck/Vitest/build, runtime typecheck/unit/real PostgreSQL, container image/smoke, five browser E2E projects. Reference/source/consistency checks are lightweight and run locally; they do not simulate future APIs or execute load. Own exact-SHA CI count must come from that run rather than a copied predecessor total. CI does not approve policy or prove the missing future capabilities.

STOP on canonical conflict, missing authorization, unexpected working/remote state, scope expansion, failed verification or CI. Preserve work. Record OPEN decisions without guessing. One material requirement that cannot be represented inside the eight paths needs explicit scope authorization before further work. A failed run is not rerun; no automatic extra corrective commit. At successful technical publication, STOP and submit the full package for the two consolidated reviews. No further Task begins.

## 4. Status history and current evidence

| Date | Status | Evidence |
|---|---|---|
| 2026-10-30 | READY | Owner authorizes one integrated HIGH-risk eight-file Task; predecessor/main/CI #83 and clean entry verified |
| 2026-10-30 | IN_PROGRESS | Exact branch created from current main; focused source/canonical review and five coordinated draft phase documents prepared |
| 2026-10-30 | VERIFYING | Bounded package ready for deterministic guards/publication; own exact-content-SHA CI, integrated independent review and consolidated Owner review pending |

Source evidence is selective code inspection and existing tests, not new executed verification. Graphify used for derived orientation; old graph not authoritative and no out-of-scope graph output written. Current single-choice/teacher-managed flows, local-first recovery/timer/session/submission, activation CLI, monitoring, scoring/export and ops/CI assets reused. Missing future APIs/policies/capacity remain explicit in P2 map; completed UI/GOV Tasks remain closed. Historical living-plan checkpoints retained, current continuity updated.

Final content SHA/PR/CI and local guard outcome are resolved after publication and reported; no prospective PASS is fabricated. Independent Review **PENDING**; Owner package review **PENDING**; P2/P3/P4/P5/P6 all **DRAFT / SUBMITTED FOR REVIEW**, Task **NOT DONE**. No final evidence commit is created in this execution. P11 NOT APPROVED; production readiness NOT ACHIEVED; every applicable G1–G10/PB gate remains mandatory.
