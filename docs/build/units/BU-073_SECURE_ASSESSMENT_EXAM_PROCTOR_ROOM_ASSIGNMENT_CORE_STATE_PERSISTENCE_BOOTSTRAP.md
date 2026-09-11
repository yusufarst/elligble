# BU-073: Secure Assessment Exam Proctor Room Assignment Core State Persistence Bootstrap

## PURPOSE
Smallest persistence foundation for scoping an explicit Proctor Assignment to one or more Exam Rooms.

Canonical boundaries:
- Teacher != Proctor.
- Exam Room != Academic Group / Rombel.
- Proctor authority comes from explicit Secure Assessment Proctor Assignment.
- BU-073 maps that explicit assignment to Exam Room scope.
- BU-073 does NOT determine required proctor coverage.
- BU-073 does NOT implement READY evaluation.
- Active/revoked lifecycle remains owned by parent Proctor Assignment (`secure_assessment_proctor_assignments`).
- It MUST NOT mutate Academic Core.

## FROZEN PERSISTENCE CONTRACT
Migration ID:
`0033_bu073_secure_assessment_exam_proctor_room_assignment_core_state`

### 1. Proctor Reference-Key Enablement
On `public.secure_assessment_proctor_assignments`:
Add exact redundant composite UNIQUE reference key:
- `CONSTRAINT uq_sa_proctor_assignment_id_tenant_instance UNIQUE (id, tenant_id, exam_instance_id)`

Preserves existing `assigned_at`, `revoked_at`, `chk_sa_proctor_assignment_temporal`, and `uq_sa_proctor_assignment_active`.

### 2. Existing Room Reference Key
Consumes existing key established in BU-072 on `public.secure_assessment_exam_rooms`:
- `CONSTRAINT uq_sa_exam_room_id_tenant_instance UNIQUE (id, tenant_id, exam_instance_id)`

### 3. New Table
Create table:
`public.secure_assessment_exam_proctor_room_assignments`

Columns exactly:
- `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `tenant_id` UUID NOT NULL
- `exam_instance_id` UUID NOT NULL
- `proctor_assignment_id` UUID NOT NULL
- `exam_room_id` UUID NOT NULL
- `assigned_at` TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP

Constraints:
1. `CONSTRAINT uq_sa_exam_proctor_room_assignment_tenant UNIQUE (id, tenant_id)`
2. `CONSTRAINT uq_sa_exam_proctor_room_assignment_mapping UNIQUE (tenant_id, exam_instance_id, proctor_assignment_id, exam_room_id)`
3. `CONSTRAINT fk_sa_exam_proctor_room_assignment_proctor FOREIGN KEY (proctor_assignment_id, tenant_id, exam_instance_id) REFERENCES public.secure_assessment_proctor_assignments (id, tenant_id, exam_instance_id) ON DELETE RESTRICT`
4. `CONSTRAINT fk_sa_exam_proctor_room_assignment_room FOREIGN KEY (exam_room_id, tenant_id, exam_instance_id) REFERENCES public.secure_assessment_exam_rooms (id, tenant_id, exam_instance_id) ON DELETE RESTRICT`

Cross-domain boundaries:
- NO direct FK from `tenant_id` to `tenant_tenants`.
- NO FK to Academic Core.
- NO FK to Academic Group / Rombel.
- NO use of `person_id` as room-scope mapping identity.

## DIRECT PREDECESSORS
- BU-034 — Secure Assessment Explicit Proctor Assignment Core State Persistence Bootstrap
- BU-071 — Secure Assessment Exam Room Core State Persistence Bootstrap
- BU-072 — Secure Assessment Exam Participant Room Assignment Core State Persistence Bootstrap

## SEQUENCE GATE
BU-072 fully terminal / DONE YES / full repository finalized YES / Stage-5 final physical verification PASS

## IN-SCOPE
- Migration `0033_bu073_secure_assessment_exam_proctor_room_assignment_core_state.sql`
- Verifier `database/verification/verify_bu073_secure_assessment_exam_proctor_room_assignment_core_state.js`
- Proctor reference-key enablement constraint on `secure_assessment_proctor_assignments`
- Table `secure_assessment_exam_proctor_room_assignments` with exact six columns and four constraints
- Physical enforcement of same-tenant and same-exam mapping via composite FKs
- Physical allowance of one proctor mapped to multiple rooms in the same exam instance
- Physical allowance of multiple proctors mapped to the same room
- Physical prevention of duplicate exact mappings via composite unique constraint
- Preservation of existing active proctor partial unique index
- Proof of DELETE RESTRICT on referenced proctor assignments and rooms
- Proof of Academic Core non-mutation
- Proof of existing Proctor Assignment, Room, and Participant-to-Room data non-mutation
- Proof of zero mutation to participants, attempts, sessions
- Repeat safety (idempotency) and disposable DB fail-closed cleanup

## STRICT OUT OF SCOPE
- Creation/revocation workflow for Exam-level Proctor Assignment
- Changing existing Proctor authorization semantics
- Deciding minimum proctor count per room
- Per-room Proctor coverage readiness
- Room readiness preflight
- Room-mode policy
- Overall READY evaluator
- SCHEDULED -> READY transition
- READY -> ACTIVE transition
- Proctor feed authorization
- Incident feed room filtering runtime
- Broadcast authorization runtime
- Participant-to-Room changes
- Proctor room assignment API/service
- UI
- Manual room assignment workflow
- Automatic proctor allocation
- Proctor room reassignment
- Proctor room deassignment
- Mapping deletion workflow
- Academic Core mutation
- Permission Matrix/PB05 closure
- BU-074 selection

## Execution State
- **STAGE-1:** PASS / FROZEN
- **SOURCE AUTHORING:** EXECUTED / COMPLETE
- **STAGE-2 REPOSITORY FINALIZED:** YES
- **STAGE-3 CONTROLLER PHYSICAL AUDIT:** PASS
- **STAGE-3 CONTROLLER PHYSICAL AUDIT FINDING:** PASS / NO MATERIAL DEFECT REMAINS
- **FAST-TRACK STAGE-4 LIFECYCLE CLOSE:** COMPLETE
- **STAGE-4 REPOSITORY FINALIZED:** YES
- **STAGE-5 FINAL PHYSICAL VERIFICATION:** PASS
- **NEXT BUILD UNIT SELECTION / SCOPE FREEZE:** AUTHORIZED
- **DONE:** YES
- **FULL BU-073 REPOSITORY FINALIZED:** YES
- **PB05:** OPEN / CARRIED FORWARD
- **OWNER DECISION REQUIRED:** NO
- **BU-074:** NOT SELECTED / NOT REGISTERED


## Stage-2 Verification / Repository Finalization

- **MINIMAL STATIC SOURCE CONTRACT AUDIT:** PASS
- **VERIFIER JS SYNTAX CHECK:** PASS
- **REAL POSTGRESQL VERIFICATION:** PASS
- **MIGRATION HISTORY:** 32 -> 33 / PASS
- **MIGRATION 0033 REPEAT SAFETY:** PASS
- **PRE-RUN ZERO-LEAK:** PASS
- **POST-RUN ZERO-LEAK:** PASS
- **DISPOSABLE DATABASE CLEANUP FAIL-CLOSED:** VERIFIED
- **STAGE-2 REPOSITORY FINALIZED:** YES
- **STAGE-3 CONTROLLER PHYSICAL AUDIT:** PENDING
- **DONE:** NO
- **FULL BU-073 REPOSITORY FINALIZED:** NO
- **PB05:** OPEN / CARRIED FORWARD
- **OWNER DECISION REQUIRED:** NO
- **BU-074:** NOT SELECTED / NOT REGISTERED


## Fast-Track Stage-4 Lifecycle Close

- **STAGE-3 CONTROLLER PHYSICAL AUDIT:** PASS
- **STAGE-3 CONTROLLER PHYSICAL AUDIT FINDING:** PASS / NO MATERIAL DEFECT REMAINS
- **FAST-TRACK STAGE-4 LIFECYCLE CLOSE:** COMPLETE
- **STAGE-4 REPOSITORY FINALIZED:** YES
- **STAGE-5 FINAL PHYSICAL VERIFICATION:** PENDING
- **DONE:** YES
- **FULL BU-073 REPOSITORY FINALIZED:** YES
- **PB05:** OPEN / CARRIED FORWARD
- **OWNER DECISION REQUIRED:** NO
- **BU-074:** NOT SELECTED / NOT REGISTERED


## Stage-5 Final Physical Verification

- **STAGE-4 LIFECYCLE CLOSE COMMIT:** cd18311a8238a796b7eb883dbba5da1271d3290c
- **STAGE-5 FINAL PHYSICAL VERIFICATION:** PASS
- **FINAL PHYSICAL VERIFICATION:** PASS
- **DONE:** YES
- **FULL BU-073 REPOSITORY FINALIZED:** YES
- **NEXT BUILD UNIT SELECTION / SCOPE FREEZE:** AUTHORIZED
- **PB05:** OPEN / CARRIED FORWARD
- **OWNER DECISION REQUIRED:** NO
- **BU-074:** NOT SELECTED / NOT REGISTERED
