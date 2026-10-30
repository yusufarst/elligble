# GOV-REALIGN-004 — Integrated CBT-R1 P2–P6 Implementation Planning Package

## 1. Contract and current record

| Field | Value |
|---|---|
| Classification | BUILD / PRE-P11 / PRE-BASELINE; NOT COUNTED IN P11 BASELINE |
| Risk | HIGH: security/identity/answer-integrity/concurrency specifications, not production implementation |
| Status | DONE (2026-10-30), integrated P2–P6 planning-package outcome only; original draft headers unchanged; unresolved decisions and release gates preserved (§5) |
| Owner authorization | Integrated P2–P6 fast-track package, received 2026-10-30: one Task/branch, bounded eight-file documentation package, controlled content commit/normal push/one PR YES; merge/new implementation/new unresolved policy approval/next Task NO |
| Objective | One internally consistent P2–P6 package ready for consolidated review and later bounded implementation planning; reuse proven capabilities, identify rather than invent OPEN decisions |
| Base | `2c6a4860a71a40b5cfb344eae3b964dd5b983125` on main; PR #10 MERGED, GOV-REALIGN-003 DONE, P1 Owner APPROVED |
| Branch | `task/gov-realign-004-integrated-p2-p6` |
| Dependencies | DEC-044/045 and ADR-001; approved P1 R01–R31; completed predecessor and main CI #83 independently reverified; non-superseded LOCKED/FROZEN sources |
| Parallel safe | NO; one active Task, not five sequential Tasks or additional Task authorization |
| Product / database / API / UI / localization impact | NONE implemented; future contracts PROPOSED only; current routes/payloads and Bahasa Indonesia/shared UI authority preserved |
| Cost/vendor impact | No new vendor/dependency or recurring production cost selected; existing automatic GitHub CI only. Future load/media choices remain submitted |
| Independent HIGH-risk Review | PASS on approved content `9cf099ac5021c2338c4a74fda96bd0f1ecca7f81`, explicitly confirmed by Owner final evidence authorization 2026-10-30 (§5) |
| Consolidated Owner review | APPROVED 2026-10-30 for the integrated planning package only; O01–O09/PB05 remain OPEN, numeric P6 budgets PROPOSED, no policy/P11/production/implementation approval (§5) |
| Content SHA / PR / own CI | Approved content `9cf099ac5021c2338c4a74fda96bd0f1ecca7f81`; [PR #11](https://github.com/yusufarst/elligble/pull/11) OPEN; CI #84 (41017218535), attempt 1, eight SUCCESS on ubuntu-24.04 (§5). This evidence commit does not record its own SHA |

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
| 2026-10-30 | DONE | CI #84 on exact approved content 9cf099a (full SHA §5), eight SUCCESS; Independent HIGH-risk Review PASS; Owner consolidated planning-package approval; exactly one Task-record-only evidence commit/normal push authorized, all unresolved boundaries retained |

Source evidence is selective code inspection and existing tests, not new executed verification. Graphify used for derived orientation; old graph not authoritative and no out-of-scope graph output written. Current single-choice/teacher-managed flows, local-first recovery/timer/session/submission, activation CLI, monitoring, scoring/export and ops/CI assets reused. Missing future APIs/policies/capacity remain explicit in P2 map; completed UI/GOV Tasks remain closed. Historical living-plan checkpoints retained, current continuity updated.

Final content SHA/PR/CI and local guard outcome are resolved after publication and reported; no prospective PASS is fabricated. Independent Review **PENDING**; Owner package review **PENDING**; P2/P3/P4/P5/P6 all **DRAFT / SUBMITTED FOR REVIEW**, Task **NOT DONE**. No final evidence commit is created in this execution. P11 NOT APPROVED; production readiness NOT ACHIEVED; every applicable G1–G10/PB gate remains mandatory.

## 5. Final integrated planning-package acceptance and completion — 2026-10-30

**GOV-REALIGN-004: DONE for its integrated P2–P6 PLANNING PACKAGE outcome only.** HIGH risk; PRE-P11 / PRE-BASELINE; NOT COUNTED IN P11 BASELINE. This section resolves earlier PENDING/VERIFYING statements in §1–§4 as historical checkpoints, preserving the original authorization, contract, predecessor landing and evidence. The Owner explicitly authorizes exactly **one final Task-record-only evidence commit** and normal push to the existing branch/PR #11; no new PR, merge or another Task.

### 5.1 Exact content and complete CI evidence

Approved content **`9cf099ac5021c2338c4a74fda96bd0f1ecca7f81`**, parent `2c6a4860a71a40b5cfb344eae3b964dd5b983125`, software-only subject `docs(production): prepare integrated CBT-R1 P2-P6 planning package`. [PR #11](https://github.com/yusufarst/elligble/pull/11) was reverified **OPEN / NOT MERGED**, head equal to the approved content before this evidence edit. Local HEAD, remote-tracking branch and actual GitHub branch agreed at that SHA with a CLEAN working tree.

[CI #84](https://github.com/yusufarst/elligble/actions/runs/41017218535), run **41017218535**, automatic push, **attempt 1**, belongs to that exact content SHA: terminal **COMPLETED / SUCCESS**, all **eight jobs SUCCESS on ubuntu-24.04**. Run metadata, job conclusions/runner labels and existing web/browser logs were independently re-read before recording this evidence.

| Job | Job ID | Verified result |
|---|---|---|
| Runtime | 123936179621 | SUCCESS: typecheck, unit tests and real PostgreSQL integration |
| Web client | 123936179832 | SUCCESS: typecheck, **344/344 tests in 34 files**, production build |
| Container image | 123936434930 | SUCCESS: image build and smoke test |
| Browser mobile-360 | 123936435001 | SUCCESS: **22/22 E2E** |
| Browser webkit-390 | 123936435029 | SUCCESS: **22/22 E2E** |
| Browser tablet-768 | 123936435045 | SUCCESS: **22/22 E2E** |
| Browser firefox-1280 | 123936435083 | SUCCESS: **22/22 E2E** |
| Browser desktop-1280 | 123936435153 | SUCCESS: **22/22 E2E** |

The unchanged complete suites passed; no application/test/workflow/fixture/dependency edits, skips, retries or assertion weakening were introduced by this Task. No heavy local suites, browser/load tests, database operations or Docker/global-resource operations were run. Automatic regression CI verifies existing implementation, not the unimplemented proposed workflows, load capacity or new policy.

### 5.2 Deterministic local verification and attribution

Original content verification PASS: exact eight-file allowlist; five phase drafts; one consolidated **R01–R31** map and **O01–O09** register; **34** actual API paths matched to P3; **15** current workflow groups and **9** proposed-only future workflow groups; **5** architecture deltas, **14** permission rows, **10** negative-test groups, **10** load scenarios and **10** proposed budget rows. Reference/table/ID consistency, no silent policy approval, Owner identity, exact diff and whitespace were checked before publication. Before this evidence edit, lightweight guards reverified the approved eight-path content, 31 requirements, nine decision groups, all 34 current API paths, **39** local document links and `git diff HEAD^ HEAD --check`; all PASS. TASK_PLAN.md remains absent.

The original content raw message and `git log -1 --format=fuller` were inspected again: configured author and committer **Yusuf Arif Setiawan <134618411+yusufarst@users.noreply.github.com>**, software-only subject above, no attribution/trailers. The final evidence edit is constrained to this record; exact one-file staged scope, preserved history/contract, whitespace, Owner identity and secrets/attribution guards are mandatory before its commit. All other approved content, including five phase artifacts, living plan and manifest, remains unchanged.

### 5.3 Consolidated review and Owner acceptance

The Owner's final evidence authorization on **2026-10-30** explicitly confirms **Independent HIGH-risk Review: PASS on the approved content SHA** and **Owner consolidated review: APPROVED**. These are Owner-confirmed review/approval results, not self-awarded executor acceptance; no named reviewer or external report is invented. The explicit approval is:

> P2–P6 PACKAGE APPROVED — GOV-REALIGN-004 — SHA 9cf099a — O01–O09 REMAIN OPEN — PB05 REMAINS OPEN

The accepted integrated planning package consists of:

| Phase | Artifact | Accepted planning outcome |
|---|---|---|
| P2 Domain/Business Rules | `docs/production/CBT_DOMAIN_RULES_SPECIFICATION.md` | All-type/domain/identity/transfer/risk/governance specification, consolidated P1 mapping and explicit unresolved decisions |
| P3 Route/Interaction Matrix | `docs/production/ROUTE_INTERACTION_MATRIX.md` | Current role/route/state/error/evidence mapping distinguished from proposed-only missing operations |
| P4 Architecture Delta Review | `docs/production/CBT_ARCHITECTURE_DELTA_REVIEW.md` | Necessary deltas and follow-up decision briefs, reusing accepted architecture; no ADR approval |
| P5 CBT Permission Matrix | `docs/production/CBT_PERMISSION_MATRIX.md` | Detailed draft action/scope/enforcement/negative-test planning; no unresolved permission-policy approval or PB05 closure |
| P6 Performance and Load Plan | `docs/production/PERFORMANCE_AND_LOAD_PLAN.md` | Workload/measurement/integrity protocol and proposed numeric budgets; no approved budget or demonstrated capacity |

Acceptance is **one integrated planning-package approval**, established by this Task record without modifying the original draft headers. It does not separately approve unresolved technical/business/security policies, numeric budgets or follow-up ADR decisions, and does not claim missing capabilities implemented. DEC-044/045, ADR-001 and all non-superseded LOCKED/FROZEN decisions remain authoritative.

### 5.4 Preserved unresolved boundaries and publication

- **O01–O09 remain OPEN / OWNER DECISION REQUIRED**; no new policy or decision is approved by this record.
- **PB05 remains OPEN**. Every other OPEN production blocker is unchanged; PB04 remains CLOSED. Full DEC-044 scope and G1–G10 stay mandatory, with no new release-gate PASS claim.
- **Numeric P6 budgets remain PROPOSED / OWNER APPROVAL REQUIRED**. No load execution, 1,000-student capacity, real-device or production-readiness evidence is claimed.
- No new ADR approval, P11 baseline or TASK_PLAN.md; **production readiness NOT ACHIEVED** and **application implementation NOT AUTHORIZED**. P7, P8, P9, P10 and P11 are not started.
- All previously completed Task states and the predecessor landing/history remain preserved. Five phase documents, living plan, manifest, application, database, tests, workflows and every other file remain identical to approved content. Historical submitted-state navigation is resolved by this final Task record, not rewritten by this evidence-only commit.

Exactly one controlled evidence commit changes only `docs/production/tasks/GOV-REALIGN-004.md`; inspect its fuller log and raw software-only message after creation, report its actual SHA outside its own contents, then normal push to the existing Task branch/PR #11. No commit records its own SHA. Per **DEC-045 / 00.12 §5**, the evidence commit's automatic CI is not a DONE prerequisite, and there is **no second evidence commit**. The Owner reviews and squash-merges separately; the next separately authorized Task records any eventual landing. No merge, additional PR, policy approval, production action or another Task is performed here.
