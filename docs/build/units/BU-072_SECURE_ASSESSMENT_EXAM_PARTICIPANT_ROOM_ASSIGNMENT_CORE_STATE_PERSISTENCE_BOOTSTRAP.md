# BU-072: Secure Assessment Exam Participant Room Assignment Core State Persistence Bootstrap

## PURPOSE
Smallest persistence foundation for explicit Participant-to-Room assignment.

Canonical boundaries:
- Exam Participant is not Student Base Access.
- Exam Room is not Academic Group / Rombel.
- When room-based operation is used, participant-to-room assignment is explicit.
- BU-072 does NOT decide whether room-based operation is required.
- BU-072 does NOT implement readiness evaluation.
- BU-072 consumes existing Secure Assessment Participant and Exam Room truth.
- It MUST NOT mutate Academic Core.

## FROZEN PERSISTENCE CONTRACT
Migration ID:
`0032_bu072_secure_assessment_exam_participant_room_assignment_core_state`

### 1. Reference-Key Enablement
The persistence layer physically prevents cross-exam as well as cross-tenant Participant-to-Room assignments.
Add redundant composite UNIQUE constraints as reference keys:

- On `public.secure_assessment_exam_participants`:
  - `UNIQUE (id, tenant_id, exam_instance_id)`
  - Constraint name: `uq_sa_exam_participant_id_tenant_instance`

- On `public.secure_assessment_exam_rooms`:
  - `UNIQUE (id, tenant_id, exam_instance_id)`
  - Constraint name: `uq_sa_exam_room_id_tenant_instance`

### 2. Assignment Table
Create table:
`public.secure_assessment_exam_participant_room_assignments`

Columns exactly:
- `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `tenant_id` UUID NOT NULL
- `exam_instance_id` UUID NOT NULL
- `exam_participant_id` UUID NOT NULL
- `exam_room_id` UUID NOT NULL
- `assigned_at` TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP

Constraints:
1. `CONSTRAINT uq_sa_exam_participant_room_assignment_tenant UNIQUE (id, tenant_id)`
2. `CONSTRAINT uq_sa_exam_participant_room_assignment_participant UNIQUE (tenant_id, exam_instance_id, exam_participant_id)`
3. `CONSTRAINT fk_sa_exam_participant_room_assignment_participant FOREIGN KEY (exam_participant_id, tenant_id, exam_instance_id) REFERENCES public.secure_assessment_exam_participants (id, tenant_id, exam_instance_id) ON DELETE RESTRICT`
4. `CONSTRAINT fk_sa_exam_participant_room_assignment_room FOREIGN KEY (exam_room_id, tenant_id, exam_instance_id) REFERENCES public.secure_assessment_exam_rooms (id, tenant_id, exam_instance_id) ON DELETE RESTRICT`

Cross-domain boundaries:
- NO direct FK from `tenant_id` to `tenant_tenants`.
- NO FK to Academic Core.
- NO FK to Academic Group / Rombel.
- NO use of `person_id` as Participant-to-Room assignment identity.

## DIRECT PREDECESSORS
- BU-002 — Secure Assessment Core State Persistence Bootstrap
- BU-051 — Secure Assessment Exam Participant Concurrency Safe Uniqueness
- BU-071 — Secure Assessment Exam Room Core State Persistence Bootstrap

## SEQUENCE GATE
BU-071 terminally closed / DONE YES / full repository finalized YES / Stage-5 final physical verification PASS

## IN-SCOPE
- Migration `0032_bu072_secure_assessment_exam_participant_room_assignment_core_state.sql`
- Verifier `database/verification/verify_bu072_secure_assessment_exam_participant_room_assignment_core_state.js`
- Reference-key enablement constraints on `secure_assessment_exam_participants` and `secure_assessment_exam_rooms`
- Table `secure_assessment_exam_participant_room_assignments` with exact six columns and four constraints
- Proof of same-tenant and same-exam physical enforcement via composite foreign keys
- Proof of one participant maximum one persisted room assignment (participant uniqueness)
- Proof of multiple participants per room allowed
- Proof of independent rooms within same exam instance
- Proof of isolation across different exam instances and tenants
- Proof of DELETE RESTRICT on referenced participants and rooms
- Proof of Academic Core non-mutation
- Proof of existing Participant and Room data non-mutation
- Proof of zero mutation to proctors, attempts, sessions
- Repeat safety (idempotency) and disposable DB fail-closed cleanup

## STRICT OUT OF SCOPE
- Deciding whether room-based operation is enabled or mandatory
- Room-mode policy persistence
- Participant-to-Room assignment API/runtime service
- UI
- Manual assignment workflow
- Assisted/automatic room allocation
- Room transfer
- Reassignment
- Deassignment
- Assignment deletion workflow
- Room-transfer audit history
- Capacity
- Physical location/building taxonomy
- Proctor-to-Room assignment
- Per-room Proctor coverage
- Room readiness preflight
- Overall READY evaluator
- SCHEDULED -> READY transition
- READY -> ACTIVE transition
- Attempt creation
- Session creation
- Academic Core mutation
- Permission Matrix/PB05 closure
- BU-073 selection

## Execution State
- **STAGE-1:** PASS / FROZEN
- **SOURCE AUTHORING:** EXECUTED / COMPLETE
- **STAGE-2 REPOSITORY FINALIZED:** YES
- **DONE:** NO
- **FULL BU-072 REPOSITORY FINALIZED:** NO
- **PB05:** OPEN / CARRIED FORWARD
- **OWNER DECISION REQUIRED:** NO
- **BU-073:** NOT SELECTED / NOT REGISTERED


## Stage-2 Verification / Repository Finalization

- **FIRST REAL POSTGRESQL VERIFICATION:** FAIL / VERIFIER PostgreSQL name[] CATALOG ARRAY REPRESENTATION DEFECT
- **BU-072 MIGRATION DEFECT ESTABLISHED BY FIRST FAILURE:** NO
- **TARGETED VERIFIER ARRAY-TYPE REMEDIATION:** EXECUTED / VERIFIED
- **STATIC SOURCE CONTRACT AUDIT:** PASS / PRESERVED
- **VERIFIER JS SYNTAX CHECK:** PASS
- **REAL POSTGRESQL VERIFICATION:** PASS
- **MIGRATION HISTORY:** 31 -> 32 / PASS
- **MIGRATION 0032 REPEAT SAFETY:** PASS
- **PRE-RUN ZERO-LEAK:** PASS
- **POST-RUN ZERO-LEAK:** PASS
- **DISPOSABLE DATABASE CLEANUP FAIL-CLOSED:** VERIFIED
- **STAGE-2 REPOSITORY FINALIZED:** YES
- **STAGE-3 CONTROLLER PHYSICAL AUDIT:** PENDING
- **DONE:** NO
- **FULL BU-072 REPOSITORY FINALIZED:** NO
- **PB05:** OPEN / CARRIED FORWARD
- **OWNER DECISION REQUIRED:** NO
- **BU-073:** NOT SELECTED / NOT REGISTERED
