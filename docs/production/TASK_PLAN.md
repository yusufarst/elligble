**Status:** FINAL P11 OWNER APPROVED / OFFICIAL TRACKER ACTIVATION PENDING CONTROLLED OWNER MERGE
**Preparation Task:** GOV-REALIGN-006, DONE for PRE-P11 candidate preparation only; NOT COUNTED IN P11 BASELINE
**Transition Task:** GOV-P11-001; HIGH; P11 TRANSITION / GOVERNANCE DOCUMENTATION ONLY; VERIFYING / NOT DONE; NOT COUNTED among the 33 implementation Tasks
**Candidate base:** `77756e38ff4e289e7b6ebcda63d753749854756d`; verified 2026-10-30
**Owner Gate B approval:** 2026-10-31; exact main `885a91d845059b00900daf85d719604826be8dd3`; original candidate Git blob `e940f7b3293e5ace699aad0c2d590170506023c7`
**Authority:** Owner-approved finite CBT-R1 baseline under DEC-044/045, ADR-001 and accepted P1–P10 planning sufficiency; no additional policy, implementation or release approval

# CBT-R1 finite P11 implementation baseline

## 1. Authority and activation boundary

The Owner explicitly approved FINAL P11 Gate B on 2026-10-31 for the exact main and original candidate blob above. This is the finite CBT-R1 baseline; approval does not authorize execution or change any of its 33 BLOCKED Tasks. Under [DEC-045 §2/§5](../00-governance/00.12_AICWDF_ADOPTION_AND_TASK_EXECUTION.md), this document becomes the official live Task-status tracker **after controlled Owner merge of GOV-P11-001**. Until that landing, the [living plan](PRODUCTION_COMPLETION_PLAN.md) and active [transition Task record](tasks/GOV-P11-001.md) control this publication. Each implementation still needs its own concrete bounded contract, satisfied READY gate and separate Owner authorization. No implementation Task record or execution is created here.

Canonical scope is complete [DEC-044 §3 and G1–G10](../00-governance/00.11_CBT_RELEASE_SCOPE_REALIGNMENT.md), not a single-choice pilot. [P1](CBT_RELEASE_DEFINITION.md) acceptance is established by [GOV-REALIGN-003 §6](tasks/GOV-REALIGN-003.md); [GOV-REALIGN-004 §5](tasks/GOV-REALIGN-004.md) accepts P2–P6 planning and [GOV-REALIGN-005 §5](tasks/GOV-REALIGN-005.md) accepts P7–P10 planning. Historical draft headers do not erase those accepted planning outcomes or approve unresolved policies.

**Final P11 Gate B: OWNER APPROVED, 2026-10-31; tracker activation pending controlled landing.** The Owner accepts P1–P10 planning sufficiency for baseline approval only. The approved detailed P5 scope is bounded by [GOV-POLICY-001 §7](tasks/GOV-POLICY-001.md): P01–P05 and proposal P in A01–A14 approved, K authority preserved, excluded C/O01–O08 default-deny. Approved P6 numeric scope is bounded by [GOV-PERF-001 §7](tasks/GOV-PERF-001.md): unchanged L01–L10/timing/calibration/B01–B08 approved; B10 conditional on O06/O08 and other prerequisites; B09 provisional/not approved. This satisfies the applicable approval inputs for the finite baseline, not full O07/O09 closure. Outstanding Oxx/Axx/actual-school facts remain hard Task-specific READY inputs where applicable. No architecture contract or school fact is invented; load/device/restore/UAT and full G1–G10 evidence remain mandatory at their execution/completion/release gates. No LOCKED decision is waived.

## 2. Baseline accounting and status semantics

Only the unique rows in §3 are counted. All are unstarted baseline work. Every completed PRE-P11 Task and the GOV-P11-001 governance transition are excluded; pre-adoption delivered capabilities are reused history (§9). No effort estimate is asserted.

| Counter | Value |
|---|---:|
| Baseline Total | 33 |
| Current Total | 33 |
| DONE | 0 |
| READY | 0 |
| IN_PROGRESS | 0 |
| VERIFYING | 0 |
| BLOCKED | 33 |
| TODO | 0 |
| SUPERSEDED | 0 |
| Progress % | 0% |

These are the Owner-approved finite baseline totals, unchanged from the accepted candidate. Progress is DONE / Current Total = 0 / 33. GOV-P11-001's VERIFYING status is outside these counters. No historical DONE is re-counted; official live tracking awaits controlled Owner merge.

- BLOCKED: a named unresolved external gate and/or unfinished required predecessor prevents READY; all present rows qualify.
- TODO: included unstarted work without a currently identified blocker, still needing full contract readiness; none currently classified.
- READY: dependencies DONE, all policies/contracts/scope/impacts/tests/tools/cost known and no ambiguity. NONE now. Even later READY is not execution authorization.
- IN_PROGRESS/VERIFYING/DONE/SUPERSEDED retain DEC-045 meanings; only reviewed evidence supports DONE. No checkbox is checked.
- Priorities indicate production ordering, not estimates or a waiver. Independent school/Owner decisions can be obtained without authorizing parallel executor Tasks. PARALLEL SAFE: NO for all rows unless a later explicit contract/Owner approval changes that.

## 3. Registered candidate rows

Internal dependency IDs refer only to this table. External gates are defined once in §8, and are not invented DONE Tasks. Table order is grouping, not execution order; the acyclic graph controls (notably short-answer depends on essay/manual support).

| Task ID | Bounded outcome | Status | Priority / path position | Risk | Depends on | External lifecycle gates (§8) |
|---|---|---|---|---|---|---|
| SEC-001 | Enforce approved CBT permissions on existing routes | BLOCKED | P0 / first implementation candidate | HIGH | NONE | O09 |
| AUTH-001 | Final ELLIGBLE ID generation and uniqueness implementation | BLOCKED | P0 / identity foundation | HIGH | SEC-001 | O01, O03, A03 |
| ADMIN-001 | School Operator authoritative roster import | BLOCKED | P0 / identity input | HIGH | AUTH-001 | O01, O03, O09, A03 |
| AUTH-002 | Student claim and scoped verification/activation | BLOCKED | P0 / identity journey | HIGH | ADMIN-001 | O01, O03, O09, A03 |
| AUTH-003 | In-person school-assisted recovery of the existing account | BLOCKED | P0 / account continuity | HIGH | AUTH-002 | O03, O09, A03 |
| ASSESS-QUESTION-001 | Versioned question/answer/scoring compatibility foundation | BLOCKED | P0 / question and answer integrity foundation | HIGH | SEC-001 | O02, O05, O09, A01 |
| ASSESS-QUESTION-002 | Multiple response | BLOCKED | P1 / all eight formats | HIGH | ASSESS-QUESTION-001 | O02, O09 |
| ASSESS-QUESTION-003 | True/false | BLOCKED | P1 / all eight formats | HIGH | ASSESS-QUESTION-001 | O02, O09 |
| ASSESS-QUESTION-004 | Matching | BLOCKED | P1 / all eight formats | HIGH | ASSESS-QUESTION-001 | O02, O09 |
| ASSESS-QUESTION-005 | Ordering | BLOCKED | P1 / all eight formats | HIGH | ASSESS-QUESTION-001 | O02, O09 |
| ASSESS-QUESTION-006 | Short answer | BLOCKED | P1 / all eight formats | HIGH | ASSESS-QUESTION-001, ASSESS-QUESTION-008 | O02, O09 |
| ASSESS-QUESTION-007 | Numeric answer | BLOCKED | P1 / all eight formats | HIGH | ASSESS-QUESTION-001 | O02, O09 |
| ASSESS-QUESTION-008 | Essay and authorized human grading | BLOCKED | P1 / all eight formats | HIGH | ASSESS-QUESTION-001 | O02, O09 |
| ASSESS-STUDENT-001 | Approved late-delivery disposition and expiry integrity | BLOCKED | P0 / integrity decision gate | HIGH | ASSESS-QUESTION-001 | O04 |
| ASSESS-MEDIA-001 | Safe pinned prompt and option image delivery | BLOCKED | P1 / required question media | HIGH | SEC-001, ASSESS-QUESTION-001 | O06, O07, O09, A02 |
| ASSESS-QUESTION-009 | Scoped question bank and browser authoring | BLOCKED | P1 / content preparation | HIGH | ASSESS-QUESTION-002, ASSESS-QUESTION-003, ASSESS-QUESTION-004, ASSESS-QUESTION-005, ASSESS-QUESTION-006, ASSESS-QUESTION-007, ASSESS-QUESTION-008, ASSESS-MEDIA-001 | O02, O06, O09 |
| ASSESS-QUESTION-010 | Mixed-format import, validation and readiness convergence | BLOCKED | P1 / complete content ingress | HIGH | ASSESS-QUESTION-009 | O02, O06 |
| ASSESS-INSTITUTION-001 | Institution organizer, subject and session composition | BLOCKED | P1 / school-scale exam governance | HIGH | SEC-001 | O05, O09, A04 |
| ASSESS-INSTITUTION-002 | In-product rooms, participants and Proctor assignments | BLOCKED | P1 / school-scale exam setup | HIGH | ASSESS-INSTITUTION-001 | O05, O09 |
| ASSESS-INSTITUTION-003 | School Operator drill-down and audited bounded controls | BLOCKED | P1 / operational supervision | HIGH | ASSESS-INSTITUTION-002 | O05, O09 |
| ASSESS-ROOM-001 | Atomic participant room transfer during running exams | BLOCKED | P0 / transfer integrity | HIGH | ASSESS-INSTITUTION-002, ASSESS-INSTITUTION-003 | O05, O09, A04 |
| ASSESS-PROCTOR-003 | STANDAR risk feed and human incident journey | BLOCKED | P1 / honest supervision evidence | HIGH | SEC-001, ASSESS-INSTITUTION-003 | O08, O09, A05 |
| RESULT-004 | Full-type and institution result finalization/reporting | BLOCKED | P1 / trustworthy complete results | HIGH | ASSESS-QUESTION-002, ASSESS-QUESTION-003, ASSESS-QUESTION-004, ASSESS-QUESTION-005, ASSESS-QUESTION-006, ASSESS-QUESTION-007, ASSESS-QUESTION-008, ASSESS-INSTITUTION-001 | O02, O05, O09, A01 |
| RESULT-003 | Teacher publication and Student own finalized score | BLOCKED | P1 / result delivery | HIGH | RESULT-004 | O05, O09 |
| SEC-OPS-001 | Audited operational/session intervention | BLOCKED | P0 / operational security | HIGH | SEC-001, AUTH-003 | O03, O09, PB12 |
| OPS-STAGING-001 | Authorized isolated synthetic staging and measurement readiness | BLOCKED | P0 / external environment prerequisite | HIGH | NONE | O07, S01-S16, ACCESS, COST |
| PERF-001 | Production-equivalent full-workload capacity evidence | BLOCKED | P0 / G4 evidence | HIGH | OPS-STAGING-001, AUTH-003, ASSESS-QUESTION-010, ASSESS-ROOM-001, ASSESS-PROCTOR-003, RESULT-003 | O07, O02, O06, O08, LOAD-TOOL |
| OPS-001 | School VPS TLS, automated off-host backup and restore proof | BLOCKED | P0 / G8 operational evidence | HIGH | OPS-STAGING-001, ASSESS-MEDIA-001, SEC-OPS-001 | O07, S01-S16, PB02, PB12, ACCESS, COST |
| VERIFY-INTEGRITY-001 | Complete PB07 server-answer integrity artifact | BLOCKED | P0 / G3 final evidence | HIGH | ASSESS-STUDENT-001, ASSESS-QUESTION-010, ASSESS-ROOM-001, PERF-001, OPS-001 | O04, O05, PB07-REVIEW |
| DEVICE-001 | Real-device and minimum functional accessibility verification | BLOCKED | P0 / G5 capability evidence | HIGH | AUTH-003, ASSESS-QUESTION-010, ASSESS-ROOM-001, ASSESS-PROCTOR-003, RESULT-003, OPS-STAGING-001 | O07, O08, DEVICE-ACCESS |
| LEGAL-001 | Qualified privacy/legal artifacts and closure evidence | BLOCKED | P0 / before real student data | HIGH | NONE | LEGAL-SIGNATORIES |
| SEC-RELEASE-001 | Complete security and permission release evidence | BLOCKED | P0 / G6 final verification | HIGH | AUTH-003, ASSESS-QUESTION-010, ASSESS-ROOM-001, ASSESS-PROCTOR-003, RESULT-003, SEC-OPS-001, OPS-001, LEGAL-001 | O09, PB12, SECURITY-REVIEW |
| RELEASE-001 | Full regression, school UAT, rehearsal and release dossier | BLOCKED | P0 / final baseline evidence handoff | HIGH | VERIFY-INTEGRITY-001, DEVICE-001, PERF-001, OPS-001, SEC-RELEASE-001, LEGAL-001, RESULT-003 | S01-S16, UAT-SIGNATORIES, RELEASE-AUTHORITY, COST |

### Candidate checklist

- [ ] SEC-001 — Enforce approved CBT permissions on existing routes (BLOCKED)
- [ ] AUTH-001 — Final ELLIGBLE ID generation and uniqueness implementation (BLOCKED)
- [ ] ADMIN-001 — School Operator authoritative roster import (BLOCKED)
- [ ] AUTH-002 — Student claim and scoped verification/activation (BLOCKED)
- [ ] AUTH-003 — In-person school-assisted recovery of the existing account (BLOCKED)
- [ ] ASSESS-QUESTION-001 — Versioned question/answer/scoring compatibility foundation (BLOCKED)
- [ ] ASSESS-QUESTION-002 — Multiple response (BLOCKED)
- [ ] ASSESS-QUESTION-003 — True/false (BLOCKED)
- [ ] ASSESS-QUESTION-004 — Matching (BLOCKED)
- [ ] ASSESS-QUESTION-005 — Ordering (BLOCKED)
- [ ] ASSESS-QUESTION-006 — Short answer (BLOCKED)
- [ ] ASSESS-QUESTION-007 — Numeric answer (BLOCKED)
- [ ] ASSESS-QUESTION-008 — Essay and authorized human grading (BLOCKED)
- [ ] ASSESS-STUDENT-001 — Approved late-delivery disposition and expiry integrity (BLOCKED)
- [ ] ASSESS-MEDIA-001 — Safe pinned prompt and option image delivery (BLOCKED)
- [ ] ASSESS-QUESTION-009 — Scoped question bank and browser authoring (BLOCKED)
- [ ] ASSESS-QUESTION-010 — Mixed-format import, validation and readiness convergence (BLOCKED)
- [ ] ASSESS-INSTITUTION-001 — Institution organizer, subject and session composition (BLOCKED)
- [ ] ASSESS-INSTITUTION-002 — In-product rooms, participants and Proctor assignments (BLOCKED)
- [ ] ASSESS-INSTITUTION-003 — School Operator drill-down and audited bounded controls (BLOCKED)
- [ ] ASSESS-ROOM-001 — Atomic participant room transfer during running exams (BLOCKED)
- [ ] ASSESS-PROCTOR-003 — STANDAR risk feed and human incident journey (BLOCKED)
- [ ] RESULT-004 — Full-type and institution result finalization/reporting (BLOCKED)
- [ ] RESULT-003 — Teacher publication and Student own finalized score (BLOCKED)
- [ ] SEC-OPS-001 — Audited operational/session intervention (BLOCKED)
- [ ] OPS-STAGING-001 — Authorized isolated synthetic staging and measurement readiness (BLOCKED)
- [ ] PERF-001 — Production-equivalent full-workload capacity evidence (BLOCKED)
- [ ] OPS-001 — School VPS TLS, automated off-host backup and restore proof (BLOCKED)
- [ ] VERIFY-INTEGRITY-001 — Complete PB07 server-answer integrity artifact (BLOCKED)
- [ ] DEVICE-001 — Real-device and minimum functional accessibility verification (BLOCKED)
- [ ] LEGAL-001 — Qualified privacy/legal artifacts and closure evidence (BLOCKED)
- [ ] SEC-RELEASE-001 — Complete security and permission release evidence (BLOCKED)
- [ ] RELEASE-001 — Full regression, school UAT, rehearsal and release dossier (BLOCKED)

## 4. Common contract, READY and verification requirements

The following fields apply to **each** §5 card, in addition to its specific acceptance/evidence/impact scope:

1. **Scope/authority:** one named outcome; reuse owning modules, existing teacher-managed flow and locked design system. No hidden rework of completed UI, global palette/font/token redesign, deferred domains, AI, audio/video or file-upload answers. Student ≠ Participant ≠ Attempt ≠ Session; signal ≠ verdict; default-deny and tenant isolation always apply.
2. **Responsible parties:** a future Owner-authorized executor plus independent HIGH-risk reviewer; gate-specific approval authorities in §8. Owner alone authorizes execution/merges. Qualified school/legal/operations actors supply facts/approvals; executor never invents signatories or legal policy.
3. **Exact unblock condition:** all §3 internal dependencies DONE with recorded evidence; satisfy only the Task-applicable **READY prerequisites** in §8 for its external lifecycle gates, including required policy/design approvals, authority, access and reviewer/signatory assignment. Applicable final P11 approval and a future Task record with precise file allowlist, approved expected outcomes, defined tests, route/interaction/DB/UI/localization/cost/tool impacts and separate Owner execution authorization remain required. A report, executed test result, independent review PASS, UAT signoff or controlled closure produced by this same Task is a **DONE/release outcome**, never its own READY prerequisite. Completed evidence from an internal predecessor remains an input where that dependency requires it. No unresolved input policy/schema/role/session/scoring detail is READY.
4. **Proposed paths:** §5 source/test paths are impact proposals, **not write authorization or complete frozen execution allowlists**. New names are proposals, not claims the files exist. Every Task additionally proposes only its own `docs/production/tasks/<Task-ID>.md`, this TASK_PLAN and the living plan for required status/evidence. Any needed manifest/decision/contract/package/fixture/shared-component or migration path must be enumerated and Owner-approved in that Task's concrete contract before READY. A required migration has **no allocated number/path/schema here**; inability to freeze that exact path remains a scope blocker. No blanket directory/glob write permission is granted.
5. **Architecture inputs:** A01–A05 are unapproved P4 decision briefs, not selected designs. A future Owner-authorized technical decision/contract must record the accepted version/ownership/transaction/storage/retention/compatibility choice. If a new ADR is needed, obtain its exact documentation scope before work; this candidate approves no ADR.
6. **Data/API:** owning-domain APIs and versioned migrations only; no silent cross-domain writes/reset/backfill reinterpretation. Test empty and upgraded DB, stable stored v1 answers/results and client pending-data compatibility. Every added route has parity, authentication/context/object negatives and bounded truthful errors. Never expose keys/credentials/private peer data.
7. **UI/localization:** each new functional UI uses approved shared ELLIGBLE/shadcn primitives and tokens, Bahasa Indonesia, no user-facing em dash, explicit loading/empty/stale/refused/error/success and safe focus. Maintain native keyboard/input semantics, visible focus, ≥44x44px touch targets, contrast/color-independent states, reduced motion, no overflow/overlap at representative mobile/tablet/desktop and 200% text/short landscape/safe areas. Before/after **actual rendered** evidence and iterative material-defect correction are required for material UI; no blanket WCAG PASS from static source/scan alone. Skill selection follows the canonical frontend stack only when authorized frontend work begins.
8. **Verification:** P8 V01–V18 as applicable; full typecheck/unit/regression/build, real PostgreSQL and critical real-stack/browser journeys, P5 negatives and immutable snapshot/answer/timer/submission invariants. Keep all five existing browser projects. Record actual exact-candidate test inventory; historical 344 web/22 E2E counts are not frozen future totals. No skip/assertion weakening/retry-to-PASS. A failure stops at the authorized gate for assessed remediation.
9. **CI-first:** GOV-REALIGN-006's authorization covers its own four documentation files only. Each future Task requires its **own** explicit verification-order/CI-first permission before a content commit precedes heavy gates. Do not transfer UI/GOV amendments implicitly. No heavy suites, Docker, ports or resource operations on the shared 8GB workstation.
10. **DONE:** produce the Task acceptance evidence and applicable §8 DONE/release outcomes; exact content-SHA required CI/evidence PASS and recorded independent HIGH-risk Review, qualified legal approvals, PB report review PASS or actual UAT signoffs as applicable. Reviewer/signatory nomination before execution never substitutes for completed review/signoff. Blocker closure additionally needs its prescribed authority/evidence and authorized controlled backlog update; blockers remain OPEN until valid closure. One Task-record-only evidence commit under DEC-045, not a recursive evidence chain. Final deployment/production switch needs separate authorization and all G1–G10.
11. **Stops:** unexpected Git state, canonical conflict, unknown expected result/authority/schema, scope/file/cost/vendor expansion, missing access/approval, failed integrity/security/CI/device/load/restore/UAT evidence. Preserve failures; no cleanup/history rewrite, force push, merge, automatic successor or impairment of other projects.

## 5. Bounded Task cards

### SEC-001 — Enforce approved CBT permissions on existing routes

- **Requirements / status / priority / risk:** R07, R21, R23; BLOCKED; P0 / first implementation candidate; HIGH.
- **Dependencies and approvals:** No internal predecessor; external O09. **Unblock:** required predecessors DONE and the Task-applicable §8 READY input prerequisites plus §4 conditions; the same Task’s §8 DONE/release evidence is produced during execution and is not an entry prerequisite. No inferred approval.
- **Acceptance:** Approved P5 A01–A14 scopes are applied to existing actions without granting missing institution/identity features. Prove tenant/assignment/exam/room/object denial with unchanged denied-request state; close existing high-risk reason/confirmation/audit gaps, including lock/unlock, within approved policy. Preserve Teacher/Proctor distinction and no School Operator grading power.
- **Required tests/evidence:** P5 N01–N10; P8 V11/V12; existing auth, supervision, lock and monitoring integration plus real-browser positive/negative cases. Any required schema detail remains a READY blocker. Also §4's full applicable CI/regression/independent-review and material-UI evidence gates.
- **DB/API/UI/localization impacts:** DB: audit/reason persistence delta to specify, no guessed migration. API: existing authorization/lock payload and route-parity compatibility. UI/localization: scoped controls/confirmation/reason and Bahasa Indonesia errors; existing keyboard/focus retained.
- **Cost/vendor impact:** No new vendor or recurring dependency proposed; any implementation dependency/cost change requires explicit Owner approval.
- **Proposed future execution paths:** `runtime/secure-assessment/src/http/authenticated-context.ts`; `runtime/secure-assessment/src/http/attempt-authorization.ts`; `runtime/secure-assessment/src/proctor-authorization.ts`; `runtime/secure-assessment/src/supervision-scope.ts`; `runtime/secure-assessment/src/participant-lock.ts`; `runtime/secure-assessment/src/server.ts`; `frontend/web/src/components/ExamMonitoringView.tsx`; `runtime/secure-assessment/test/integration/participant-lock.test.ts`; `runtime/secure-assessment/test/integration/exam-monitoring.test.ts`; `e2e/tests/3-security.spec.ts`. Common documentation and unresolved exact migration/contract scope follow §4.4; no source path is authorized now.

### AUTH-001 — Final ELLIGBLE ID generation and uniqueness implementation

- **Requirements / status / priority / risk:** R07, R08, R09; BLOCKED; P0 / identity foundation; HIGH.
- **Dependencies and approvals:** SEC-001; external O01, O03, A03. **Unblock:** required predecessors DONE and the Task-applicable §8 READY input prerequisites plus §4 conditions; the same Task’s §8 DONE/release evidence is produced during execution and is not an entry prerequisite. No inferred approval.
- **Acceptance:** Implement only the explicitly approved ID format/generation and official-identity resolution contract. Persistence guarantees one active Account and no duplicate-producing active/pending claims; ambiguity never creates/merges another Person. Existing activation cards and login remain valid.
- **Required tests/evidence:** P8 V01/V11; same-key concurrent generation, collisions, retry/rollback, ambiguous roster, cross-tenant attributes and old-card login. Real PostgreSQL unique/transaction tests, empty/upgrade migrations. Also §4's full applicable CI/regression/independent-review and material-UI evidence gates.
- **DB/API/UI/localization impacts:** DB: required identity/account/claim keys and constraints pending A03. API: existing provisioning/login compatibility; no new identity authority. UI/localization: existing credentials/card labels only if contract requires.
- **Cost/vendor impact:** No new vendor or recurring dependency proposed; any implementation dependency/cost change requires explicit Owner approval.
- **Proposed future execution paths:** `runtime/identity-access/src/index.ts`; `runtime/identity-access/src/provisioning.ts`; `runtime/identity-access/src/directory.ts`; `runtime/secure-assessment/src/ops/provisioning/people.ts`; `runtime/secure-assessment/test/integration/provisioning.test.ts`; `runtime/identity-access/test/runtime.test.ts`. Common documentation and unresolved exact migration/contract scope follow §4.4; no source path is authorized now.

### ADMIN-001 — School Operator authoritative roster import

- **Requirements / status / priority / risk:** R08, R09; BLOCKED; P0 / identity input; HIGH.
- **Dependencies and approvals:** AUTH-001; external O01, O03, O09, A03. **Unblock:** required predecessors DONE and the Task-applicable §8 READY input prerequisites plus §4 conditions; the same Task’s §8 DONE/release evidence is produced during execution and is not an entry prerequisite. No inferred approval.
- **Acceptance:** School Operator previews deterministic per-row validation/matches and commits an audited, retry-safe roster import in own tenant. Preserve official name/NIS/NISN/birth-date/rombel distinctions, ambiguous review and audited re-import correction; no Person merge or real roster before legal G7.
- **Required tests/evidence:** P8 V01/V11/V12; malformed/duplicate/conflicting rows, stale preview, cross-tenant/wrong-role, same-key replay, concurrent correction and atomic refusal; synthetic browser import. Also §4's full applicable CI/regression/independent-review and material-UI evidence gates.
- **DB/API/UI/localization impacts:** DB: official roster ownership/revision and uniqueness schema pending A03. API/UI: P3 F01 proposed roster preview/commit and School Operator screen; API names not yet approved. Bahasa Indonesia per-row errors.
- **Cost/vendor impact:** No new vendor or recurring dependency proposed; any implementation dependency/cost change requires explicit Owner approval.
- **Proposed future execution paths:** `runtime/academic-core/src/roster-import.ts`; `runtime/identity-access/src/roster-resolution.ts`; `runtime/secure-assessment/src/http/roster-routes.ts`; `runtime/secure-assessment/src/server.ts`; `frontend/web/src/components/SchoolRosterImportView.tsx`; `frontend/web/src/api/identity-client.ts`; `frontend/web/src/App.tsx`; `runtime/secure-assessment/test/integration/roster-import.test.ts`; `e2e/tests/9-identity.spec.ts`. Common documentation and unresolved exact migration/contract scope follow §4.4; no source path is authorized now.

### AUTH-002 — Student claim and scoped verification/activation

- **Requirements / status / priority / risk:** R08, R09; BLOCKED; P0 / identity journey; HIGH.
- **Dependencies and approvals:** ADMIN-001; external O01, O03, O09, A03. **Unblock:** required predecessors DONE and the Task-applicable §8 READY input prerequisites plus §4 conditions; the same Task’s §8 DONE/release evidence is produced during execution and is not an entry prerequisite. No inferred approval.
- **Acceptance:** Claim alone creates no trusted/active account. Match NISN/birth date with name confirmation; ambiguous cases stay in review. Homeroom Teacher acts only in own rombel, School Operator only own tenant; transaction rechecks latest roster and uniqueness; student sets password.
- **Required tests/evidence:** P8 V01/V11/V12; simultaneous claim/approval, roster change mid-review, wrong rombel, replay, unauthorized sensitive fields and enumeration-safe errors; one official identity/account after retries. Also §4's full applicable CI/regression/independent-review and material-UI evidence gates.
- **DB/API/UI/localization impacts:** DB: claim states/constraints and atomic activation pending O03/A03. API/UI: P3 F02, claim/review screens and native accessible inputs; no invented claim expiry or trust rule.
- **Cost/vendor impact:** No new vendor or recurring dependency proposed; any implementation dependency/cost change requires explicit Owner approval.
- **Proposed future execution paths:** `runtime/identity-access/src/claims.ts`; `runtime/tenant-access/src/index.ts`; `runtime/secure-assessment/src/http/claim-routes.ts`; `runtime/secure-assessment/src/server.ts`; `frontend/web/src/api/identity-client.ts`; `frontend/web/src/components/StudentClaimView.tsx`; `frontend/web/src/components/ClaimReviewView.tsx`; `frontend/web/src/session/AppShell.tsx`; `frontend/web/src/App.tsx`; `runtime/secure-assessment/test/integration/claims.test.ts`; `e2e/tests/9-identity.spec.ts`. Common documentation and unresolved exact migration/contract scope follow §4.4; no source path is authorized now.

### AUTH-003 — In-person school-assisted recovery of the existing account

- **Requirements / status / priority / risk:** R09; BLOCKED; P0 / account continuity; HIGH.
- **Dependencies and approvals:** AUTH-002; external O03, O09, A03. **Unblock:** required predecessors DONE and the Task-applicable §8 READY input prerequisites plus §4 conditions; the same Task’s §8 DONE/release evidence is produced during execution and is not an entry prerequisite. No inferred approval.
- **Acceptance:** Scoped verifier authorizes reset of the existing identity/account after approved in-person proof. Single-use/expiry/revocation/notification follow O03; concurrent completion/replay cannot allocate a new identity or consume a token twice. Never expose credential/proof data.
- **Required tests/evidence:** P8 V01/V03/V11; expired/consumed/forged proof, wrong verifier/rombel/tenant, concurrent reset and old-session behavior; real PostgreSQL and browser recovery. Also §4's full applicable CI/regression/independent-review and material-UI evidence gates.
- **DB/API/UI/localization impacts:** DB: reset authorization/consumption/audit schema pending O03. API/UI: P3 F03 authorize/complete and recovery forms; neutral Bahasa Indonesia responses, password minimum 8 preserved.
- **Cost/vendor impact:** No new vendor or recurring dependency proposed; any implementation dependency/cost change requires explicit Owner approval.
- **Proposed future execution paths:** `runtime/identity-access/src/recovery.ts`; `runtime/identity-access/src/index.ts`; `runtime/secure-assessment/src/http/recovery-routes.ts`; `runtime/secure-assessment/src/server.ts`; `frontend/web/src/api/identity-client.ts`; `frontend/web/src/components/AccountRecoveryView.tsx`; `runtime/secure-assessment/test/integration/recovery.test.ts`; `e2e/tests/9-identity.spec.ts`. Common documentation and unresolved exact migration/contract scope follow §4.4; no source path is authorized now.

### ASSESS-QUESTION-001 — Versioned question/answer/scoring compatibility foundation

- **Requirements / status / priority / risk:** R02, R03, R10, R11, R12, R13, R14, R15, R16, R17, R25, R26; BLOCKED; P0 / question and answer integrity foundation; HIGH.
- **Dependencies and approvals:** SEC-001; external O02, O05, O09, A01. **Unblock:** required predecessors DONE and the Task-applicable §8 READY input prerequisites plus §4 conditions; the same Task’s §8 DONE/release evidence is produced during execution and is not an entry prerequisite. No inferred approval.
- **Acceptance:** Freeze and implement the approved discriminated contract and compatibility policy. Preserve all stored v1 single-choice answer/snapshot/result truth, stable IDs, durable queue/write identity/version and student-safe projection; unsupported versions fail honestly. Foundation alone is not delivery of seven missing types.
- **Required tests/evidence:** P8 V02–V06/V09–V11; v1 golden vectors and migration/old-client compatibility, unknown/foreign/type/size/keys rejection, save/reload/takeover/submit and no-key leakage. Also §4's full applicable CI/regression/independent-review and material-UI evidence gates.
- **DB/API/UI/localization impacts:** DB: snapshot/rule/grade version delta and upgrade strategy pending A01. API: same authority/envelope with approved type discrimination. UI: type-safe delivery/sync contracts only; actual controls supplied by type Tasks.
- **Cost/vendor impact:** No new vendor or recurring dependency proposed; any implementation dependency/cost change requires explicit Owner approval.
- **Proposed future execution paths:** `runtime/secure-assessment/src/question-contract.ts`; `runtime/secure-assessment/src/question-snapshot-baseline-frozen-content-contract.ts`; `runtime/secure-assessment/src/answer.ts`; `runtime/secure-assessment/src/question-delivery.ts`; `runtime/secure-assessment/src/resume.ts`; `runtime/secure-assessment/src/scoring.ts`; `frontend/web/src/api/assessment-client.ts`; `frontend/web/src/exam/answer-store.ts`; `frontend/web/src/exam/answer-sync-api.ts`; `frontend/web/src/exam/answer-sync-engine.ts`; `runtime/secure-assessment/test/integration/question-types.test.ts`; `frontend/web/src/__tests__/answerTypes.test.tsx`. Common documentation and unresolved exact migration/contract scope follow §4.4; no source path is authorized now.

### ASSESS-QUESTION-002 — Multiple response

- **Requirements / status / priority / risk:** R11, R02, R03, R25, R30; BLOCKED; P1 / all eight formats; HIGH.
- **Dependencies and approvals:** ASSESS-QUESTION-001; external O02, O09. **Unblock:** required predecessors DONE and the Task-applicable §8 READY input prerequisites plus §4 conditions; the same Task’s §8 DONE/release evidence is produced during execution and is not an entry prerequisite. No inferred approval.
- **Acceptance:** Deliver a real synthetic author/import → preview → Student answer → recovery → submit → score/grade journey for this type under the approved contract. Canonical exact correct set earns full score, otherwise zero; reject duplicates/foreign IDs, order-independent identity; no unapproved partial/negative scoring. Extend the shared type registry and existing primitives; no separate timer/save pipeline.
- **Required tests/evidence:** P8 V02–V06/V09–V12: set permutation, missing/extra IDs, offline changes and exact score; empty/upgrade database tests if schema changes, no-key projection and five-browser E2E. Also §4's full applicable CI/regression/independent-review and material-UI evidence gates.
- **DB/API/UI/localization impacts:** DB: reuse approved versioned contract; any type-specific persistence delta must be frozen before READY. API: type validation/projection/scoring in existing envelope and approved import format. UI/localization: shared type-aware answer controls, readable long content, keyboard/44px/reflow and Bahasa Indonesia.
- **Cost/vendor impact:** No new vendor or recurring dependency proposed; any implementation dependency/cost change requires explicit Owner approval.
- **Proposed future execution paths:** `runtime/secure-assessment/src/question-types/multiple-response.ts`; `runtime/secure-assessment/src/question-contract.ts`; `runtime/secure-assessment/src/question-import.ts`; `runtime/secure-assessment/src/scoring.ts`; `frontend/web/src/components/answers/MultipleResponseAnswer.tsx`; `frontend/web/src/components/StudentExamWorkstation.tsx`; `runtime/secure-assessment/test/integration/multiple-response.test.ts`; `frontend/web/src/__tests__/multiple-response.test.tsx`; `e2e/tests/10-question-types.spec.ts`. Common documentation and unresolved exact migration/contract scope follow §4.4; no source path is authorized now.

### ASSESS-QUESTION-003 — True/false

- **Requirements / status / priority / risk:** R12, R02, R03, R25, R30; BLOCKED; P1 / all eight formats; HIGH.
- **Dependencies and approvals:** ASSESS-QUESTION-001; external O02, O09. **Unblock:** required predecessors DONE and the Task-applicable §8 READY input prerequisites plus §4 conditions; the same Task’s §8 DONE/release evidence is produced during execution and is not an entry prerequisite. No inferred approval.
- **Acceptance:** Deliver a real synthetic author/import → preview → Student answer → recovery → submit → score/grade journey for this type under the approved contract. Strict boolean payload and approved exact-match scoring; no string coercion; unanswered remains distinguishable. Extend the shared type registry and existing primitives; no separate timer/save pipeline.
- **Required tests/evidence:** P8 V02–V06/V09–V12: true/false/blank, string/null rejection and recovery; empty/upgrade database tests if schema changes, no-key projection and five-browser E2E. Also §4's full applicable CI/regression/independent-review and material-UI evidence gates.
- **DB/API/UI/localization impacts:** DB: reuse approved versioned contract; any type-specific persistence delta must be frozen before READY. API: type validation/projection/scoring in existing envelope and approved import format. UI/localization: shared type-aware answer controls, readable long content, keyboard/44px/reflow and Bahasa Indonesia.
- **Cost/vendor impact:** No new vendor or recurring dependency proposed; any implementation dependency/cost change requires explicit Owner approval.
- **Proposed future execution paths:** `runtime/secure-assessment/src/question-types/true-false.ts`; `runtime/secure-assessment/src/question-contract.ts`; `runtime/secure-assessment/src/question-import.ts`; `runtime/secure-assessment/src/scoring.ts`; `frontend/web/src/components/answers/TrueFalseAnswer.tsx`; `frontend/web/src/components/StudentExamWorkstation.tsx`; `runtime/secure-assessment/test/integration/true-false.test.ts`; `frontend/web/src/__tests__/true-false.test.tsx`; `e2e/tests/10-question-types.spec.ts`. Common documentation and unresolved exact migration/contract scope follow §4.4; no source path is authorized now.

### ASSESS-QUESTION-004 — Matching

- **Requirements / status / priority / risk:** R13, R02, R03, R25, R30; BLOCKED; P1 / all eight formats; HIGH.
- **Dependencies and approvals:** ASSESS-QUESTION-001; external O02, O09. **Unblock:** required predecessors DONE and the Task-applicable §8 READY input prerequisites plus §4 conditions; the same Task’s §8 DONE/release evidence is produced during execution and is not an entry prerequisite. No inferred approval.
- **Acceptance:** Deliver a real synthetic author/import → preview → Student answer → recovery → submit → score/grade journey for this type under the approved contract. Approved cardinality, completeness and credit rules; stable left/right IDs, no duplicate left mapping; accessible keyboard/touch interaction. Extend the shared type registry and existing primitives; no separate timer/save pipeline.
- **Required tests/evidence:** P8 V02–V06/V09–V12: foreign/duplicate IDs, reusable-target policy, reordered stored pairs and recovery; empty/upgrade database tests if schema changes, no-key projection and five-browser E2E. Also §4's full applicable CI/regression/independent-review and material-UI evidence gates.
- **DB/API/UI/localization impacts:** DB: reuse approved versioned contract; any type-specific persistence delta must be frozen before READY. API: type validation/projection/scoring in existing envelope and approved import format. UI/localization: shared type-aware answer controls, readable long content, keyboard/44px/reflow and Bahasa Indonesia.
- **Cost/vendor impact:** No new vendor or recurring dependency proposed; any implementation dependency/cost change requires explicit Owner approval.
- **Proposed future execution paths:** `runtime/secure-assessment/src/question-types/matching.ts`; `runtime/secure-assessment/src/question-contract.ts`; `runtime/secure-assessment/src/question-import.ts`; `runtime/secure-assessment/src/scoring.ts`; `frontend/web/src/components/answers/MatchingAnswer.tsx`; `frontend/web/src/components/StudentExamWorkstation.tsx`; `runtime/secure-assessment/test/integration/matching.test.ts`; `frontend/web/src/__tests__/matching.test.tsx`; `e2e/tests/10-question-types.spec.ts`. Common documentation and unresolved exact migration/contract scope follow §4.4; no source path is authorized now.

### ASSESS-QUESTION-005 — Ordering

- **Requirements / status / priority / risk:** R14, R02, R03, R25, R30; BLOCKED; P1 / all eight formats; HIGH.
- **Dependencies and approvals:** ASSESS-QUESTION-001; external O02, O09. **Unblock:** required predecessors DONE and the Task-applicable §8 READY input prerequisites plus §4 conditions; the same Task’s §8 DONE/release evidence is produced during execution and is not an entry prerequisite. No inferred approval.
- **Acceptance:** Deliver a real synthetic author/import → preview → Student answer → recovery → submit → score/grade journey for this type under the approved contract. Approved full/partial sequence and score rules; stable unique identities; keyboard and touch order changes do not move targets unexpectedly. Extend the shared type registry and existing primitives; no separate timer/save pipeline.
- **Required tests/evidence:** P8 V02–V06/V09–V12: correct/swapped/incomplete/duplicate/foreign order, recovery and accessible reorder; empty/upgrade database tests if schema changes, no-key projection and five-browser E2E. Also §4's full applicable CI/regression/independent-review and material-UI evidence gates.
- **DB/API/UI/localization impacts:** DB: reuse approved versioned contract; any type-specific persistence delta must be frozen before READY. API: type validation/projection/scoring in existing envelope and approved import format. UI/localization: shared type-aware answer controls, readable long content, keyboard/44px/reflow and Bahasa Indonesia.
- **Cost/vendor impact:** No new vendor or recurring dependency proposed; any implementation dependency/cost change requires explicit Owner approval.
- **Proposed future execution paths:** `runtime/secure-assessment/src/question-types/ordering.ts`; `runtime/secure-assessment/src/question-contract.ts`; `runtime/secure-assessment/src/question-import.ts`; `runtime/secure-assessment/src/scoring.ts`; `frontend/web/src/components/answers/OrderingAnswer.tsx`; `frontend/web/src/components/StudentExamWorkstation.tsx`; `runtime/secure-assessment/test/integration/ordering.test.ts`; `frontend/web/src/__tests__/ordering.test.tsx`; `e2e/tests/10-question-types.spec.ts`. Common documentation and unresolved exact migration/contract scope follow §4.4; no source path is authorized now.

### ASSESS-QUESTION-006 — Short answer

- **Requirements / status / priority / risk:** R15, R02, R03, R25, R30; BLOCKED; P1 / all eight formats; HIGH.
- **Dependencies and approvals:** ASSESS-QUESTION-001, ASSESS-QUESTION-008; external O02, O09. **Unblock:** required predecessors DONE and the Task-applicable §8 READY input prerequisites plus §4 conditions; the same Task’s §8 DONE/release evidence is produced during execution and is not an entry prerequisite. No inferred approval.
- **Acceptance:** Deliver a real synthetic author/import → preview → Student answer → recovery → submit → score/grade journey for this type under the approved contract. Preserve exact original text; only approved whitespace/case/Unicode/accepted-form rules affect grading. No fuzzy/AI grading; manual mode uses completed essay/manual workflow. Extend the shared type registry and existing primitives; no separate timer/save pipeline.
- **Required tests/evidence:** P8 V02–V06/V09–V12: encoding/whitespace/case/empty/limit boundaries, full recovery and approved grade oracle; empty/upgrade database tests if schema changes, no-key projection and five-browser E2E. Also §4's full applicable CI/regression/independent-review and material-UI evidence gates.
- **DB/API/UI/localization impacts:** DB: reuse approved versioned contract; any type-specific persistence delta must be frozen before READY. API: type validation/projection/scoring in existing envelope and approved import format. UI/localization: shared type-aware answer controls, readable long content, keyboard/44px/reflow and Bahasa Indonesia.
- **Cost/vendor impact:** No new vendor or recurring dependency proposed; any implementation dependency/cost change requires explicit Owner approval.
- **Proposed future execution paths:** `runtime/secure-assessment/src/question-types/short-answer.ts`; `runtime/secure-assessment/src/question-contract.ts`; `runtime/secure-assessment/src/question-import.ts`; `runtime/secure-assessment/src/scoring.ts`; `frontend/web/src/components/answers/ShortAnswer.tsx`; `frontend/web/src/components/StudentExamWorkstation.tsx`; `runtime/secure-assessment/test/integration/short-answer.test.ts`; `frontend/web/src/__tests__/short-answer.test.tsx`; `e2e/tests/10-question-types.spec.ts`. Common documentation and unresolved exact migration/contract scope follow §4.4; no source path is authorized now.

### ASSESS-QUESTION-007 — Numeric answer

- **Requirements / status / priority / risk:** R16, R02, R03, R25, R30; BLOCKED; P1 / all eight formats; HIGH.
- **Dependencies and approvals:** ASSESS-QUESTION-001; external O02, O09. **Unblock:** required predecessors DONE and the Task-applicable §8 READY input prerequisites plus §4 conditions; the same Task’s §8 DONE/release evidence is produced during execution and is not an entry prerequisite. No inferred approval.
- **Acceptance:** Deliver a real synthetic author/import → preview → Student answer → recovery → submit → score/grade journey for this type under the approved contract. Preserve numeric input text and use approved exact decimal/separator/unit/exponent/tolerance rules; no floating-point assumptions. Extend the shared type registry and existing primitives; no separate timer/save pipeline.
- **Required tests/evidence:** P8 V02–V06/V09–V12: exact/boundary/outside, comma/dot, units, NaN/infinity/malformed/precision and recovery; empty/upgrade database tests if schema changes, no-key projection and five-browser E2E. Also §4's full applicable CI/regression/independent-review and material-UI evidence gates.
- **DB/API/UI/localization impacts:** DB: reuse approved versioned contract; any type-specific persistence delta must be frozen before READY. API: type validation/projection/scoring in existing envelope and approved import format. UI/localization: shared type-aware answer controls, readable long content, keyboard/44px/reflow and Bahasa Indonesia.
- **Cost/vendor impact:** No new vendor or recurring dependency proposed; any implementation dependency/cost change requires explicit Owner approval.
- **Proposed future execution paths:** `runtime/secure-assessment/src/question-types/numeric-answer.ts`; `runtime/secure-assessment/src/question-contract.ts`; `runtime/secure-assessment/src/question-import.ts`; `runtime/secure-assessment/src/scoring.ts`; `frontend/web/src/components/answers/NumericAnswer.tsx`; `frontend/web/src/components/StudentExamWorkstation.tsx`; `runtime/secure-assessment/test/integration/numeric-answer.test.ts`; `frontend/web/src/__tests__/numeric-answer.test.tsx`; `e2e/tests/10-question-types.spec.ts`. Common documentation and unresolved exact migration/contract scope follow §4.4; no source path is authorized now.

### ASSESS-QUESTION-008 — Essay and authorized human grading

- **Requirements / status / priority / risk:** R17, R02, R03, R25, R30; BLOCKED; P1 / all eight formats; HIGH.
- **Dependencies and approvals:** ASSESS-QUESTION-001; external O02, O09. **Unblock:** required predecessors DONE and the Task-applicable §8 READY input prerequisites plus §4 conditions; the same Task’s §8 DONE/release evidence is produced during execution and is not an entry prerequisite. No inferred approval.
- **Acceptance:** Deliver a real synthetic author/import → preview → Student answer → recovery → submit → score/grade journey for this type under the approved contract. Exact essay text survives all recovery paths; assigned Teacher records revision-safe bounded human score/rubric history. Ungraded is not zero and prevents finalization; no AI/file-upload answer. Extend the shared type registry and existing primitives; no separate timer/save pipeline.
- **Required tests/evidence:** P8 V02–V06/V09–V12: concurrent/stale grades, unauthorized reader/grader, ungraded finalization refusal and result reconstruction; empty/upgrade database tests if schema changes, no-key projection and five-browser E2E. Also §4's full applicable CI/regression/independent-review and material-UI evidence gates.
- **DB/API/UI/localization impacts:** DB: reuse approved versioned contract; any type-specific persistence delta must be frozen before READY. API: type validation/projection/scoring in existing envelope and approved import format. UI/localization: shared type-aware answer controls, readable long content, keyboard/44px/reflow and Bahasa Indonesia.
- **Cost/vendor impact:** No new vendor or recurring dependency proposed; any implementation dependency/cost change requires explicit Owner approval.
- **Proposed future execution paths:** `runtime/secure-assessment/src/question-types/essay.ts`; `runtime/secure-assessment/src/question-contract.ts`; `runtime/secure-assessment/src/question-import.ts`; `runtime/secure-assessment/src/scoring.ts`; `runtime/secure-assessment/src/manual-grading.ts`; `runtime/secure-assessment/src/result-finalization.ts`; `frontend/web/src/components/ManualGradingView.tsx`; `frontend/web/src/components/answers/EssayAnswer.tsx`; `frontend/web/src/components/StudentExamWorkstation.tsx`; `runtime/secure-assessment/test/integration/essay.test.ts`; `frontend/web/src/__tests__/essay.test.tsx`; `e2e/tests/10-question-types.spec.ts`. Common documentation and unresolved exact migration/contract scope follow §4.4; no source path is authorized now.

### ASSESS-STUDENT-001 — Approved late-delivery disposition and expiry integrity

- **Requirements / status / priority / risk:** R03, R04, R06; BLOCKED; P0 / integrity decision gate; HIGH.
- **Dependencies and approvals:** ASSESS-QUESTION-001; external O04. **Unblock:** required predecessors DONE and the Task-applicable §8 READY input prerequisites plus §4 conditions; the same Task’s §8 DONE/release evidence is produced during execution and is not an entry prerequisite. No inferred approval.
- **Acceptance:** Implement only an explicitly Owner-approved late-delivery rule if authorized. While the exception remains deferred, retain honest current refusal and server truth. Account for every pending/refused/acknowledged intent with no false ACK or unexplained loss; no automatic G3 waiver.
- **Required tests/evidence:** P8 V03/V05/V06/PB07; eligible pre-boundary and after-expiry intents, client absent, sweep/reconnect/submit races; exact accepted-server state and visible refusal. Also §4's full applicable CI/regression/independent-review and material-UI evidence gates.
- **DB/API/UI/localization impacts:** DB/API: no late-write exception/schema selected until O04; candidate files are conditional impact proposals. UI/localization: clear refused/expired-pending state without claiming saved.
- **Cost/vendor impact:** No new vendor or recurring dependency proposed; any implementation dependency/cost change requires explicit Owner approval.
- **Proposed future execution paths:** `runtime/secure-assessment/src/answer.ts`; `runtime/secure-assessment/src/submission.ts`; `runtime/secure-assessment/src/expiry-finalization.ts`; `frontend/web/src/exam/answer-sync-engine.ts`; `frontend/web/src/components/StudentExamWorkstation.tsx`; `runtime/secure-assessment/test/integration/late-answers.test.ts`; `e2e/tests/2-resilience.spec.ts`. Common documentation and unresolved exact migration/contract scope follow §4.4; no source path is authorized now.

### ASSESS-MEDIA-001 — Safe pinned prompt and option image delivery

- **Requirements / status / priority / risk:** R18, R19, R30; BLOCKED; P1 / required question media; HIGH.
- **Dependencies and approvals:** SEC-001, ASSESS-QUESTION-001; external O06, O07, O09, A02. **Unblock:** required predecessors DONE and the Task-applicable §8 READY input prerequisites plus §4 conditions; the same Task’s §8 DONE/release evidence is produced during execution and is not an entry prerequisite. No inferred approval.
- **Acceptance:** Validate/decode approved image formats/limits, create safe optimized renditions and pin immutable hashes/versions in snapshots. Authorized source preview differs from Student rendition. Required image usability gates normal answering; missing/corrupt image enters approved recovery without Student blame.
- **Required tests/evidence:** P8 V02/V11/V12/V14; corrupt/oversized/spoofed/path/tenant access, version replacement, image-option readability, broken-image recovery and DB/media backup manifest consistency. Also §4's full applicable CI/regression/independent-review and material-UI evidence gates.
- **DB/API/UI/localization impacts:** DB: media ownership/version/retention schema pending A02. API: P3 F05 authorized upload/rendition, no arbitrary URL/raw-original Student delivery. UI: meaningful non-answer-revealing accessibility context and responsive images.
- **Cost/vendor impact:** Storage/library choice and actual recurring-cost delta remain UNKNOWN until O06/A02/S16; no provider or new package is approved by this candidate.
- **Proposed future execution paths:** `runtime/secure-assessment/src/question-media.ts`; `runtime/secure-assessment/src/question-contract.ts`; `runtime/secure-assessment/src/question-delivery.ts`; `runtime/secure-assessment/src/server.ts`; `frontend/web/src/components/QuestionMedia.tsx`; `frontend/web/src/components/MediaUploadField.tsx`; `runtime/secure-assessment/test/integration/question-media.test.ts`; `e2e/tests/11-question-media.spec.ts`. Common documentation and unresolved exact migration/contract scope follow §4.4; no source path is authorized now.

### ASSESS-QUESTION-009 — Scoped question bank and browser authoring

- **Requirements / status / priority / risk:** R19, R10, R11, R12, R13, R14, R15, R16, R17, R18; BLOCKED; P1 / content preparation; HIGH.
- **Dependencies and approvals:** ASSESS-QUESTION-002, ASSESS-QUESTION-003, ASSESS-QUESTION-004, ASSESS-QUESTION-005, ASSESS-QUESTION-006, ASSESS-QUESTION-007, ASSESS-QUESTION-008, ASSESS-MEDIA-001; external O02, O06, O09. **Unblock:** required predecessors DONE and the Task-applicable §8 READY input prerequisites plus §4 conditions; the same Task’s §8 DONE/release evidence is produced during execution and is not an entry prerequisite. No inferred approval.
- **Acceptance:** Teacher creates/edits/validates type-aware bank items only within approved ownership/sharing scope, then pins a version into an exam. A later source edit never changes an existing exam snapshot; stale edit is explicit, no dead controls.
- **Required tests/evidence:** P8 V02/V10–V12/V14; eight types, image options, ownership/foreign item/stale edit, source-version pinning and zero-attempt preview. Also §4's full applicable CI/regression/independent-review and material-UI evidence gates.
- **DB/API/UI/localization impacts:** DB: bank/source/version ownership requires approved schema. API/UI: P3 F04 item operations and shared type-aware authoring; exact sharing/version methods frozen before READY; Bahasa Indonesia states.
- **Cost/vendor impact:** No new vendor or recurring dependency proposed; any implementation dependency/cost change requires explicit Owner approval.
- **Proposed future execution paths:** `runtime/secure-assessment/src/question-bank.ts`; `runtime/secure-assessment/src/server.ts`; `frontend/web/src/api/assessment-client.ts`; `frontend/web/src/components/QuestionBankView.tsx`; `frontend/web/src/components/QuestionEditor.tsx`; `frontend/web/src/App.tsx`; `runtime/secure-assessment/test/integration/question-bank.test.ts`; `e2e/tests/12-question-authoring.spec.ts`. Common documentation and unresolved exact migration/contract scope follow §4.4; no source path is authorized now.

### ASSESS-QUESTION-010 — Mixed-format import, validation and readiness convergence

- **Requirements / status / priority / risk:** R10, R11, R12, R13, R14, R15, R16, R17, R18, R19, R20; BLOCKED; P1 / complete content ingress; HIGH.
- **Dependencies and approvals:** ASSESS-QUESTION-009; external O02, O06. **Unblock:** required predecessors DONE and the Task-applicable §8 READY input prerequisites plus §4 conditions; the same Task’s §8 DONE/release evidence is produced during execution and is not an entry prerequisite. No inferred approval.
- **Acceptance:** Use one approved validator for author/import/preview/readiness. Full eight-type/media import is atomic/retry-safe, preview writes zero Attempts, unsupported/incomplete content cannot open. Existing A–E CSV remains compatible; schema/media package is not invented.
- **Required tests/evidence:** P8 V02/V10/V11/V14; malformed mixed rows/package, invalid key/media/limits, stale preview/hash/idempotency and old CSV import/preview/start regression. Also §4's full applicable CI/regression/independent-review and material-UI evidence gates.
- **DB/API/UI/localization impacts:** DB: import provenance/version delta if needed. API/UI: extend existing W08/W09 after F04 contract approval, reuse import and Teacher Preview components and accessible errors.
- **Cost/vendor impact:** No new vendor or recurring dependency proposed; any implementation dependency/cost change requires explicit Owner approval.
- **Proposed future execution paths:** `runtime/secure-assessment/src/question-import.ts`; `runtime/secure-assessment/src/teacher-exam-import.ts`; `runtime/secure-assessment/src/teacher-exam-preview.ts`; `runtime/secure-assessment/src/exam-instance-baseline-question-snapshot-content-readiness-preflight.ts`; `frontend/web/src/components/TeacherExamImportView.tsx`; `frontend/web/src/components/TeacherExamPreviewView.tsx`; `runtime/secure-assessment/test/integration/teacher-exam-import.test.ts`; `e2e/tests/6-teacher-import.spec.ts`. Common documentation and unresolved exact migration/contract scope follow §4.4; no source path is authorized now.

### ASSESS-INSTITUTION-001 — Institution organizer, subject and session composition

- **Requirements / status / priority / risk:** R20, R21; BLOCKED; P1 / school-scale exam governance; HIGH.
- **Dependencies and approvals:** SEC-001; external O05, O09, A04. **Unblock:** required predecessors DONE and the Task-applicable §8 READY input prerequisites plus §4 conditions; the same Task’s §8 DONE/release evidence is produced during execution and is not an entry prerequisite. No inferred approval.
- **Acceptance:** School Operator composes institution exam/session/subject responsibilities under approved O05, with assigned subject Teacher preparation before deadline. Reuse lifecycle/readiness/window/conflict invariants; no Teacher/Proctor school-wide power.
- **Required tests/evidence:** P8 V07/V10/V11/V12; actor/subject/tenant denials, invalid composition/deadline, safe duplicate creation/transition and existing teacher-managed regressions. Also §4's full applicable CI/regression/independent-review and material-UI evidence gates.
- **DB/API/UI/localization impacts:** DB: institution relationships/session/finalization boundaries pending A04. API/UI: P3 F06 creation/readiness/lifecycle screen with reason/confirmation/audit; no lifecycle rewrite.
- **Cost/vendor impact:** No new vendor or recurring dependency proposed; any implementation dependency/cost change requires explicit Owner approval.
- **Proposed future execution paths:** `runtime/secure-assessment/src/institution-exams.ts`; `runtime/secure-assessment/src/exam-lifecycle-operations.ts`; `runtime/secure-assessment/src/server.ts`; `frontend/web/src/components/InstitutionExamView.tsx`; `frontend/web/src/api/assessment-client.ts`; `frontend/web/src/session/AppShell.tsx`; `frontend/web/src/App.tsx`; `runtime/secure-assessment/test/integration/institution-exams.test.ts`; `e2e/tests/13-institution-exams.spec.ts`. Common documentation and unresolved exact migration/contract scope follow §4.4; no source path is authorized now.

### ASSESS-INSTITUTION-002 — In-product rooms, participants and Proctor assignments

- **Requirements / status / priority / risk:** R21, R20; BLOCKED; P1 / school-scale exam setup; HIGH.
- **Dependencies and approvals:** ASSESS-INSTITUTION-001; external O05, O09. **Unblock:** required predecessors DONE and the Task-applicable §8 READY input prerequisites plus §4 conditions; the same Task’s §8 DONE/release evidence is produced during execution and is not an entry prerequisite. No inferred approval.
- **Acceptance:** Operate existing room/proctor/participant capabilities through approved School Operator product flows. Enforce single current room, rombel eligibility, coverage/conflicts and assignment history; readiness rechecks atomic changes. No participant removal under OPEN-05.
- **Required tests/evidence:** P8 V07/V10/V11/V12; duplicate/wrong-tenant room, invalid participant/proctor, revoked assignment, conflicts, replay and incomplete coverage prevents readiness. Also §4's full applicable CI/regression/independent-review and material-UI evidence gates.
- **DB/API/UI/localization impacts:** DB: reuse building blocks; exact new audit/assignment delta before READY. API/UI: scoped F06 management with accessible keyboard/touch controls and explicit refusal.
- **Cost/vendor impact:** No new vendor or recurring dependency proposed; any implementation dependency/cost change requires explicit Owner approval.
- **Proposed future execution paths:** `runtime/secure-assessment/src/institution-rooms.ts`; `runtime/secure-assessment/src/exam-participant-academic-enrollment-assignment.ts`; `runtime/secure-assessment/src/server.ts`; `frontend/web/src/components/InstitutionRoomManagementView.tsx`; `runtime/secure-assessment/test/integration/institution-rooms.test.ts`; `e2e/tests/13-institution-exams.spec.ts`. Common documentation and unresolved exact migration/contract scope follow §4.4; no source path is authorized now.

### ASSESS-INSTITUTION-003 — School Operator drill-down and audited bounded controls

- **Requirements / status / priority / risk:** R21, R23, R28; BLOCKED; P1 / operational supervision; HIGH.
- **Dependencies and approvals:** ASSESS-INSTITUTION-002; external O05, O09. **Unblock:** required predecessors DONE and the Task-applicable §8 READY input prerequisites plus §4 conditions; the same Task’s §8 DONE/release evidence is produced during execution and is not an entry prerequisite. No inferred approval.
- **Acceptance:** School Operator sees authorized school exam → room → participant status and approved operations with reason/confirmation/audit. Preserve monitoring freshness, Teacher-only/assigned authority and no scores/grade edits/cheating verdicts.
- **Required tests/evidence:** P8 V07/V11/V12; all-school scoped read versus other tenant, target substitution, stale room/revoked role, duplicate control and audit evidence; same teacher-managed control regression. Also §4's full applicable CI/regression/independent-review and material-UI evidence gates.
- **DB/API/UI/localization impacts:** DB/API: scoped read/control queries and audit delta, no authority inferred from platform provisioning. UI: School Operator drill-down and explicit status/failure states in shared components.
- **Cost/vendor impact:** No new vendor or recurring dependency proposed; any implementation dependency/cost change requires explicit Owner approval.
- **Proposed future execution paths:** `runtime/secure-assessment/src/school-exam-monitoring.ts`; `runtime/secure-assessment/src/supervision-scope.ts`; `runtime/secure-assessment/src/participant-lock.ts`; `runtime/secure-assessment/src/participant-time.ts`; `runtime/secure-assessment/src/server.ts`; `frontend/web/src/components/SchoolExamMonitoringView.tsx`; `runtime/secure-assessment/test/integration/school-exam-monitoring.test.ts`; `e2e/tests/14-school-supervision.spec.ts`. Common documentation and unresolved exact migration/contract scope follow §4.4; no source path is authorized now.

### ASSESS-ROOM-001 — Atomic participant room transfer during running exams

- **Requirements / status / priority / risk:** R03, R04, R06, R22, R23; BLOCKED; P0 / transfer integrity; HIGH.
- **Dependencies and approvals:** ASSESS-INSTITUTION-002, ASSESS-INSTITUTION-003; external O05, O09, A04. **Unblock:** required predecessors DONE and the Task-applicable §8 READY input prerequisites plus §4 conditions; the same Task’s §8 DONE/release evidence is produced during execution and is not an entry prerequisite. No inferred approval.
- **Acceptance:** Reason/confirmation/replay/revision guarded School Operator move preserves Person, Participant, Attempt, snapshot/randomization, accepted/pending answers, time and submission. Exactly one current room plus append-only history; old-room Proctor loses access at committed boundary. Session continuity follows approved A04, never guessed.
- **Required tests/evidence:** P8 V03/V05/V06/V07/V11/V15; simultaneous save/submit/expiry/lock/takeover/opposed transfers, lost ACK/replay, lock ordering and server-before/after comparison. Also §4's full applicable CI/regression/independent-review and material-UI evidence gates.
- **DB/API/UI/localization impacts:** DB: transactional transfer/history/version and lock order pending A04. API/UI: F07 transfer command, explicit stale-target conflict/reload; no session secret disclosure.
- **Cost/vendor impact:** No new vendor or recurring dependency proposed; any implementation dependency/cost change requires explicit Owner approval.
- **Proposed future execution paths:** `runtime/secure-assessment/src/participant-room-transfer.ts`; `runtime/secure-assessment/src/supervision-scope.ts`; `runtime/secure-assessment/src/answer.ts`; `runtime/secure-assessment/src/submission.ts`; `runtime/secure-assessment/src/session.ts`; `runtime/secure-assessment/src/server.ts`; `frontend/web/src/components/ParticipantRoomTransferDialog.tsx`; `runtime/secure-assessment/test/integration/participant-room-transfer.test.ts`; `e2e/tests/15-room-transfer.spec.ts`. Common documentation and unresolved exact migration/contract scope follow §4.4; no source path is authorized now.

### ASSESS-PROCTOR-003 — STANDAR risk feed and human incident journey

- **Requirements / status / priority / risk:** R24, R28, R30; BLOCKED; P1 / honest supervision evidence; HIGH.
- **Dependencies and approvals:** SEC-001, ASSESS-INSTITUTION-003; external O08, O09, A05. **Unblock:** required predecessors DONE and the Task-applicable §8 READY input prerequisites plus §4 conditions; the same Task’s §8 DONE/release evidence is produced during execution and is not an entry prerequisite. No inferred approval.
- **Acceptance:** Student signals carry honest per-environment support/delay and server-derived scope. Bounded dedupe/ingestion cannot block save/submit. Assigned Proctor/School Operator reviews scoped feed and opens/closes incidents with attributable reason/history/revision; no automated sanction or score change.
- **Required tests/evidence:** P8 V07/V11–V13/V15; spoofed actor/time/scope, duplicate/offline/unsupported signals, rate/backpressure isolation, stale incident revision, privacy and current-room revocation. Also §4's full applicable CI/regression/independent-review and material-UI evidence gates.
- **DB/API/UI/localization impacts:** DB: minimized signal/incident storage/retention/index/cleanup pending A05. API/UI: F08 ingestion/feed/incident operations, neutral Bahasa Indonesia warning and accessible status; approved reopen policy only.
- **Cost/vendor impact:** No new vendor or recurring dependency proposed; any implementation dependency/cost change requires explicit Owner approval.
- **Proposed future execution paths:** `runtime/secure-assessment/src/risk-signals.ts`; `runtime/secure-assessment/src/incidents.ts`; `runtime/secure-assessment/src/server.ts`; `frontend/web/src/exam/risk-signals.ts`; `frontend/web/src/components/RiskSignalFeed.tsx`; `frontend/web/src/components/IncidentReviewView.tsx`; `runtime/secure-assessment/test/integration/risk-incidents.test.ts`; `e2e/tests/16-risk-incidents.spec.ts`. Common documentation and unresolved exact migration/contract scope follow §4.4; no source path is authorized now.

### RESULT-004 — Full-type and institution result finalization/reporting

- **Requirements / status / priority / risk:** R25, R26; BLOCKED; P1 / trustworthy complete results; HIGH.
- **Dependencies and approvals:** ASSESS-QUESTION-002, ASSESS-QUESTION-003, ASSESS-QUESTION-004, ASSESS-QUESTION-005, ASSESS-QUESTION-006, ASSESS-QUESTION-007, ASSESS-QUESTION-008, ASSESS-INSTITUTION-001; external O02, O05, O09, A01. **Unblock:** required predecessors DONE and the Task-applicable §8 READY input prerequisites plus §4 conditions; the same Task’s §8 DONE/release evidence is produced during execution and is not an entry prerequisite. No inferred approval.
- **Acceptance:** Every type and institution subject follows approved scoring/aggregation. Required manual work blocks finalization; absent/ungraded/zero stay distinct. Preserve frozen v1 truth, revision/history, idempotent finalization and reconstructable raw/max/scaled totals; authorized CSV/print remain spreadsheet-safe.
- **Required tests/evidence:** P8 V09/V11/V12; golden vectors, concurrent grades/finalization, incomplete grading/running Attempt refusal, wrong-subject grader, frozen result tamper and full-type export. Also §4's full applicable CI/regression/independent-review and material-UI evidence gates.
- **DB/API/UI/localization impacts:** DB: compatible result/grade/frozen aggregation schema pending A01/O05. API/UI: extend existing Teacher results and manual grading, no School Operator score access or implicit publication.
- **Cost/vendor impact:** No new vendor or recurring dependency proposed; any implementation dependency/cost change requires explicit Owner approval.
- **Proposed future execution paths:** `runtime/secure-assessment/src/scoring.ts`; `runtime/secure-assessment/src/manual-grading.ts`; `runtime/secure-assessment/src/result-finalization.ts`; `runtime/secure-assessment/src/teacher-results.ts`; `frontend/web/src/components/TeacherResultsView.tsx`; `frontend/web/src/components/ManualGradingView.tsx`; `runtime/secure-assessment/test/integration/teacher-results.test.ts`; `e2e/tests/4-results.spec.ts`. Common documentation and unresolved exact migration/contract scope follow §4.4; no source path is authorized now.

### RESULT-003 — Teacher publication and Student own finalized score

- **Requirements / status / priority / risk:** R27, R26; BLOCKED; P1 / result delivery; HIGH.
- **Dependencies and approvals:** RESULT-004; external O05, O09. **Unblock:** required predecessors DONE and the Task-applicable §8 READY input prerequisites plus §4 conditions; the same Task’s §8 DONE/release evidence is produced during execution and is not an entry prerequisite. No inferred approval.
- **Acceptance:** Explicit authorized Teacher publishes finalized results per exam; Student sees own score only, no ranking/peer results. END/finalize never auto-publishes; withdrawal/correction behavior must be approved before implementation. OD-09 is settled and not reopened.
- **Required tests/evidence:** P8 V09/V11/V12; unpublished/not-finalized/foreign exam/peer score denials, replay and visibility transitions; cache/DOM/export privacy. Also §4's full applicable CI/regression/independent-review and material-UI evidence gates.
- **DB/API/UI/localization impacts:** DB: publication provenance/state version pending approved details. API/UI: P3 F09 publication/my-results and Student result screen with accessible Indonesian states.
- **Cost/vendor impact:** No new vendor or recurring dependency proposed; any implementation dependency/cost change requires explicit Owner approval.
- **Proposed future execution paths:** `runtime/secure-assessment/src/result-publication.ts`; `runtime/secure-assessment/src/server.ts`; `frontend/web/src/components/ResultPublicationDialog.tsx`; `frontend/web/src/components/StudentResultsView.tsx`; `frontend/web/src/api/assessment-client.ts`; `frontend/web/src/App.tsx`; `runtime/secure-assessment/test/integration/result-publication.test.ts`; `e2e/tests/17-result-publication.spec.ts`. Common documentation and unresolved exact migration/contract scope follow §4.4; no source path is authorized now.

### SEC-OPS-001 — Audited operational/session intervention

- **Requirements / status / priority / risk:** R07, R23, R28, R29; BLOCKED; P0 / operational security; HIGH.
- **Dependencies and approvals:** SEC-001, AUTH-003; external O03, O09, PB12. **Unblock:** required predecessors DONE and the Task-applicable §8 READY input prerequisites plus §4 conditions; the same Task’s §8 DONE/release evidence is produced during execution and is not an entry prerequisite. No inferred approval.
- **Acceptance:** Replace runbook manual-SQL session revocation with an approved case-scoped audited owning-module command/path. Prove required revocation behavior, actor/reason/outcome and failure handling; no broad platform academic bypass or agent production SQL.
- **Required tests/evidence:** P8 V01/V11/V16; unauthorized/cross-case/tenant denial, atomic audit+revocation, retries, old session refusal and no credential logging; synthetic CLI/HTTP integration only. Also §4's full applicable CI/regression/independent-review and material-UI evidence gates.
- **DB/API/UI/localization impacts:** DB: existing sessions/audit reuse or approved audit delta. API/UI: privileged operational command chosen in future contract, no general admin screen implied. Runbook updated with actual tested behavior.
- **Cost/vendor impact:** No new vendor or recurring dependency proposed; any implementation dependency/cost change requires explicit Owner approval.
- **Proposed future execution paths:** `runtime/identity-access/src/index.ts`; `runtime/secure-assessment/src/ops/revoke-session-cli.ts`; `runtime/secure-assessment/src/ops/provisioning/audit.ts`; `runtime/secure-assessment/test/integration/session-intervention.test.ts`; `docs/production/OPERATIONS_RUNBOOK.md`. Common documentation and unresolved exact migration/contract scope follow §4.4; no source path is authorized now.

### OPS-STAGING-001 — Authorized isolated synthetic staging and measurement readiness

- **Requirements / status / priority / risk:** R28, R29, R31; BLOCKED; P0 / external environment prerequisite; HIGH.
- **Dependencies and approvals:** No internal predecessor; external O07, S01-S16, ACCESS, COST. **Unblock:** required predecessors DONE and the Task-applicable §8 READY input prerequisites plus §4 conditions; the same Task’s §8 DONE/release evidence is produced during execution and is not an entry prerequisite. No inferred approval.
- **Acceptance:** On a separately authorized target, establish reproducible staging topology/config/schema/image/resource facts, synthetic provisioning and private telemetry/alert delivery needed for measurements/rehearsals. Record production-equivalence differences; no real students, deployment authority or capacity claim.
- **Required tests/evidence:** P8 V16; P9 OI01–OI04/OI07; exact image/schema/config/resource manifest, TLS/auth/edge/internal metrics tests and received synthetic alert; no Owner-workstation services. Also §4's full applicable CI/regression/independent-review and material-UI evidence gates.
- **DB/API/UI/localization impacts:** DB: isolated synthetic database only under later explicit ops authority, no production overwrite. API/UI: existing app/probes and protected metrics; no business route or visual redesign.
- **Cost/vendor impact:** Actual school resources/collector/generator/cost facts UNKNOWN; no purchase or provider selected. Separate target/access/billing authorization mandatory.
- **Proposed future execution paths:** `deploy/staging/README.md`; `deploy/staging/compose.yml`; `deploy/monitoring/staging-prometheus.yml`; `docs/production/STAGING_ENVIRONMENT_EVIDENCE.md`; `docs/production/OPERATIONS_RUNBOOK.md`. Common documentation and unresolved exact migration/contract scope follow §4.4; no source path is authorized now.

### PERF-001 — Production-equivalent full-workload capacity evidence

- **Requirements / status / priority / risk:** R01, R02, R03, R04, R06, R18, R22, R23, R24, R28, R31; BLOCKED; P0 / G4 evidence; HIGH.
- **Dependencies and approvals:** OPS-STAGING-001, AUTH-003, ASSESS-QUESTION-010, ASSESS-ROOM-001, ASSESS-PROCTOR-003, RESULT-003; external O07, O02, O06, O08, LOAD-TOOL. **Unblock:** required predecessors DONE and the Task-applicable §8 READY input prerequisites plus §4 conditions; the same Task’s §8 DONE/release evidence is produced during execution and is not an entry prerequisite. No inferred approval.
- **Acceptance:** Run accepted P6 L01–L10/B01–B10 for approximately 1,000 distinct concurrent Students, all types/media, NAT, dashboards, save/reconnect/submit/restart/races and signal isolation. Record offered/achieved load, raw latency/error/resource/DB evidence and exact server-answer oracle. First failure retained, no retry-to-PASS.
- **Required tests/evidence:** P8 V15 and P6 protocols; independent generator/target manifests, fixture/seed/hash, clock/resource/generator saturation evidence; all approved budgets and invariants pass. Also §4's full applicable CI/regression/independent-review and material-UI evidence gates.
- **DB/API/UI/localization impacts:** DB/API: synthetic workload over real APIs, no authority bypass or schema shortcut; missing measurement instrumentation must be explicitly frozen in execution allowlist before READY. UI: workload represents actual polling/resync, not invented local ticks.
- **Cost/vendor impact:** Open-source load tool/version and isolated generator resources not selected; O07/LOAD-TOOL/S16 approval before installation/execution; no paid service assumed.
- **Proposed future execution paths:** `load/cbt-r1/scenarios.ts`; `load/cbt-r1/server-answer-oracle.ts`; `load/cbt-r1/README.md`; `runtime/secure-assessment/src/metrics.ts`; `runtime/secure-assessment/src/db.ts`; `docs/production/CBT_CAPACITY_EVIDENCE.md`. Common documentation and unresolved exact migration/contract scope follow §4.4; no source path is authorized now.

### OPS-001 — School VPS TLS, automated off-host backup and restore proof

- **Requirements / status / priority / risk:** R02, R18, R28, R29; BLOCKED; P0 / G8 operational evidence; HIGH.
- **Dependencies and approvals:** OPS-STAGING-001, ASSESS-MEDIA-001, SEC-OPS-001; external O07, S01-S16, PB02, PB12, ACCESS, COST. **Unblock:** required predecessors DONE and the Task-applicable §8 READY input prerequisites plus §4 conditions; the same Task’s §8 DONE/release evidence is produced during execution and is not an entry prerequisite. No inferred approval.
- **Acceptance:** Prove actual school-domain TLS/renewal, private edge/metrics, active alerts, scheduled encrypted off-host backups and independent recovery key custody. Execute authorized isolated production-infrastructure restore using P9 RT01–RT08; compare DB/answers/audit/frozen results/pinned media and every later ACK. Unknown RPO/RTO or unexplained accepted-write loss fails.
- **Required tests/evidence:** P8 V16/V17; P9 OI01–OI10/RT01–RT08, failure-alert delivery, measured recovery against approved objectives and independent restore review. Never restore over live data or disable migration checks. Also §4's full applicable CI/regression/independent-review and material-UI evidence gates.
- **DB/API/UI/localization impacts:** DB: no new business schema; backup/restore/migration-state operations require exact separate target authorization. API/UI: synthetic full-stack probes; runbook reflects tested audited procedures. No coding-agent production SQL.
- **Cost/vendor impact:** Actual VPS/backup/off-host/storage/traffic/monitoring cost UNKNOWN; approve resources and recurring delta explicitly; no provider selected here.
- **Proposed future execution paths:** `deploy/backup/README.md`; `deploy/backup/backup.sh`; `deploy/backup/restore-verify.sh`; `deploy/nginx/elligble.conf`; `deploy/monitoring/README.md`; `docs/production/OPERATIONS_RUNBOOK.md`; `docs/production/SCHOOL_OPERATIONS_EVIDENCE.md`; `docs/state/PRODUCTION_BLOCKERS_BACKLOG.md`. Common documentation and unresolved exact migration/contract scope follow §4.4; no source path is authorized now.

### VERIFY-INTEGRITY-001 — Complete PB07 server-answer integrity artifact

- **Requirements / status / priority / risk:** R01, R02, R03, R04, R05, R06, R10, R11, R12, R13, R14, R15, R16, R17, R18, R22, R31; BLOCKED; P0 / G3 final evidence; HIGH.
- **Dependencies and approvals:** ASSESS-STUDENT-001, ASSESS-QUESTION-010, ASSESS-ROOM-001, PERF-001, OPS-001; external O04, O05, PB07-REVIEW. **Unblock:** required predecessors DONE and the Task-applicable §8 READY input prerequisites plus §4 conditions; the same Task’s §8 DONE/release evidence is produced during execution and is not an entry prerequisite. No inferred approval.
- **Entry versus completion:** PB07-REVIEW requires appropriate independent reviewer availability/authority and agreed scope before execution when needed. This Task produces the PB07 report; independent report review PASS and authorized controlled PB07 closure are mandatory before DONE. PB07 remains OPEN until valid closure evidence exists.
- **Acceptance:** Consolidate and verify all P8 PB07 scenarios: offline/reload/browser restart/takeover/running transfer/server restart/expiry/pause-lock/submit storm across eight types/media. Join durable intent, receipt and DB payload/version/write identities and legitimate superseding writes. No unexplained loss/false ACK/duplicate Attempt/submission/time reset; policy-blocked required case prevents PASS.
- **Required tests/evidence:** P8 §6/V02–V06/V15/V17; scenario journal/manifests and server comparison, independent integrity review; consume load/restore evidence without requiring this Task DONE as their prerequisite. Also §4's full applicable CI/regression/independent-review and material-UI evidence gates.
- **DB/API/UI/localization impacts:** DB/API: read-only evidence oracle plus scoped synthetic fault harness under future target authority, not production mutation. UI: honest saved/pending/refused states tested; no styling task.
- **Cost/vendor impact:** No new vendor or recurring dependency proposed; any implementation dependency/cost change requires explicit Owner approval.
- **Proposed future execution paths:** `e2e/tests/18-answer-integrity.spec.ts`; `e2e/tests/integrity-oracle.ts`; `docs/production/ZERO_LOST_ANSWER_VERIFICATION.md`; `docs/state/PRODUCTION_BLOCKERS_BACKLOG.md`. Common documentation and unresolved exact migration/contract scope follow §4.4; no source path is authorized now.

### DEVICE-001 — Real-device and minimum functional accessibility verification

- **Requirements / status / priority / risk:** R01, R02, R03, R04, R05, R06, R08, R09, R10, R11, R12, R13, R14, R15, R16, R17, R18, R20, R21, R22, R23, R24, R25, R26, R27, R30; BLOCKED; P0 / G5 capability evidence; HIGH.
- **Dependencies and approvals:** AUTH-003, ASSESS-QUESTION-010, ASSESS-ROOM-001, ASSESS-PROCTOR-003, RESULT-003, OPS-STAGING-001; external O07, O08, DEVICE-ACCESS. **Unblock:** required predecessors DONE and the Task-applicable §8 READY input prerequisites plus §4 conditions; the same Task’s §8 DONE/release evidence is produced during execution and is not an entry prerequisite. No inferred approval.
- **Acceptance:** Execute approved PB06 physical Android Chrome/iPhone Safari/Android tablet/iPad Safari/desktop Chrome+Edge matrix. Validate 360/390/430/768/1024/1280/1440 where applicable, short landscape/200% text/safe areas, keyboard/focus/44px, long content/images/recovery and honest split-screen/multi-window support. CI engine emulation is supporting evidence only.
- **Required tests/evidence:** P8 §5/V12/V13; exact devices/OS/browser/candidate/scenario/limitation, actual screenshots, manual keyboard/screen-reader inspection and accessibility checks. Failed functional/a11y gate blocks completion; no cosmetic expansion or self-certified blanket WCAG claim. Also §4's full applicable CI/regression/independent-review and material-UI evidence gates.
- **DB/API/UI/localization impacts:** DB/API: none changed, synthetic staging use only. UI/localization: verify existing/new functional flows, Bahasa Indonesia; any discovered material source defect requires separately authorized bounded correction, not this evidence-only allowlist.
- **Cost/vendor impact:** No new vendor or recurring dependency proposed; any implementation dependency/cost change requires explicit Owner approval.
- **Proposed future execution paths:** `docs/production/ASSESSMENT_CAPABILITY_TEST_REPORT.md`; `docs/state/PRODUCTION_BLOCKERS_BACKLOG.md`. Common documentation and unresolved exact migration/contract scope follow §4.4; no source path is authorized now.

### LEGAL-001 — Qualified privacy/legal artifacts and closure evidence

- **Requirements / status / priority / risk:** R07, R08, R09, R24, R28, R29; BLOCKED; P0 / before real student data; HIGH.
- **Dependencies and approvals:** No internal predecessor; READY input gate LEGAL-SIGNATORIES. PB01/PB02/PB03/PB10 approved artifacts and controlled closures are this Task’s DONE outcomes, not entry prerequisites. **Unblock:** required predecessors DONE and the Task-applicable §8 READY input prerequisites plus §4 conditions; the same Task’s §8 DONE/release evidence is produced during execution and is not an entry prerequisite. No inferred approval.
- **Entry versus completion:** qualified legal/privacy authority availability, source-material access and approved artifact-handling/disclosure scope precede execution. Obtaining qualified PB01/PB02/PB03/PB10 artifact approvals and authorized controlled closure is required before DONE. G7 forbids real student data until applicable legal requirements are satisfied.
- **Acceptance:** Collect authoritative Controller/Processor allocation, retention matrix, DPIA or qualified documented determination, classification/consent artifacts and required approvals. Record their actual qualified provenance and controlled closure evidence; no legal policy invented by executor and no real data until G7.
- **Required tests/evidence:** Document completeness/reference/date/signatory and cross-artifact consistency review by qualified legal/privacy authority; synthetic regression evidence is not legal approval. Also §4's full applicable CI/regression/independent-review and material-UI evidence gates.
- **DB/API/UI/localization impacts:** DB/API/UI/localization: no implementation by this Task. Exact artifact disclosure/redaction/storage scope approved before publishing; personal/legal confidential material never pasted into Git by default.
- **Cost/vendor impact:** No service/vendor proposed; qualified legal input and publication/privacy approval required, any external cost separately approved.
- **Proposed future execution paths:** `docs/production/LEGAL_RELEASE_EVIDENCE.md`; `docs/state/PRODUCTION_BLOCKERS_BACKLOG.md`. Common documentation and unresolved exact migration/contract scope follow §4.4; no source path is authorized now.

### SEC-RELEASE-001 — Complete security and permission release evidence

- **Requirements / status / priority / risk:** R07, R08, R09, R18, R20, R21, R22, R23, R24, R25, R26, R27, R28, R29; BLOCKED; P0 / G6 final verification; HIGH.
- **Dependencies and approvals:** AUTH-003, ASSESS-QUESTION-010, ASSESS-ROOM-001, ASSESS-PROCTOR-003, RESULT-003, SEC-OPS-001, OPS-001, LEGAL-001; external O09, PB12, SECURITY-REVIEW. **Unblock:** required predecessors DONE and the Task-applicable §8 READY input prerequisites plus §4 conditions; the same Task’s §8 DONE/release evidence is produced during execution and is not an entry prerequisite. No inferred approval.
- **Entry versus completion:** SECURITY-REVIEW requires reviewer assignment/availability/authority and secure evidence access before execution. Execute all P5 A01–A14/N01–N10 verification, then obtain independent HIGH-risk review PASS and required authorized PB05/PB12 closure evidence before DONE; completed review is not an input to its own verification.
- **Acceptance:** Verify every implemented P5 A01–A14 row and N01–N10 negative against exact release candidate, including identity/media/grade/export/cache/room races and deployed security edges. Named incident lead/duties/contacts and audited intervention proven. PB05/PB12 closure needs required actual evidence and authorized review, not planning acceptance.
- **Required tests/evidence:** P8 V01/V11/V16; independent HIGH-risk security review, tenant/assignment/object/TOCTOU negatives with unchanged denied state, privacy/secret scan and deployed header/edge/private metrics evidence. Also §4's full applicable CI/regression/independent-review and material-UI evidence gates.
- **DB/API/UI/localization impacts:** DB/API/UI: verification only unless separately authorized corrective Task; no policy or production-config weakening. Exact evidence-redaction scope before READY.
- **Cost/vendor impact:** No new vendor or recurring dependency proposed; any implementation dependency/cost change requires explicit Owner approval.
- **Proposed future execution paths:** `e2e/tests/3-security.spec.ts`; `runtime/secure-assessment/test/integration/security-release.test.ts`; `docs/production/CBT_SECURITY_RELEASE_EVIDENCE.md`; `docs/state/PRODUCTION_BLOCKERS_BACKLOG.md`. Common documentation and unresolved exact migration/contract scope follow §4.4; no source path is authorized now.

### RELEASE-001 — Full regression, school UAT, rehearsal and release dossier

- **Requirements / status / priority / risk:** R01, R02, R03, R04, R05, R06, R07, R08, R09, R10, R11, R12, R13, R14, R15, R16, R17, R18, R19, R20, R21, R22, R23, R24, R25, R26, R27, R28, R29, R30, R31; BLOCKED; P0 / final baseline evidence handoff; HIGH.
- **Dependencies and approvals:** VERIFY-INTEGRITY-001, DEVICE-001, PERF-001, OPS-001, SEC-RELEASE-001, LEGAL-001, RESULT-003; external S01-S16, UAT-SIGNATORIES, RELEASE-AUTHORITY, COST. **Unblock:** required predecessors DONE and the Task-applicable §8 READY input prerequisites plus §4 conditions; the same Task’s §8 DONE/release evidence is produced during execution and is not an entry prerequisite. No inferred approval.
- **Entry versus completion:** nominated and authorized UA01–UA08 participants/signatories, availability, access and approved protocol/criteria precede execution. Actual UA01–UA08 candidate-specific signoffs, completed rehearsals and approved final DB/cost declarations are generated and required as completion evidence before DONE/G9/G10; no G1–G10 gate is weakened.
- **Acceptance:** Complete P10 RR01–RR08/UA01–UA08 on exact candidate: full roles/journeys, staging migration/recovery/rollback rehearsal, nominated school signoffs, known compatible recovery target and explicit DB/recurring-cost declarations. Compile G1–G10 disposition with no missing case marked PASS. This Task hands over evidence; it does not deploy or approve release.
- **Required tests/evidence:** P8 V18/full unchanged CI and critical regression plus real school UAT; zero known P0/P1 release/auth/loss/duplicate-account defect, no production fake. Independent release review; G1 evaluated after all baseline Tasks including this one reach DONE. Also §4's full applicable CI/regression/independent-review and material-UI evidence gates.
- **DB/API/UI/localization impacts:** DB: rehearsal of declared migrations/schema/restore compatibility only on authorized target. API/UI: full verification and functional UAT, no redesign. Production switch/deployment and final Owner go/no-go remain separately authorized outside this Task.
- **Cost/vendor impact:** Record actual S16 amount/basis/period and explicit approved recurring delta; UNKNOWN is not NO. No purchase/deployment authorization.
- **Proposed future execution paths:** `docs/production/CBT_RELEASE_EVIDENCE.md`; `docs/production/OPERATIONS_RUNBOOK.md`. Common documentation and unresolved exact migration/contract scope follow §4.4; no source path is authorized now.

## 6. Complete R01–R31 coverage

[P2 §7](CBT_DOMAIN_RULES_SPECIFICATION.md) is the canonical consolidated implementation/gap map; the table below assigns remaining implementation/verification work without rewriting its statuses. Existing Student R01–R06 and single-choice R10 remain reused; their missing full-release evidence is planned explicitly. Coverage requires a dedicated row beyond RELEASE-001's final regression catch-all.

| Requirement | Candidate implementation / dedicated evidence Tasks (in addition to RELEASE-001 full regression) |
|---|---|
| R01 | PERF-001, VERIFY-INTEGRITY-001, DEVICE-001 |
| R02 | ASSESS-QUESTION-001, ASSESS-QUESTION-002, ASSESS-QUESTION-003, ASSESS-QUESTION-004, ASSESS-QUESTION-005, ASSESS-QUESTION-006, ASSESS-QUESTION-007, ASSESS-QUESTION-008, PERF-001, OPS-001, VERIFY-INTEGRITY-001, DEVICE-001 |
| R03 | ASSESS-QUESTION-001, ASSESS-QUESTION-002, ASSESS-QUESTION-003, ASSESS-QUESTION-004, ASSESS-QUESTION-005, ASSESS-QUESTION-006, ASSESS-QUESTION-007, ASSESS-QUESTION-008, ASSESS-STUDENT-001, ASSESS-ROOM-001, PERF-001, VERIFY-INTEGRITY-001, DEVICE-001 |
| R04 | ASSESS-STUDENT-001, ASSESS-ROOM-001, PERF-001, VERIFY-INTEGRITY-001, DEVICE-001 |
| R05 | VERIFY-INTEGRITY-001, DEVICE-001 |
| R06 | ASSESS-STUDENT-001, ASSESS-ROOM-001, PERF-001, VERIFY-INTEGRITY-001, DEVICE-001 |
| R07 | SEC-001, AUTH-001, SEC-OPS-001, LEGAL-001, SEC-RELEASE-001 |
| R08 | AUTH-001, ADMIN-001, AUTH-002, DEVICE-001, LEGAL-001, SEC-RELEASE-001 |
| R09 | AUTH-001, ADMIN-001, AUTH-002, AUTH-003, DEVICE-001, LEGAL-001, SEC-RELEASE-001 |
| R10 | ASSESS-QUESTION-001, ASSESS-QUESTION-009, ASSESS-QUESTION-010, VERIFY-INTEGRITY-001, DEVICE-001 |
| R11 | ASSESS-QUESTION-001, ASSESS-QUESTION-002, ASSESS-QUESTION-009, ASSESS-QUESTION-010, VERIFY-INTEGRITY-001, DEVICE-001 |
| R12 | ASSESS-QUESTION-001, ASSESS-QUESTION-003, ASSESS-QUESTION-009, ASSESS-QUESTION-010, VERIFY-INTEGRITY-001, DEVICE-001 |
| R13 | ASSESS-QUESTION-001, ASSESS-QUESTION-004, ASSESS-QUESTION-009, ASSESS-QUESTION-010, VERIFY-INTEGRITY-001, DEVICE-001 |
| R14 | ASSESS-QUESTION-001, ASSESS-QUESTION-005, ASSESS-QUESTION-009, ASSESS-QUESTION-010, VERIFY-INTEGRITY-001, DEVICE-001 |
| R15 | ASSESS-QUESTION-001, ASSESS-QUESTION-006, ASSESS-QUESTION-009, ASSESS-QUESTION-010, VERIFY-INTEGRITY-001, DEVICE-001 |
| R16 | ASSESS-QUESTION-001, ASSESS-QUESTION-007, ASSESS-QUESTION-009, ASSESS-QUESTION-010, VERIFY-INTEGRITY-001, DEVICE-001 |
| R17 | ASSESS-QUESTION-001, ASSESS-QUESTION-008, ASSESS-QUESTION-009, ASSESS-QUESTION-010, VERIFY-INTEGRITY-001, DEVICE-001 |
| R18 | ASSESS-MEDIA-001, ASSESS-QUESTION-009, ASSESS-QUESTION-010, PERF-001, OPS-001, VERIFY-INTEGRITY-001, DEVICE-001, SEC-RELEASE-001 |
| R19 | ASSESS-MEDIA-001, ASSESS-QUESTION-009, ASSESS-QUESTION-010 |
| R20 | ASSESS-QUESTION-010, ASSESS-INSTITUTION-001, ASSESS-INSTITUTION-002, DEVICE-001, SEC-RELEASE-001 |
| R21 | SEC-001, ASSESS-INSTITUTION-001, ASSESS-INSTITUTION-002, ASSESS-INSTITUTION-003, DEVICE-001, SEC-RELEASE-001 |
| R22 | ASSESS-ROOM-001, PERF-001, VERIFY-INTEGRITY-001, DEVICE-001, SEC-RELEASE-001 |
| R23 | SEC-001, ASSESS-INSTITUTION-003, ASSESS-ROOM-001, SEC-OPS-001, PERF-001, DEVICE-001, SEC-RELEASE-001 |
| R24 | ASSESS-PROCTOR-003, PERF-001, DEVICE-001, LEGAL-001, SEC-RELEASE-001 |
| R25 | ASSESS-QUESTION-001, ASSESS-QUESTION-002, ASSESS-QUESTION-003, ASSESS-QUESTION-004, ASSESS-QUESTION-005, ASSESS-QUESTION-006, ASSESS-QUESTION-007, ASSESS-QUESTION-008, RESULT-004, DEVICE-001, SEC-RELEASE-001 |
| R26 | ASSESS-QUESTION-001, RESULT-004, RESULT-003, DEVICE-001, SEC-RELEASE-001 |
| R27 | RESULT-003, DEVICE-001, SEC-RELEASE-001 |
| R28 | ASSESS-INSTITUTION-003, ASSESS-PROCTOR-003, SEC-OPS-001, OPS-STAGING-001, PERF-001, OPS-001, LEGAL-001, SEC-RELEASE-001 |
| R29 | SEC-OPS-001, OPS-STAGING-001, OPS-001, LEGAL-001, SEC-RELEASE-001 |
| R30 | ASSESS-QUESTION-002, ASSESS-QUESTION-003, ASSESS-QUESTION-004, ASSESS-QUESTION-005, ASSESS-QUESTION-006, ASSESS-QUESTION-007, ASSESS-QUESTION-008, ASSESS-MEDIA-001, ASSESS-PROCTOR-003, DEVICE-001 |
| R31 | OPS-STAGING-001, PERF-001, VERIFY-INTEGRITY-001 |

## 7. Complete G1–G10 release mapping

All gates remain **NOT PASS / REQUIRED EVIDENCE PENDING OR BLOCKED**. [P10 §5](CBT_RELEASE_UAT_ROLLBACK_PLAN.md) remains the accepted planning disposition reference; only actual future controlled evidence/approvals can change release status.

| Gate | Candidate owners / Tasks | Required completion boundary |
|---|---|---|
| G1 | All 33 candidate Tasks; final Owner counter/evidence evaluation | Approved P11, then every included Task DONE with evidence; final G1 is evaluated after RELEASE-001 DONE, never a self-dependency. |
| G2 | RELEASE-001, SEC-RELEASE-001, all feature Tasks | Full regression and zero known P0/P1 release/auth/tenant/data-loss/duplicate-account defect; no fake or unimplemented critical control. |
| G3 | VERIFY-INTEGRITY-001, ASSESS-STUDENT-001, ASSESS-ROOM-001, PERF-001 | P8 §6 complete stored-answer oracle across every required scenario/type, including restart/storm/room transfer; O04 unresolved case cannot be omitted. |
| G4 | PERF-001, OPS-STAGING-001 | Approved O07 L01–L10/B01–B10 and actual production-equivalent target; approximately 1,000 concurrent Students, all measurements/invariants pass. |
| G5 | DEVICE-001 | PB06 physical matrix reviewed; actual Android/iPhone/tablets/desktop, honest platform limits and minimum accessibility. |
| G6 | SEC-001, SEC-OPS-001, SEC-RELEASE-001, all new route Tasks, OPS-001 | Approved P5 fully enforced/negative-tested, deployed headers/edge/private metrics and actual PB12 readiness. |
| G7 | LEGAL-001 | PB01/PB02/PB03/PB10 qualified artifacts and required controlled closure before any real student data. |
| G8 | OPS-001, SEC-OPS-001, OPS-STAGING-001 | Actual school TLS, live alerts, automated encrypted off-host backup, production-infrastructure restore and audited interventions; PB11/PB12 proof. |
| G9 | RELEASE-001, DEVICE-001, OPS-001 | P10 RR01–RR08/UA01–UA08, known compatible recovery target, staging/migration/rollback rehearsal and explicit DB/cost declarations. |
| G10 | RELEASE-001, OPS-001, OPS-STAGING-001; COST external gate | Actual cost delta and explicit approval for any new recurring dependency; UNKNOWN is not NO. |

**No circular release Task:** PERF-001 implements/uses the P8 answer oracle during load without requiring the final VERIFY-INTEGRITY-001 report DONE. OPS-001 uses the P9/P8 restore oracle without depending on that final report. VERIFY-INTEGRITY-001 consumes their evidence. RELEASE-001 consumes completed evidence and hands over the dossier; the Owner evaluates G1 after all baseline Tasks (including RELEASE-001) are DONE. Final go/no-go/deployment is separate, not a self-prerequisite or an implicitly authorized Task.

## 8. External decisions, blockers and exact unblock ownership

The shared policy definitions remain [P2 §8 O01–O09](CBT_DOMAIN_RULES_SPECIFICATION.md). This table distinguishes **READY input prerequisites** from **DONE/release evidence outcomes** for every external lifecycle gate; it is not a new policy register and closes nothing. Policy/design approval, qualified authority/availability, access and safe artifact handling may be entry prerequisites. A Task’s own test report, review PASS, approved artifact, signoff or controlled closure is generated during that Task and cannot be required before that same Task becomes READY. Upstream completed evidence remains an input only where the unchanged internal dependencies or an applicable external input require it. Outcomes apply to the responsible Task or release gate named in the row, not automatically as entry conditions for every consumer. All unresolved decisions and applicable blockers remain **OPEN**; no current prerequisite or outcome is newly declared satisfied. Approval of this candidate, later Task authorization and policy approval remain distinct.

| Gate | Required input | Responsible authority | Consumers / scope | READY prerequisite (input) | DONE / release evidence (outcome) |
|---|---|---|---|---|---|
| O01 | Final ID format/generation and official-identity uniqueness keys | Owner + identity/security reviewer | AUTH-001 / ADMIN-001 / AUTH-002 | Approved exact policy and reviewed A03 design; no ambiguous Person merge. | Implement and verify that approved contract in the responsible identity Tasks; their resulting uniqueness/concurrency evidence is not an entry prerequisite. |
| O02 | Type limits/cardinality/credit, text/numeric rules, grading/revision/import/clear semantics | Owner + subject/security reviewers | ASSESS-QUESTION-001–010 / RESULT-004 | Approved type rules, limits, expected vectors and A01 design. Expected test outcomes are defined; tests need not already have passed. | Responsible Tasks produce actual validation/recovery/scoring/grading evidence against those vectors; no unapproved rule or policy reapproval is inferred. |
| O03 | Claim/reset expiry/proof minimization, enumeration-safe responses, notification/revocation | Owner + security/legal where applicable | Identity Tasks / SEC-OPS-001 | Approved lifecycle/proof/session rules and persistence/transaction design. | Responsible Tasks implement and test those rules; their own reset/revocation/audit evidence is produced during execution. |
| O04 | Deferred post-expiry late-delivery exception / required integrity outcome | Owner under D04.5-48 boundary | ASSESS-STUDENT-001 / VERIFY-INTEGRITY-001 | Explicit approved disposition and complete expected G3 outcomes; current refusal retained until changed. No waiver by silence. | Actual late-delivery/server-truth evidence and independent PB07 review remain required; no policy-blocked case omitted. |
| O05 | Institution composition/finalization, transfer/session and unresolved publication correction | Owner + assessment/security reviewer | Institution / transfer / results / A01/A04 | Approved composition, authority and serialized-transition design; OD-07/07b/09 authority unchanged. | Responsible Tasks produce implementation/concurrency/result evidence; their own completed verification is not required before they start. |
| O06 | Media storage/rendition/limits/accessibility/broken-item recovery/retention | Owner + architecture/security/subject reviewer | ASSESS-MEDIA-001 / bank/import / OPS-001 | Approved A02 design, exact media policy and authorized cost/backup constraints; no provider selected here. | Media and operations Tasks produce actual access/rendition/recovery/backup consistency evidence. |
| O07 | Numeric P6 workload/budgets, soak/recovery duration and school VPS/NAT/device facts | Owner + school + performance reviewer | Final P11 approval; staging/load/devices/operations | Explicit numeric workload/budget approval under P1 §8 before final P11 approval, plus Task-applicable school input facts. No prior capacity PASS required. | Actual measurements, configured-environment facts and load/device/recovery evidence are produced by responsible Tasks; G4 still needs measured PASS. |
| O08 | Signal/incident retention/access/dedupe/rate limits/revision/reopen | Owner + security/privacy reviewer | ASSESS-PROCTOR-003 / PERF-001 | Approved minimized evidence, overload and incident contract A05; no automated sanction. | Responsible Tasks produce actual ingestion/isolation/privacy/incident evidence; their own report review is a completion gate. |
| O09 | Detailed P5 acceptance and sensitive-field visibility | Owner + independent security reviewer | Final P11 approval; SEC-001 and every affected new route | Explicit detailed matrix approval under P1 §8. This is policy approval, not completed enforcement testing or PB05 closure. | Implementation, complete negatives, independent security review and authorized PB05 closure remain required for the responsible Tasks/G6; PB05 stays OPEN until valid closure. |
| A01 | Versioned question/answer/grading compatibility design | Owner-authorized architecture/assessment reviewer | Question/results foundation | Accepted version/migration/old-client technical contract after O02/O05/P5 inputs; ADR only if materially needed. Approval concerns design, not already implemented tests. | Foundation/type/result Tasks produce actual compatibility/migration/old-client evidence without reinterpreting v1 history. |
| A02 | Media storage/delivery architecture decision | Owner + architecture/security reviewer | Media/backup | Approved justified storage/access/retention/version/restore design and exact decision scope; no new ADR approved now. | Responsible media/backup Tasks produce actual safe-delivery and restore evidence. |
| A03 | Identity/roster ownership and transactional uniqueness design | Owner + identity/domain/security reviewers | Identity | Approved owning-domain API/key/constraint/lock/rollback/replay design after O01/O03. | Identity Tasks produce actual DB-enforced uniqueness, race/retry and rollback evidence; implemented constraints are not a prerequisite to implementing them. |
| A04 | Institution composition and transfer consistency/session design | Owner + assessment/security reviewer | Institution/transfer | Approved lock-order/assignment-revision/session-transition contract and defined concurrency cases. | Institution/transfer Tasks produce actual concurrent-writer/authorization/answer-time preservation evidence. |
| A05 | Bounded signal evidence ingestion/storage/isolation design | Owner + security/architecture reviewer | Risk feed | Approved retention/dedupe/ingest/overload/cost design after O08/O09. | Risk/performance Tasks produce actual isolation, retention and overload evidence. |
| S01-S16 | Actual school domain/VPS/DB/resources/access/staging/TLS/keys/backup/retention/telemetry/contacts/devices/UAT/cost facts | School infrastructure operator + Owner, named signatories | OPS-STAGING-001 / OPS-001 / PERF-001 / DEVICE-001 / RELEASE-001 | Task-applicable school-supplied target/resource/access facts, approved objectives and safe operating scope known before execution. Do not require the configured-state manifest, measured parity, alert/restore/UAT evidence that the same Task will produce. | Responsible Tasks verify and record actual configured facts, manifests, measurements and outcomes during execution. All applicable release facts must be established before release; UNKNOWN is never treated as PASS. |
| ACCESS | Named isolated target/access/operator/time/resource authorization | Owner + school infrastructure operator | Staging/operations | Exact isolated target, access, operator/time/safety limits and permitted operations approved; never shared workstation or other project resources. | Record actual authorized operations/outcomes during execution; access authorization alone is not operating evidence. |
| COST | Approved resource/recurring-cost scope and final actual declaration | Owner + school procurement/operator | Staging/ops/load/release | Known applicable resource/cost terms and explicit approval before incurring any new recurring dependency; no unapproved purchase or blank-as-NO assumption. | Responsible Tasks record actual usage/cost delta and final signed release declaration. The declaration produced by RELEASE-001 is not required before RELEASE-001 starts; G10 remains mandatory. |
| LOAD-TOOL | Open-source load tool/version and generator scope | Owner + performance reviewer | PERF-001 | Approved tool/version, workload/configuration requirements, safely installable capability and isolated generator/target authorization. No prior execution of the new harness required. | PERF-001 records actual tool/config/seed/generator manifests and measured evidence; no tool installed or selected here. |
| DEVICE-ACCESS | Qualified physical device inventory and tester access | Owner + school/device reviewers | DEVICE-001 | Approved PB06 protocol/acceptance criteria and nominated testers with actual device access; completed device test results not required before testing. | DEVICE-001 produces the reviewed physical capability/device evidence and truthful limitations; CI WebKit is not iPhone proof. |
| LEGAL-SIGNATORIES | Qualified legal/privacy authority, access and artifact handling | Owner + qualified legal/privacy authority | LEGAL-001 | Qualified responsible authority identified and available; access to necessary source material and approved confidentiality/disclosure/redaction/storage procedure. No already-approved final legal artifact or blocker closure required to start. | LEGAL-001 obtains qualified artifact approvals/signatures and records controlled PB01/PB02/PB03/PB10 closure as DONE evidence. No credentials/private student/confidential legal material published by default. |
| PB01 | Controller/Processor legal allocation OPEN | Owner/legal | LEGAL-001 / G7 | For LEGAL-001, authority/access/handling under LEGAL-SIGNATORIES; completed allocation artifact/closure is not its READY prerequisite. | LEGAL-001 must obtain the authoritative approved allocation artifact and controlled closure before DONE; G7 prohibits real student data until satisfied. |
| PB02 | Retention matrix OPEN | Owner/legal/ops | LEGAL-001 / signals/media/backup | LEGAL-001 requires qualified authority/access/handling, not a completed retention artifact. Downstream retention-dependent execution requires an approved applicable retention policy as input; this does not require LEGAL-001 to have produced all its other artifacts. | LEGAL-001 produces approved retention artifact/controlled PB02 closure before DONE. Downstream Tasks implement/test that policy. G7 and applicable retention/release requirements remain mandatory. |
| PB03 | DPIA OPEN | Owner/qualified privacy authority | LEGAL-001 / G7 | For LEGAL-001, qualified privacy authority/access/handling; completed DPIA or determination is not its READY prerequisite. | LEGAL-001 obtains completed approved DPIA or authoritative documented not-required determination and controlled closure before DONE/G7. |
| PB05 | Permission matrix OPEN | Owner/security reviewer | SEC-RELEASE-001 / G6 | Approved O09/P5 policy and completed required implementation predecessors; final negatives, completed independent security review and PB05 closure are not prerequisites to running SEC-RELEASE-001. | SEC-RELEASE-001 produces full enforcement/negative evidence, obtains independent HIGH-risk review PASS and authorized controlled closure before DONE/G6. P5 draft acceptance never closes PB05. |
| PB06 | Physical capability verification OPEN | School/device testers + qualified reviewer | DEVICE-001 / G5 | Approved protocol/criteria, qualified reviewer availability and actual device/tester access under DEVICE-ACCESS; no already-completed capability report. | DEVICE-001 produces complete actual capability evidence, obtains required review PASS and authorized controlled closure before DONE/G5. |
| PB07 | Zero-Lost-Answer artifact OPEN | Assessment executor + independent integrity reviewer | VERIFY-INTEGRITY-001 / G3 | Approved scenario/oracle/safety requirements and reviewer assignment/availability under PB07-REVIEW; no already-completed PB07 report/review/closure. | VERIFY-INTEGRITY-001 produces complete server-state report, obtains independent report review PASS and authorized controlled closure before DONE/G3. Keep PB07 OPEN until valid closure evidence exists. |
| PB10 | Data classification/consent OPEN | Owner/legal | LEGAL-001 / G7 | For LEGAL-001, qualified authority/access/handling; final approved classification/consent artifact and closure are not READY prerequisites. | LEGAL-001 obtains the approved artifact and controlled closure before DONE. G7 still prohibits real student data until applicable legal requirements are satisfied. |
| PB11 | Production-infrastructure backup/restore evidence OPEN | School infrastructure operator + operations/independent reviewer | OPS-001 / G8 | Approved recovery objectives/retention, authorized isolated target/key access/safe drill protocol and qualified reviewer availability. No already-passed restore drill/closure required before executing OPS-001. | OPS-001 produces actual isolated production-infrastructure restore evidence, obtains required review/approval and authorized controlled closure before DONE/G8. |
| PB12 | Incident lead/duties/contacts and tested readiness OPEN | Owner/security/legal + named incident lead | SEC-OPS-001 / OPS-001 / SEC-RELEASE-001 | Approved named lead/duties/contacts, escalation/notification rules and safe intervention authority/access. Evidence from completed internal predecessors may be required downstream; do not require a Task's own tested delivery/intervention outcome before it starts. | SEC-OPS-001/OPS-001 produce intervention/delivery evidence; SEC-RELEASE-001 verifies completed readiness and required authorized closure before DONE/G6/G8. Names alone do not close PB12. |
| PB07-REVIEW | Independent PB07 reviewer assignment and report review | Independent integrity reviewer + applicable closure authority | VERIFY-INTEGRITY-001 | Appropriate independent reviewer identified, available and authorized with agreed report/scenario/access scope before verification when needed; no completed report review PASS required before execution. | After the report is produced, independent exact-candidate/server-journal/scenario review PASS and authorized PB07 closure are mandatory completion evidence; no self-approval. |
| SECURITY-REVIEW | Independent security reviewer assignment and completed review | Independent HIGH-risk security reviewer + applicable closure authority | SEC-RELEASE-001 | Qualified independent reviewer assigned/available/authorized, scope and secure evidence access agreed. Completed security review PASS is not required before running the final verification. | After execution, independent HIGH-risk exact-candidate full-action/denial/deployed-edge review PASS and required authorized closure are mandatory before DONE/G6. |
| UAT-SIGNATORIES | School UAT participant/signatory nomination and resulting signoffs | School + Owner/release lead | RELEASE-001 | UA01–UA08 participants and signatories nominated, authority/availability/roles/access agreed and protocol/criteria known before execution; no already-completed UAT signoff. | RELEASE-001 executes UAT and obtains actual UA01–UA08 signoffs with candidate/device/date/observed outcome/evidence before DONE/G9; planning acceptance is not UAT approval. |
| RELEASE-AUTHORITY | Release/recovery authority, rehearsal inputs and final declarations | Owner + school/release operator | RELEASE-001 | Named authorized approver/operator, permitted rehearsal scope, upstream recovery target/image/schema/media facts and known proposed DB/cost change inputs. Do not require this Task's completed rehearsal or final declarations before it starts. | RELEASE-001 produces reviewed rehearsal/recovery evidence and approved final DB/cost declarations before DONE/G9/G10. Final go/no-go/deployment remains separately authorized. |

**Earliest implementation sequence:** bounded P5/O09 and numeric P6/O07 approvals are recorded in §1. SEC-001 still needs its exact role/reason/audit/schema/route/negative-test/file contract and full READY gate, then separate Owner execution authorization. O01/O03/A03 unlock identity; O02/A01 unlock all-type work; O05/A04 institution/transfer/results; O06/A02 media; O08/A05 signals; O04 must provide the required late-delivery integrity disposition before full G3. This is priority guidance, not authorization to decide or execute any of them.

**P11 approval assessment — current:** the Owner accepted P1–P10 planning sufficiency and explicitly approved Gate B on 2026-10-31, subject to controlled tracker publication/merge (§11). P5/P6 approval is limited to the exact reviewed scopes in §1; accepted planning does not make unresolved P2/P4 technical contracts implementation-ready or approve conditional policies. Every external definition above retains its entry/completion distinction and dependent Task blocker. The earlier unapproved assessment is historical in the original candidate blob; no blanket O01–O09 exemption, scope reduction or new supersession is introduced.

**PB disposition:** [authoritative backlog](../state/PRODUCTION_BLOCKERS_BACKLOG.md) retains 12 total, PB04 CLOSED, 11 OPEN including PB08/PB09 conditional/inactive for CBT-R1. PB05 approval alone does not close PB05. PB01/02/03/10 bar real student data. PB06/07/11/12 need actual reviewed device/integrity/production-restore/incident evidence. This Task changes none of their statuses. OPEN-05 participant removal and OD-10 repository visibility remain OPEN outside this implementation scope; no removal feature or visibility change is inferred.

## 9. ID reconciliation and reused completed history

Existing carried IDs are retained, not renumbered or marked DONE: SEC-001, AUTH-001, ADMIN-001, RESULT-003, ASSESS-STUDENT-001, ASSESS-PROCTOR-003 and OPS-001. OD-08/09 settled high-level policies remove older questions but do not satisfy detailed Oxx/P5/READY gates. New IDs in §3 are candidate proposals checked against existing records and canonical history. The preparation guard found historical capability IDs SEC-002/SEC-003 already occupied; the new operational-intervention/security-release proposals use SEC-OPS-001/SEC-RELEASE-001 instead. Historical capability IDs/content remain unchanged; no registered ID is repurposed or split. No SUPERSEDED row is invented.

UI-SYSTEM-004 Parts 1/2/3 remain completed history, not a new baseline Task or whole-parent completion claim. New-screen minimum UX/a11y is included in feature cards and DEVICE-001. Unfinished cosmetic polish/redesign/sticky-header concerns stay deferred under Owner 2026-10-27; material functional/accessibility defects are not waived and require a separately authorized correction if discovered. UI-SYSTEM-005 remains BLOCKED on approved DesainPakeAI project access and deferred cosmetic priority; it is not silently DONE, superseded, or included as a release-polish Task.

All implementation anchors below are present at main `77756e38ff4e289e7b6ebcda63d753749854756d`, [CI #89](https://github.com/yusufarst/elligble/actions/runs/41028807175), push attempt 1, eight SUCCESS on ubuntu-24.04, reverified 2026-10-30. That regression validates existing scope, not new features/load/devices/UAT/restore.

| Reused capability / evidence group | Actual source / existing test anchors | Remaining evidence or extension |
|---|---|---|
| E1 identity/session/tenant/own Attempt | `runtime/identity-access/src/index.ts`, `runtime/tenant-access/src/index.ts`, `runtime/secure-assessment/src/http/authenticated-context.ts`, `http/attempt-authorization.ts`; pilot/security E2E | Claim/roster/recovery/official attributes missing; do not duplicate existing login/cards |
| E2 Student local-first/timer/recovery/flags/submit | `frontend/web/src/exam/answer-sync-engine.ts`, `runtime/secure-assessment/src/timer.ts`, `submission.ts`; `e2e/tests/2-resilience.spec.ts`, `5-lifecycle.spec.ts` | Full PB07, new types and running transfer; pending never means acknowledged |
| E3 teacher-managed single-choice content/lifecycle | `question-snapshot-baseline-frozen-content-contract.ts`, `teacher-exam-import.ts`, `teacher-exam-preview.ts`, schedule/cancel/participants modules; teacher E2E | Only v1 MULTIPLE_CHOICE_SINGLE/A–E exists; author/bank/media/other types/institution missing |
| E4 deterministic v1 results | `runtime/secure-assessment/src/scoring.ts`, `teacher-results.ts`, finalization integration; results E2E | Manual/full-type/institution/publication missing; frozen historical truth retained |
| E5 supervision/rooms | Existing supervision-scope/room/proctor building blocks, monitoring/lock/broadcast/Teacher-time modules and E2E | Operable school management, running transfer, full matrix/reasons/feed/incidents |
| E6 operations foundation | `Dockerfile`, `deploy/`, migrations/preflight/provisioning/logs/metrics, [runbook](OPERATIONS_RUNBOOK.md), current CI | Local procedure/smoke is not actual VPS/load/automated off-host/restore/alerts evidence |
| E7 approved shared UI/Student/Teacher slices | [UI-SYSTEM-002 record](tasks/UI-SYSTEM-002.md), [UI-SYSTEM-004 record](tasks/UI-SYSTEM-004.md), locked design system | Minimum functional UX for new screens/devices; no completed visual work reopened |

PRE-P11 history, **not counted in §2**: GOV-REALIGN-001/002 (P0/execution context); GOV-REALIGN-003 P1 approved content `6c9d311`, CI #81, PR #10/main `2c6a486`, CI #83; GOV-REALIGN-004 P2–P6 accepted content `9cf099a`, CI #84, PR #11/main `a16cbf5`, CI #86; GOV-REALIGN-005 P7–P10 accepted content `c5866da`, CI #87, final evidence `c3caa1e`, PR #12/main `77756e38ff4e289e7b6ebcda63d753749854756d`, CI #89. UI-SYSTEM-002 Part 2 PR #7/main CI #67 and UI-SYSTEM-004 Part 2 PR #8/main CI #74, Part 3 PR #9/main CI #79 stay DONE in their bounded records. GOV-REALIGN-006 is preparation only and will never add baseline DONE.

Subsequent completed history remains excluded: GOV-REALIGN-006 Gate-A-only DONE, PR #13/main 9b11ec5/CI #94; GOV-DESIGN-001 accepted intent, PR #14/main 6c01358/CI #98; GOV-DESIGN-002 limited DEC-047 documentation, PR #15/main fffab09/CI #101; GOV-POLICY-001 bounded P5 approval, PR #16/main 067713a/CI #104; GOV-PERF-001 bounded numeric approval, reviewed 94fb79f/CI #105, evidence cf1036f7766eb4851da95b85dc82dbd03da2143d, PR #17/main 885a91d845059b00900daf85d719604826be8dd3/[CI #107](https://github.com/yusufarst/elligble/actions/runs/41162038798), attempt 1 eight SUCCESS on ubuntu-24.04 reverified 2026-10-31. Earlier approval exclusions remain historical authority boundaries; this transition changes no completed record. Application/runtime/E2E/workflow sources are unchanged from the §9 implementation anchor.

## 10. Proposed first implementation Task

**SEC-001 remains BLOCKED and NOT AUTHORIZED**, as does every other implementation Task. Bounded P5/P6 and final P11 Owner approvals are now recorded; shortest safe opening after controlled tracker landing: freeze SEC-001's exact role/reason/audit/schema/route/negative-test/file contract → satisfy all its READY inputs → obtain separate Owner authorization of that one READY Task. Do not grant all-school access from current broader defaults or from a Teacher role. AUTH-001/identity follows only after its own gates; question foundation follows approved A01/O02/O05. Current recommendation is **BLOCKED**, not a request to start coding.

## 11. Change control and approval history

### Historical candidate and Gate-A/Gate-B contract checkpoint

The following initial change block and closure-amendment statements are preserved historical checkpoints from GOV-REALIGN-006, not current Task status or approval metadata. Current Gate B disposition and controlled activation are recorded in §11.1 below. The gate requirements remain binding.

This is the initial proposed set; no prior approved P11 Baseline Total exists. Mechanical counts derive from §3, duplicate IDs/references/cycles/checklist/cards/coverage are checked before publication. No fabricated Task count or percentage comes from a chat estimate.

```text
TASK PLAN CHANGE
Reason: Initial Owner-authorized finite P11 candidate; no approved baseline activated.
Affected Task(s): Proposed rows in §3; existing carried IDs preserved.
New Task(s): Only new candidate IDs in §3; no future Task records or execution.
Baseline Total: 33 (CANDIDATE ONLY)
Previous Current Total: N/A (no approved P11 baseline)
New Current Total: 33 (CANDIDATE ONLY)
Dependencies Updated: YES, explicit candidate graph/external gates
Scope Change: NO, complete DEC-044 R01–R31/G1–G10 retained
Owner Approval Required: YES, final P11 approval NOT GRANTED
```

**Owner-approved Task-local closure amendment — 2026-10-31:** the following replaces the former combined “Required exit” paragraph only. It separates completion of GOV-REALIGN-006's PRE-P11 candidate-preparation outcome from final P11 approval. DEC-044, DEC-045, P1 §8 and every other LOCKED/FROZEN decision remain unchanged.

### GATE A: PRE-P11 CANDIDATE TASK CLOSURE

GOV-REALIGN-006 may become DONE strictly for candidate preparation and acceptance when all of these are satisfied:

- One complete finite P11 candidate, with its required scope, traceability and deterministic verification.
- Required automatic exact-content CI PASS, attempt 1, all eight jobs SUCCESS on the latest corrective content SHA.
- Independent HIGH-risk Review PASS for that content, including targeted review of this closure-contract amendment.
- Explicit Owner candidate acceptance applicable to the candidate content.
- Candidate-preparation evidence recorded and required Task closure/evidence-commit requirements satisfied under DEC-045 and explicit Owner authority.

Final P11 baseline approval, including P5/O09 and P6/O07 final-approval prerequisites, is **NOT a prerequisite for this PRE-P11 Task's candidate-only DONE**. GOV-REALIGN-006 remains excluded from baseline DONE/counters. This corrective content commit keeps GOV-REALIGN-006 **VERIFYING / NOT DONE**; after its CI, STOP for targeted Independent HIGH-risk Review. No evidence commit or DONE is authorized at this checkpoint.

### GATE B: FINAL P11 BASELINE APPROVAL

Final P11 approval and tracker activation remain blocked until all of these are satisfied:

- P1 §8 applicable prerequisites are satisfied.
- Detailed P5/O09 is explicitly approved.
- Numeric P6 workload/budgets O07 are explicitly approved.
- Other applicable P1–P10 planning sufficiency is reviewed.
- The Owner gives **separate, explicit final P11 baseline approval**.

Only after Gate B may TASK_PLAN.md become the active execution tracker under DEC-045. **GATE A does not imply GATE B.** Candidate acceptance or Task closure does not approve O01–O09, close PB05/other blockers, authorize implementation/deployment or make production ready. This document remains **CANDIDATE / NOT APPROVED / NOT ACTIVE**; implementation still requires separate Owner authorization of a bounded READY Task.

### 11.1 Current Gate B Owner decision and controlled activation — 2026-10-31

```text
TASK PLAN CHANGE
Reason: Record explicit Owner FINAL P11 Gate B approval and prepare controlled tracker activation.
Affected Task(s): Approval/activation metadata only; all 33 implementation rows unchanged.
New Task(s): NONE in baseline; GOV-P11-001 is governance transition only, excluded.
Baseline Total: 33
Previous Current Total: 33
New Current Total: 33
Dependencies Updated: NO; same 78 internal edges and external gate definitions.
Scope Change: NO; full DEC-044 R01–R31/G1–G10 and every Task scope retained.
Owner Approval Required: Gate B GRANTED 2026-10-31; exact-content acceptance and controlled merge PENDING.
```

The Owner explicitly approves FINAL P11 Gate B and P1–P10 planning sufficiency **for finite baseline approval only**, for main `885a91d845059b00900daf85d719604826be8dd3` and original candidate Git blob `e940f7b3293e5ace699aad0c2d590170506023c7`. Bounded P5/O09 and P6/O07 approvals remain exactly as §1. The 33 IDs/cards/checklist/statuses/priorities/scopes, 78 internal dependency edges/acyclic DAG, all R01–R31/G1–G10 mappings and §2 counters are unchanged. GOV-P11-001 is excluded from these 33 implementation Tasks.

**Owner-approved baseline is distinct from active tracker:** this document becomes the official execution tracker only after controlled Owner merge of GOV-P11-001. Stage-1 publication remains VERIFYING / NOT DONE pending exact-content automatic attempt-1 eight-job CI, Independent HIGH-risk Review and Owner exact-content acceptance. No evidence commit or merge is authorized in Stage-1. Subsequent implementation requires a separately authorized bounded READY Task; SEC-001 remains BLOCKED.

O01–O08 and residual O07, excluded O09/C contracts, outstanding A01–A05, B09/conditional B10 inputs, all applicable PBs, S01–S16 facts, ACCESS/COST/LOAD-TOOL/DEVICE-ACCESS and release G1–G10 retain their existing unresolved states and authority. No policy, technical architecture, school fact, blocker closure, capacity/device/restore/UAT PASS or release authority is inferred. Production remains NOT READY; DEC-039/043/effective limited DEC-047 and all other compatible LOCKED/FROZEN decisions are preserved.
