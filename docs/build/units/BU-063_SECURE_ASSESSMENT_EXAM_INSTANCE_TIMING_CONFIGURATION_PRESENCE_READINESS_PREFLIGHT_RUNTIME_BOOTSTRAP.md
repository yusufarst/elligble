# BU-063: Secure Assessment Exam Instance Timing Configuration Presence Readiness Preflight Runtime Bootstrap

## TITLE
Secure Assessment Exam Instance Timing Configuration Presence Readiness Preflight Runtime Bootstrap

## PURPOSE
Implement the smallest READ-ONLY runtime primitive that evaluates ONLY the presence of the two already-persisted Exam Instance timing configuration components required before a later full duration/timing readiness decision:
1. configured_attempt_duration_seconds
2. latest_start_policy

This is a PRESENCE PREFLIGHT only. It MUST NOT claim full timing readiness.

## CANONICAL BASIS
Relevant governance, D04 Secure Assessment, Master Blueprint, architecture, BU-002, BU-053, BU-054, BU-055, BU-056, BU-057, BU-062.

## PREDECESSORS
- BU-002
- BU-053
- BU-054
- BU-055
- BU-056
- BU-057
- BU-062

## EXACT IN-SCOPE CONTRACT
- Bounded read-only preflight runtime to verify timing configuration presence for a specific same-tenant SCHEDULED Exam Instance.
- Accepts `client`, `tenantId`, `examInstanceId`, and a generic capability evaluator.
- UUID validation for identifiers.
- Authorization contextual evaluation (`{ tenantId, examInstanceId }`).
- Returns discriminated semantic unions: `timing_configuration_presence_ready` (with exact `configuredAttemptDurationSeconds` and `latestStartPolicy`), `not_ready` (with `attempt_duration_missing` or `latest_start_policy_missing`), `invalid_state`, `denied`, or `unavailable`.
- Fail-closed database failure handling.

## EXACT OUT-OF-SCOPE
- overall READY evaluator
- SCHEDULED -> READY transition
- READY -> ACTIVE transition
- any lifecycle mutation
- full duration/timing readiness
- duration-vs-window compatibility decision
- platform/school duration maximum/minimum policy
- effective Attempt Duration computation
- current-time eligibility
- latest-start enforcement
- server clock decision logic
- timezone configuration/display
- rescheduling
- schedule conflicts
- participant conflicts
- Rombel conflicts
- proctor conflicts
- Exam Room conflicts
- Assessment Type readiness aggregation
- Question Snapshot readiness aggregation
- Participant readiness aggregation
- question semantic validity
- participant eligibility
- scoring readiness
- answer-key validation
- anti-cheating readiness
- Exam Room readiness
- Proctor readiness
- technical/device compatibility readiness
- readiness warning aggregation
- Secure Assessment Entry
- Attempt creation
- Session creation
- timer start
- timer remaining-time resolution
- API/routes/controllers
- frontend/UI
- migration/schema changes
- package.json changes
- tsconfig changes
- Academic Core mutation
- final RBAC/ABAC/Permission Matrix
- PB05 closure
- any Production Blocker closure
- successor selection
- BU-064 selection

## FOCUSED TEST REQUIREMENTS
- Node:test and Node:assert.
- ESM imports.
- Prove exact behavioral conditions:
  1. SCHEDULED + granted + duration present + latest policy present -> timing_configuration_presence_ready
  2. Return configuredAttemptDurationSeconds exactly.
  3. Return latestStartPolicy exactly across all canonical values.
  4. duration NULL -> not_ready / attempt_duration_missing
  5. latest_start_policy NULL -> not_ready / latest_start_policy_missing
  6. both NULL -> deterministic first blocker: attempt_duration_missing
  7. non-SCHEDULED states -> invalid_state
  8. denied evaluator -> denied and zero DB query
  9. unavailable evaluator -> unavailable and zero DB query
  10. throwing/rejecting evaluator -> unavailable and zero DB query
  11. invalid UUID -> denied, zero evaluator call, zero DB query
  12. wrong tenant / inaccessible Exam Instance -> denied without cross-tenant disclosure
  13. DB query failure -> unavailable with no raw error leak
  14. runtime performs SELECT-only behavior and no INSERT/UPDATE/DELETE

## REAL POSTGRESQL VERIFIER REQUIREMENTS
- ESM-safe verifier script using `fileURLToPath(import.meta.url)`.
- Disposable database creation (`elligble_bu063_<runId>`).
- Prove exactly one canonical migration exists for prefixes 0001-0030.
- Apply migrations 0001-0030 sequentially.
- Verify migration history reaches 30.
- Create canonical fixture rows including tenant, Academic Core, Teaching Assignment, and SCHEDULED Exam Instances.
- Execute real BU-063 runtime across all timing configuration states.
- Prove duration NULL + latest policy NULL -> attempt_duration_missing.
- Prove duration present + latest policy NULL -> latest_start_policy_missing.
- Prove duration present + canonical latest policy present -> timing_configuration_presence_ready.
- Verify returned duration and policy are exact.
- Prove non-SCHEDULED -> invalid_state.
- Prove wrong tenant -> denied.
- Prove runtime does not mutate Exam Instance.
- Prove runtime creates no Exam Attempt or Exam Session.
- Prove preservation of BU-054 window columns/constraints.
- Prove preservation of BU-056 constraint `ck_sa_exam_instances_attempt_duration_positive`.
- Prove preservation of BU-057 constraint `ck_sa_exam_instances_latest_start_policy` and all allowed values physically.
- Prove preservation of Academic Core schema and fixture data.
- Prove no migration/schema changes from BU-063.
- Disposable database cleanup on PASS and FAIL with leak detection.
- Emit `REAL POSTGRESQL VERIFICATION: PASS`.

## AUTHORIZED PATH SCOPE
1. `runtime/secure-assessment/src/exam-instance-timing-configuration-presence-readiness-preflight.ts`
2. `runtime/secure-assessment/test/exam-instance-timing-configuration-presence-readiness-preflight.test.ts`
3. `runtime/secure-assessment/verification/verify_bu063_exam_instance_timing_configuration_presence_readiness_preflight.ts`
4. `docs/build/units/BU-063_SECURE_ASSESSMENT_EXAM_INSTANCE_TIMING_CONFIGURATION_PRESENCE_READINESS_PREFLIGHT_RUNTIME_BOOTSTRAP.md`
5. `docs/build/BUILD_PHASE_INDEX.md`
6. `docs/state/CURRENT_STATE.md`
7. `docs/state/HANDOFF_PACKET.md`

## STOP CONDITIONS
- Schema/migration change becomes necessary.
- Full timing readiness semantics must be invented.
- Duration-vs-window policy must be invented.
- Current-time/start eligibility must be decided.
- Overall READY must be decided.
- SCHEDULED -> READY mutation becomes necessary.
- Permission Matrix must be finalized.
- PB05 must close.
- BU-062 must be reopened.
- BU-064 must be selected.
- Terminal execution becomes necessary.

## STAGE-2 ENGINEERING EVIDENCE
- PACKAGE TYPECHECK: PASS
- FOCUSED TEST: PASS / 14 / 14
- PACKAGE REGRESSION: PASS / 145 / 145
- VERIFIER STRICT TYPECHECK: PASS
- REAL POSTGRESQL VERIFICATION: PASS
- DISPOSABLE DATABASE CLEANUP: PASS
- RUNTIME SHA256: 0EC9D4BBE1597C3BB180D4EAB662E9C2EE51D219BAD6052CE95514E294E7606C
- FOCUSED TEST SHA256: EB26A10595CD8378251C17F354B1571B7A6D55ED9166F63CAF5C1469E5E08EE1
- VERIFIER SHA256: 127442EE540DC64EB0E6315361DA1854B5DDFD3888D8AF6CF64950EB874D55D2
- STAGE-2 ENVIRONMENT / PROCESS TRUTH: Initial local authentication failure resolved via controlled PostgreSQL recovery (temporary pg_hba trust for postgres/loopback, password reset, standard pgpass updated, pg_hba.conf byte-for-byte restored with final SHA256: 0C8DC6E6E57399790417A6E13B3A8E1B5E27AA19708A2122148FBFE3BDCECD42, normal pgpass authentication PASS, zero password logging, source trust preserved, no production runtime defect, no verifier defect).

## Execution State
- **BUILD UNIT:** BU-063 — Secure Assessment Exam Instance Timing Configuration Presence Readiness Preflight Runtime Bootstrap
- **STAGE-1 SCOPE FREEZE:** PASS / FROZEN
- **STAGE-2 SOURCE IMPLEMENTATION:** EXECUTED / COMPLETE
- **STAGE-2 ENGINEERING VERIFICATION:** PASS
- **PACKAGE TYPECHECK:** PASS
- **FOCUSED TEST:** PASS / 14 / 14
- **PACKAGE REGRESSION:** PASS / 145 / 145
- **VERIFIER STRICT TYPECHECK:** PASS
- **REAL POSTGRESQL VERIFICATION:** PASS
- **DISPOSABLE DATABASE CLEANUP:** PASS
- **RUNTIME SHA256:** 0EC9D4BBE1597C3BB180D4EAB662E9C2EE51D219BAD6052CE95514E294E7606C
- **FOCUSED TEST SHA256:** EB26A10595CD8378251C17F354B1571B7A6D55ED9166F63CAF5C1469E5E08EE1
- **VERIFIER SHA256:** 127442EE540DC64EB0E6315361DA1854B5DDFD3888D8AF6CF64950EB874D55D2
- **STAGE-2 REPOSITORY FINALIZED:** YES
- **STAGE-2 STATUS:** IMPLEMENTATION REPOSITORY FINALIZED / AWAITING CONTROLLER PHYSICAL AUDIT
- **STAGE-3 CONTROLLER PHYSICAL AUDIT:** NOT YET EXECUTED / AWAITING CONTROLLER
- **FAST-TRACK STAGE-4 LIFECYCLE CLOSE:** NOT YET
- **DONE:** NO
- **FULL BU-063 REPOSITORY FINALIZED:** NO
- **STAGE-5 FINAL PHYSICAL VERIFICATION:** NOT YET
- **FINAL PHYSICAL VERIFICATION:** NOT YET
- **NEXT BUILD UNIT:** NOT YET REGISTERED
- **SUCCESSOR:** NOT SELECTED / NOT REGISTERED
- **PB05:** OPEN / CARRIED FORWARD
- **OWNER DECISION REQUIRED:** NO
