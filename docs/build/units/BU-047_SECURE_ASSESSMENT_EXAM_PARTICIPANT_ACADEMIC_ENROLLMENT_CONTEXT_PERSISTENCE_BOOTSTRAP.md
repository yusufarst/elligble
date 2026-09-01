# BU-047: Secure Assessment Exam Participant Academic-Enrollment Context Persistence Bootstrap

## 1. Description
This Build Unit introduces the cross-domain linkage between the Secure Assessment `secure_assessment_exam_participants` table and the Academic Core `academic_core_student_enrollments` table. The purpose is to persist the minimum required Academic Core enrollment reference needed by an existing Exam Participant.

## 2. Constraints & Principles
- **Domain Independence**: Secure Assessment must not re-own Academic Core truth. The linkage is strictly referential.
- **Predecessor Integrity**: Existing participant data (including `person_id`) remains intact.
- **Historical Validity**: An end-dated or historical Academic Enrollment reference remains referentially valid in Secure Assessment; active-enrollment validation is pushed to runtime assignment authorization.
- **No Mutations**: Participant references do not alter the Academic Core enrollment lifecycle or statuses.

## 3. Scope
- Add `academic_enrollment_id UUID NULL` to `secure_assessment_exam_participants`.
- Implement `uq_ac_student_enrollments_id_tenant` in `academic_core_student_enrollments`.
- Add composite, tenant-safe foreign key from Exam Participants to Student Enrollments (`ON DELETE RESTRICT`).
- Add exact normal NON-UNIQUE lookup index `idx_sa_exam_participants_tenant_academic_enrollment`.

## 4. Migration & Verification
- **Migration**: `0023_bu047_secure_assessment_exam_participant_academic_enrollment_context.sql`
- **Verifier**: `verify_bu047_secure_assessment_exam_participant_academic_enrollment_context.sql`

## 5. Status
- STAGE 1 SCOPE FREEZE PASS
- STAGE 2 IMPLEMENTATION EXECUTED
- REAL POSTGRESQL VERIFICATION PASS
- IMPLEMENTATION REPOSITORY FINALIZED YES
- AWAITING CONTROLLER PHYSICAL AUDIT YES
