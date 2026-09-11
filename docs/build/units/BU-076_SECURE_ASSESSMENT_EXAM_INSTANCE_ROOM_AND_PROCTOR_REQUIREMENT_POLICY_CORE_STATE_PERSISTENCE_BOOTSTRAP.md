# BU-076: Secure Assessment Exam Instance Room and Proctor Requirement Policy Core State Persistence Bootstrap

## BUILD UNIT IDENTIFIER
- BUILD UNIT: BU-076
- STAGE-1: PASS / FROZEN
- DIRECT PERSISTENCE PREDECESSOR: BU-053
- SEQUENCE GATE: BU-075 terminal / Stage-5 PASS
- MIGRATION: 0034 (`0034_bu076_secure_assessment_exam_instance_room_proctor_requirement_policy`)
- PB05: OPEN / CARRIED FORWARD
- OWNER DECISION REQUIRED: NO
- BU-077: NOT SELECTED / NOT REGISTERED

## PURPOSE
Persist exactly two Exam Instance policy-applicability facts required before conditional room/proctor readiness can later be composed.

Target table:
`public.secure_assessment_exam_instances`

Columns added:
- `room_based_operations_enabled BOOLEAN NULL`
- `proctor_per_room_required BOOLEAN NULL`

NO DEFAULTS.

## SEMANTIC POLICY MATRIX
Exact 4 valid semantic states:
1. `NULL / NULL`: requirement policy not configured
2. `FALSE / FALSE`: room-based operations disabled
3. `TRUE / FALSE`: room-based operations enabled, explicit per-room Proctor coverage not required by this policy fact
4. `TRUE / TRUE`: room-based operations enabled, per-room Proctor coverage required

Exact 5 rejected invalid states (failing closed with check-constraint SQLSTATE 23514):
1. `FALSE / TRUE`: cannot require per-room proctor when room operations are disabled
2. `NULL / FALSE`: partial configuration rejected
3. `NULL / TRUE`: partial configuration rejected
4. `FALSE / NULL`: partial configuration rejected
5. `TRUE / NULL`: partial configuration rejected

Required invariant:
- Both values are NULL OR both values are non-NULL;
- AND `proctor_per_room_required = TRUE` requires `room_based_operations_enabled = TRUE`.

Existing Exam Instance rows created before 0034 remain `NULL / NULL` after migration without silent classification.
These values must NOT be inferred from the existence of Room rows, Participant Room Assignments, Proctor Assignments, Teaching Assignment, Assessment Type, or creator identity.

## CHECK CONSTRAINT
Constraint name:
`ck_sa_exam_instances_room_proctor_requirement_policy`

Definition:
```sql
CONSTRAINT ck_sa_exam_instances_room_proctor_requirement_policy CHECK (
  (room_based_operations_enabled IS NULL AND proctor_per_room_required IS NULL)
  OR
  (
    room_based_operations_enabled IS NOT NULL
    AND proctor_per_room_required IS NOT NULL
    AND (
      (room_based_operations_enabled = FALSE AND proctor_per_room_required = FALSE)
      OR
      (room_based_operations_enabled = TRUE AND proctor_per_room_required = FALSE)
      OR
      (room_based_operations_enabled = TRUE AND proctor_per_room_required = TRUE)
    )
  )
)
```

## CANONICAL BOUNDARY
This BU does NOT create:
- `TEACHER_MANAGED` / `INSTITUTION_MANAGED` enum
- Overall Room readiness evaluator
- Overall READY evaluator
- `SCHEDULED` -> `READY` transition
- `READY` -> `ACTIVE` transition
- Room creation or mutation
- Participant-to-Room mutation
- Proctor Assignment mutation
- Proctor-to-Room mapping mutation
- Room capacity or seating policy
- Anti-cheating policy
- Technical / device compatibility
- API / frontend endpoints
- Permission Matrix / PB05 closure
- Academic Core mutation
- BU-077 selection or registration

## MIGRATION SPECIFICATION
File: `database/migrations/0034_bu076_secure_assessment_exam_instance_room_proctor_requirement_policy.sql`
- Migration 0034 only;
- Repeat-safe / compatibility-aware following established repository migration precedent;
- Existing canonical migrations 0001..0033 preserved;
- Migration history progresses from 33 to 34 exactly;
- No new table;
- No unrelated column;
- No unrelated index;
- No Academic Core schema change;
- No data rewrite beyond PostgreSQL behavior required to add nullable no-default columns;
- Incompatible pre-existing same-name columns/constraints fail closed.

## VERIFICATION
File: `database/verification/verify_bu076_secure_assessment_exam_instance_room_proctor_requirement_policy.js`
- Real PostgreSQL foreground execution against disposable database prefixed with `elligble_bu076_`;
- Proves migrations 0001..0033 canonical prerequisite history;
- Proves pre-0034 history = 33;
- Proves migration 0034 applies normally;
- Proves post-0034 history = 34;
- Proves migration 0035 absent;
- Proves exact two new columns exist on `public.secure_assessment_exam_instances` (type boolean, is_nullable YES, default NULL);
- Proves existing pre-0034 Exam Instance rows become NULL / NULL;
- Proves full policy matrix: 4 valid states accepted, 5 invalid states rejected with exact SQLSTATE 23514;
- Proves repeat-safe idempotency;
- Proves no unexpected schema objects;
- Proves Academic Core schema and data unchanged;
- Proves zero mutation to Room, Participant Room Assignment, Proctor Assignment, Proctor Room Assignment, Attempt, Session;
- Proves fail-closed behavior on incompatible column or constraint;
- Proves disposable DB fail-closed cleanup;
- Proves pre-run and post-run zero database leaks (`elligble_bu076_*` count = 0).

## STATUS
STAGE-2: PASS
STAGE-3: PENDING (Controller Physical Audit)
DONE: NO
