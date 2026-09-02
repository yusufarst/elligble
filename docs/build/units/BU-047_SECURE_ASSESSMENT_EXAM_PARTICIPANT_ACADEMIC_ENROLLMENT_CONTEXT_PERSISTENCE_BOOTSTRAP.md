# BU-047 — Secure Assessment Exam Participant Academic-Enrollment Context Persistence Bootstrap

Version: 1.0.0

## PURPOSE
Persist only the minimum Academic Core Enrollment reference required by an existing Secure Assessment Exam Participant.

## PREDECESSORS
- BU-002 — Secure Assessment Core State Persistence Bootstrap
- BU-046 — Academic Core Student Enrollment Core State Persistence Bootstrap

## CANONICAL SAFETY
- Academic Enrollment != Exam Participant
- Student != Exam Participant
- Person != Membership != Academic Enrollment
- Secure Assessment does not re-own Academic Core truth
- existing person_id remains preserved
- PB05 Permission Matrix remains OPEN
- no Production Blocker closes

## EXACT IN-SCOPE
- secure_assessment_exam_participants.academic_enrollment_id UUID NULL
- no default
- supporting uq_ac_student_enrollments_id_tenant UNIQUE (id, tenant_id)
- fk_sa_exam_participants_academic_enrollment
- FK (academic_enrollment_id, tenant_id) → academic_core_student_enrollments(id, tenant_id)
- ON DELETE RESTRICT
- normal NON-UNIQUE index idx_sa_exam_participants_tenant_academic_enrollment
- index columns (tenant_id, academic_enrollment_id)
- migration 0023_bu047_secure_assessment_exam_participant_academic_enrollment_context
- real PostgreSQL verification

## HISTORICAL / LIFECYCLE SEMANTICS
- academic_enrollment_id remains nullable for existing / pre-BU047 participant rows.
- FK is referential only.
- historical / end-dated Academic Enrollment remains referentially valid.
- active/current enrollment validation is deferred to later participant-assignment / Secure Assessment Entry runtime work.
- no trigger enforces active enrollment.
- Secure Assessment does not copy/re-own academic year, period, group, enrollment status, or enrollment source truth.

## EXACT OUT-OF-SCOPE
- participant creation runtime
- participant assignment runtime
- Secure Assessment Entry runtime
- active-enrollment authorization runtime
- Person ↔ Membership ↔ Enrollment runtime coherence logic
- removal or change of participant person_id
- Exam Instance changes
- Exam Attempt changes
- Exam Session changes
- Question Bank / Exam Question Snapshot changes
- answer / timer / submission changes
- participant status taxonomy
- Exam Room
- scoring
- Track integration
- STUDENT RBAC
- RBAC / ABAC framework
- Permission Matrix implementation
- PB05 closure
- any Production Blocker closure
- API / HTTP
- frontend / UI
- deployment / production hosting
- BU-048+

## VERIFICATION CONTRACT
- migration 0023 applies
- repeat invocation safe
- history count exactly 1
- column UUID / nullable / no default
- person_id preserved
- supporting unique constraint exact
- tenant-safe FK exact
- non-unique index exact
- same-tenant positive reference
- NULL compatibility
- cross-tenant rejection
- nonexistent reference rejection
- delete restriction
- historical/end-dated reference compatibility
- no Academic Core mutation
- forbidden-column audit
- BU-002 predecessor integrity
- BU-046 predecessor integrity
- disposable DB cleanup

## PROCESS / AUDIT HISTORY
- Stage 1 scope freeze: PASS
- Stage 2 implementation: EXECUTED
- Real PostgreSQL verification: PASS / execution evidence preserved
- Stage-2 process deviation: background/taskification used despite foreground-only control
- Stage-2 commit subject deviation: preserved / no history rewrite
- Stage-2 hygiene defect: trailing whitespace / forward corrected by 67baa3123f77051166252e41ec17271714024d47
- First Controller Physical Audit: FAIL — DOCUMENT_MANIFEST corruption / stale dynamic identities / control version drift / residual lower navigation / incomplete BU-047 spec
- Targeted Stage-3 control / manifest / spec / process-truth remediation: COMPLETE
- Implementation repository finalized: YES
- First Controller Physical Re-Audit: FAIL — HANDOFF exact-next-action residual / BU-047 spec control-character corruption
- Second targeted Stage-3 HANDOFF / spec / manifest / control-truth remediation: COMPLETE
- Second Controller Physical Re-Audit: FAIL — DOCUMENT_MANIFEST omitted / CURRENT_STATE + HANDOFF audit history incomplete / Agent background + checkout process deviation
- Third targeted Stage-3 control / manifest / process-truth remediation: COMPLETE
- Third Controller Physical Re-Audit: PASS
- Controller Physical Re-Audit: PASS
- Stage 4 Minimal Lifecycle Close: COMPLETE
- Awaiting Controller Physical Audit: NO
- Awaiting Controller Physical Re-Audit: NO
- Awaiting Third Controller Physical Re-Audit: NO
- Fast-Track lifecycle close: COMPLETE
- Done: YES
- Full BU-047 repository finalized: YES
- Final physical verification: NOT YET
- PB05: OPEN