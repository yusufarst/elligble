# BU-064: Secure Assessment Exam Instance Duration-Window Policy Compatibility Readiness Preflight Runtime Bootstrap

## TITLE
Secure Assessment Exam Instance Duration-Window Policy Compatibility Readiness Preflight Runtime Bootstrap

## PURPOSE
Implement the smallest READ-ONLY runtime primitive that evaluates ONLY static compatibility between:
- Exam Window;
- configured Attempt Duration;
- latest-start policy;

for one same-tenant SCHEDULED Secure Assessment Exam Instance.

This is a DURATION-WINDOW-POLICY COMPATIBILITY PREFLIGHT only. It MUST NOT claim full timing readiness or overall READY.

## CANONICAL BASIS
- docs/00-governance/00.02_DECISION_HIERARCHY.md
- docs/00-governance/00.03_CANONICAL_TERMINOLOGY.md
- docs/00-governance/00.04_AGENT_CONTEXT_RULES.md
- docs/00-governance/00.05_BUILD_EXECUTION_RULES.md
- docs/00-governance/00.07_DOMAIN_OWNERSHIP_AND_CONTRACTS.md
- docs/00-governance/00.08_BUILD_UNIT_FAST_TRACK_CONTROL.md
- docs/01-discovery/04.01_SECURE_ASSESSMENT.md (D04.2-13, D04.2-14, D04.2-15, D04.2-19, D04.2-31, D04.2-32, D04.2-33, D04.2-34)
- docs/02-master-blueprint/02.09_DELIVERY_SEQUENCE_AND_DEPENDENCIES.md
- docs/architecture/SECURE_ASSESSMENT_CRITICAL_ARCHITECTURE.md

## PREDECESSORS
- BU-002 — Secure Assessment Core State Persistence
- BU-053 — Exam Instance Lifecycle State Persistence
- BU-054 — Exam Instance Operational Window Persistence
- BU-055 — DRAFT-to-SCHEDULED Lifecycle Transition Runtime
- BU-056 — Attempt Duration Configuration Persistence
- BU-057 — Latest-Start Policy Persistence
- BU-063 — Timing Configuration Presence Readiness Preflight Runtime

## EXACT IN-SCOPE CONTRACT
- Bounded read-only preflight runtime to evaluate static duration-window-policy compatibility for a specific same-tenant SCHEDULED Exam Instance.
- Export `checkExamInstanceDurationWindowPolicyCompatibilityReadiness(client, tenantId, examInstanceId, evaluateCapability)`.
- Pre-validate UUIDs for `tenantId` and `examInstanceId` before evaluator or database query.
- Invoke capability evaluator with exact context: `{ tenantId, examInstanceId }`.
- Evaluate static policy compatibility:
  - `FULL_DURATION_BEYOND_WINDOW`: duration may be `<, =, >` window duration -> `duration_window_compatibility_ready`.
  - `REMAINING_WINDOW_ONLY`: duration may be `<, =, >` window duration -> `duration_window_compatibility_ready`.
  - `LATE_START_BLOCKED`: duration `<= windowDurationSeconds` -> `duration_window_compatibility_ready`; duration `> windowDurationSeconds` -> `not_ready` with blocker `attempt_duration_exceeds_window`.
- Deterministic presence blockers: `attempt_duration_missing`, `latest_start_policy_missing` (deterministic first blocker: `attempt_duration_missing` if both missing).
- Fail-closed corrupt invariant handling: missing or invalid window (`starts_at >= ends_at` or null timestamps) or non-canonical policy -> `unavailable`.
- Lifecycle gate: SCHEDULED only; other states return `invalid_state`.
- Inaccessible/wrong-tenant: returns `denied` without disclosing existence.
- Fail-closed database failure handling returning `unavailable` with zero raw error leak.
- Read-only SELECT behavior with zero mutation.

## EXACT OUT-OF-SCOPE
- overall READY evaluator
- readiness aggregation
- SCHEDULED -> READY transition
- READY -> ACTIVE transition
- any lifecycle mutation
- platform/school duration maximum policy
- platform/school duration minimum policy
- policy configuration persistence
- current time eligibility
- server-clock decision
- actual latest-start timestamp computation
- latest-start enforcement
- effective Attempt Duration computation
- timer start/change
- timer remaining-time change
- rescheduling
- timezone configuration/display
- schedule conflict detection
- participant conflict detection
- Rombel conflict detection
- proctor conflict detection
- Exam Room conflict detection
- Assessment Type readiness aggregation
- Question Snapshot readiness aggregation
- Participant readiness aggregation
- question semantic validity
- participant eligibility
- scoring configuration/readiness
- answer-key validation
- anti-cheating configuration/readiness
- technical/device compatibility readiness
- readiness warnings aggregation
- Exam Room persistence/readiness
- Proctor persistence/readiness
- Secure Assessment Entry
- Attempt creation
- Session creation
- API / route / controller
- frontend / UI
- migration / schema mutation
- package.json change
- package-lock change
- tsconfig change
- Academic Core mutation
- final RBAC / ABAC / Permission Matrix
- PB05 closure
- any Production Blocker closure
- BU-065 selection / successor selection

## FOCUSED TEST REQUIREMENTS
- Node:test and Node:assert.
- ESM imports.
- Prove exact behavioral conditions:
  1. FULL_DURATION_BEYOND_WINDOW + duration shorter than window => duration_window_compatibility_ready
  2. FULL_DURATION_BEYOND_WINDOW + duration greater than window => duration_window_compatibility_ready
  3. REMAINING_WINDOW_ONLY + duration shorter than window => duration_window_compatibility_ready
  4. REMAINING_WINDOW_ONLY + duration greater than window => duration_window_compatibility_ready
  5. LATE_START_BLOCKED + duration shorter than window => duration_window_compatibility_ready
  6. LATE_START_BLOCKED + duration equal to window => duration_window_compatibility_ready
  7. LATE_START_BLOCKED + duration greater than window => not_ready / attempt_duration_exceeds_window
  8. duration NULL => not_ready / attempt_duration_missing
  9. latest_start_policy NULL => not_ready / latest_start_policy_missing
  10. both duration and policy NULL => deterministic first blocker: attempt_duration_missing
  11. non-SCHEDULED states => invalid_state
  12. denied evaluator => denied and zero DB query
  13. unavailable evaluator => unavailable and zero DB query
  14. throwing/rejecting evaluator => unavailable and zero DB query
  15. invalid UUID => denied, zero evaluator call, zero DB query
  16. wrong tenant / inaccessible Exam Instance => denied without cross-tenant disclosure
  17. DB query failure => unavailable with no raw error leak
  18. missing/invalid SCHEDULED window invariant => unavailable
  19. runtime performs SELECT-only behavior and no INSERT/UPDATE/DELETE

## REAL POSTGRESQL VERIFIER REQUIREMENTS
- ESM-safe verifier script using `fileURLToPath(import.meta.url)`.
- Disposable database prefix: `elligble_bu064_`.
- Apply migrations 0001..0030 sequentially, verifying history count reaches 30.
- Create canonical tenant, Academic Core, Teaching Assignment, and SCHEDULED Exam Instance fixtures.
- Real DB proofs:
  - A. 2-hour window, 90m duration, FULL_DURATION_BEYOND_WINDOW => ready
  - B. 2-hour window, 3h duration, FULL_DURATION_BEYOND_WINDOW => ready
  - C. 2-hour window, 3h duration, REMAINING_WINDOW_ONLY => ready
  - D. 2-hour window, 90m duration, LATE_START_BLOCKED => ready
  - E. 2-hour window, 2h duration, LATE_START_BLOCKED => ready
  - F. 2-hour window, 3h duration, LATE_START_BLOCKED => not_ready / attempt_duration_exceeds_window
  - G. duration NULL => attempt_duration_missing
  - H. latest_start_policy NULL => latest_start_policy_missing
  - I. non-SCHEDULED => invalid_state
  - J. wrong tenant => denied
- Prove runtime does not mutate Exam Instance.
- Prove runtime creates no Exam Attempt or Exam Session.
- Prove preservation of BU-054 window constraints (`ck_sa_exam_instances_window_pair`, `ck_sa_exam_instances_window_order`).
- Prove preservation of BU-056 constraint `ck_sa_exam_instances_attempt_duration_positive`.
- Prove preservation of BU-057 constraint `ck_sa_exam_instances_latest_start_policy` and all canonical values physically.
- Prove preservation of Academic Core schema and fixture data.
- Prove no migration/schema changes from BU-064.
- Disposable database cleanup on PASS and FAIL with zero leaks.
- Success marker exact: `REAL POSTGRESQL VERIFICATION: PASS`.

## AUTHORIZED PATH SCOPE
1. `runtime/secure-assessment/src/exam-instance-duration-window-policy-compatibility-readiness-preflight.ts`
2. `runtime/secure-assessment/test/exam-instance-duration-window-policy-compatibility-readiness-preflight.test.ts`
3. `runtime/secure-assessment/verification/verify_bu064_exam_instance_duration_window_policy_compatibility_readiness_preflight.ts`
4. `docs/build/units/BU-064_SECURE_ASSESSMENT_EXAM_INSTANCE_DURATION_WINDOW_POLICY_COMPATIBILITY_READINESS_PREFLIGHT_RUNTIME_BOOTSTRAP.md`
5. `docs/build/BUILD_PHASE_INDEX.md`
6. `docs/state/CURRENT_STATE.md`
7. `docs/state/HANDOFF_PACKET.md`

## STOP CONDITIONS
- Repository/control baseline contradicts 96c239981f1024d021835dd01d85a45b43dafdca.
- Entry control versions differ.
- BU-063 is not terminal.
- Any migration/schema change becomes necessary.
- Platform/school duration policy must be invented.
- FULL_DURATION_BEYOND_WINDOW canonical semantics would need contradiction.
- REMAINING_WINDOW_ONLY canonical semantics would need contradiction.
- LATE_START_BLOCKED semantics cannot be implemented without inventing a new policy.
- Current-time/start eligibility must be decided.
- Effective Attempt Duration must be implemented.
- Overall READY must be decided.
- SCHEDULED -> READY mutation becomes necessary.
- Academic Core mutation becomes necessary.
- Final Permission Matrix must be invented.
- PB05 must close.
- Any eighth path must change.
- BU-063 must be reopened.
- BU-065 must be selected.
- Terminal execution becomes necessary.

## STAGE-2 ENGINEERING EVIDENCE
- PACKAGE TYPECHECK: PASS
- FOCUSED TEST: PASS / 19 / 19
- PACKAGE REGRESSION: PASS / 145 / 145
- VERIFIER STRICT TYPECHECK: PASS
- REAL POSTGRESQL VERIFICATION: PASS
- DISPOSABLE DATABASE CLEANUP: PASS
- RUNTIME SHA256: 7FBFBC7DC9E2827CEFDD0B3470FE212CF385B8BA57877E60BF3B5015419A66B6
- FOCUSED TEST SHA256: CDC2B918434F3B3665BF4B87F882BC22934EEC41755C737E44D7D33E1F3B7434
- VERIFIER SHA256: B5D6A01C4E4A5607CB312AFE2E97472A265B4AFDA4F9994E4D73D15E2FC7DDE9
- STAGE-2 ENVIRONMENT / PROCESS TRUTH: ENVIRONMENT / LOCAL POSTGRESQL CREDENTIAL STALENESS — RECOVERED + CONTROLLER VERIFICATION PROCESS DEFECTS — RESOLVED | NO BU-064 ENGINEERING DEFECT ESTABLISHED | SOURCE TRUST PRESERVED | NO LIFECYCLE RESTART

## Execution State
- **BUILD UNIT:** BU-064 — Secure Assessment Exam Instance Duration-Window Policy Compatibility Readiness Preflight Runtime Bootstrap
- **STAGE-1:** PASS / FROZEN
- **STAGE-2 SOURCE IMPLEMENTATION:** EXECUTED / COMPLETE
- **STAGE-2 ENGINEERING VERIFICATION:** PASS
- **PACKAGE TYPECHECK:** PASS
- **FOCUSED TEST:** PASS / 19 / 19
- **PACKAGE REGRESSION:** PASS / 145 / 145
- **VERIFIER STRICT TYPECHECK:** PASS
- **REAL POSTGRESQL VERIFICATION:** PASS
- **DISPOSABLE DATABASE CLEANUP:** PASS
- **STAGE-2 REPOSITORY FINALIZED:** YES
- **STAGE-2 FINALIZATION COMMIT:** cc7ac03ab16533c833167a82f4211015033a2a48
- **STAGE-3 CONTROLLER PHYSICAL AUDIT:** PASS
- **CONTROLLER FINDING:** NO MATERIAL DEFECT ESTABLISHED
- **FAST-TRACK STAGE-4 LIFECYCLE CLOSE:** COMPLETE
- **STAGE-4 REPOSITORY FINALIZED:** YES
- **STAGE-4 LIFECYCLE CLOSE COMMIT:** e5bc05bcd60755af15bfbc27659a942df7ca89ab
- **DONE:** YES
- **FULL BU-064 REPOSITORY FINALIZED:** YES
- **STAGE-5 FINAL PHYSICAL VERIFICATION:** PASS
- **FINAL PHYSICAL VERIFICATION:** PASS
- **NEXT BUILD UNIT SELECTION / SCOPE FREEZE:** AUTHORIZED
- **NEXT BUILD UNIT:** NOT YET REGISTERED
- **SUCCESSOR:** NOT SELECTED / NOT REGISTERED
- **PB05:** OPEN / CARRIED FORWARD
- **OWNER DECISION REQUIRED:** NO
- **TERMINAL STATE-RECORD SYNC:** EXECUTED / AWAITING CONTROLLED REPOSITORY FINALIZATION
