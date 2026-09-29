import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { hashPassword } from '../../../identity-access/src/crypto.ts';

// Composable real-PostgreSQL fixtures for integration tests. They write rows directly
// with SQL, mirroring the canonical schema; production code paths are exercised by the
// tests, never by these builders.

export async function createTenant(pool: pg.Pool, displayLabel: string | null = null): Promise<string> {
    const res = await pool.query(
        'INSERT INTO tenant_tenants (id, display_label) VALUES (gen_random_uuid(), $1) RETURNING id',
        [displayLabel]
    );
    return res.rows[0].id;
}

export interface PersonAccount {
    personId: string;
    accountId: string;
    username: string;
    password: string;
}

// Hashing is the slow part of fixtures; reuse one verifier per password.
const verifierCache = new Map<string, string>();

export async function createPersonWithAccount(
    pool: pg.Pool,
    username: string = `user_${randomUUID().slice(0, 8)}`,
    password: string = 'kata-sandi-uji-1'
): Promise<PersonAccount> {
    const personId = randomUUID();
    const accountId = randomUUID();
    let verifier = verifierCache.get(password);
    if (!verifier) {
        verifier = hashPassword(password);
        verifierCache.set(password, verifier);
    }
    await pool.query('INSERT INTO identity_persons (id) VALUES ($1)', [personId]);
    await pool.query('INSERT INTO identity_user_accounts (id, person_id) VALUES ($1, $2)', [accountId, personId]);
    await pool.query(
        'INSERT INTO identity_account_credentials (user_account_id, username, password_verifier) VALUES ($1, $2, $3)',
        [accountId, username, verifier]
    );
    return { personId, accountId, username, password };
}

export async function addMembership(pool: pg.Pool, tenantId: string, personId: string): Promise<string> {
    const res = await pool.query(
        'INSERT INTO tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id',
        [tenantId, personId]
    );
    return res.rows[0].id;
}

export interface TeachingContext {
    teacherAssignmentId: string;
    teachingAssignmentId: string;
    subjectLabel: string;
    academicGroupId: string;
    assessmentTypeId: string;
}

export async function createTeachingContext(
    pool: pg.Pool,
    tenantId: string,
    teacherMembershipId: string,
    subjectLabel = 'Matematika Wajib'
): Promise<TeachingContext> {
    const q = async (sql: string, params: unknown[]) => (await pool.query(sql, params)).rows[0].id as string;
    const teacherAssignmentId = await q('INSERT INTO tenant_teacher_assignments (tenant_id, membership_id) VALUES ($1, $2) RETURNING id', [tenantId, teacherMembershipId]);
    const yearId = await q(`INSERT INTO academic_core_academic_years (tenant_id, display_label, start_date, end_date) VALUES ($1, '2026/2027', DATE '2026-07-01', DATE '2027-06-30') RETURNING id`, [tenantId]);
    const gradeId = await q(`INSERT INTO academic_core_grade_levels (tenant_id, display_label) VALUES ($1, 'Kelas 10') RETURNING id`, [tenantId]);
    const periodId = await q(`INSERT INTO academic_core_academic_periods (tenant_id, academic_year_id, display_label, period_type, start_date, end_date) VALUES ($1, $2, 'Semester Ganjil', 'SEMESTER', DATE '2026-07-01', DATE '2026-12-31') RETURNING id`, [tenantId, yearId]);
    const groupId = await q(`INSERT INTO academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label) VALUES ($1, $2, $3, 'X-1') RETURNING id`, [tenantId, yearId, gradeId]);
    const subjectId = await q('INSERT INTO academic_core_subjects (tenant_id, display_label) VALUES ($1, $2) RETURNING id', [tenantId, subjectLabel]);
    const offeringId = await q('INSERT INTO academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES ($1, $2, $3, $4) RETURNING id', [tenantId, subjectId, periodId, gradeId]);
    const teachingAssignmentId = await q('INSERT INTO academic_core_teaching_assignments (tenant_id, teacher_assignment_id, subject_offering_id, academic_group_id) VALUES ($1, $2, $3, $4) RETURNING id', [tenantId, teacherAssignmentId, offeringId, groupId]);
    const assessmentTypeId = await q(`INSERT INTO secure_assessment_assessment_types (tenant_id, display_label) VALUES ($1, 'ULANGAN_HARIAN') RETURNING id`, [tenantId]);
    return { teacherAssignmentId, teachingAssignmentId, subjectLabel, academicGroupId: groupId, assessmentTypeId };
}

export interface ExamInstanceOptions {
    lifecycleState?: string;
    windowStartsAt?: Date;
    windowEndsAt?: Date;
    durationSeconds?: number;
    latestStartPolicy?: 'FULL_DURATION_BEYOND_WINDOW' | 'REMAINING_WINDOW_ONLY' | 'LATE_START_BLOCKED';
    /** Room/proctor requirement policy (0034); defaults to teacher-managed without room operations. */
    roomBasedOperations?: boolean | null;
    proctorPerRoomRequired?: boolean | null;
}

export async function createExamInstance(
    pool: pg.Pool,
    tenantId: string,
    teaching: TeachingContext,
    options: ExamInstanceOptions = {}
): Promise<string> {
    const now = Date.now();
    const res = await pool.query(
        `INSERT INTO secure_assessment_exam_instances (
            tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state,
            window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy,
            room_based_operations_enabled, proctor_per_room_required
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [
            tenantId,
            teaching.teachingAssignmentId,
            teaching.assessmentTypeId,
            options.lifecycleState ?? 'ACTIVE',
            options.windowStartsAt ?? new Date(now - 60 * 60 * 1000),
            options.windowEndsAt ?? new Date(now + 2 * 60 * 60 * 1000),
            options.durationSeconds ?? 3600,
            options.latestStartPolicy ?? 'FULL_DURATION_BEYOND_WINDOW',
            options.roomBasedOperations === undefined ? false : options.roomBasedOperations,
            options.proctorPerRoomRequired === undefined ? false : options.proctorPerRoomRequired,
        ]
    );
    return res.rows[0].id;
}

export async function addParticipant(pool: pg.Pool, tenantId: string, examInstanceId: string, personId: string): Promise<string> {
    const res = await pool.query(
        'INSERT INTO secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3) RETURNING id',
        [tenantId, examInstanceId, personId]
    );
    return res.rows[0].id;
}

export async function createAttemptWithTimer(pool: pg.Pool, tenantId: string, participantId: string, durationSeconds = 3600): Promise<string> {
    const attempt = await pool.query(
        'INSERT INTO secure_assessment_exam_attempts (tenant_id, exam_participant_id) VALUES ($1, $2) RETURNING id',
        [tenantId, participantId]
    );
    const attemptId = attempt.rows[0].id;
    await pool.query(
        'INSERT INTO secure_assessment_timer_state (tenant_id, exam_attempt_id, configured_duration_seconds) VALUES ($1, $2, $3)',
        [tenantId, attemptId, durationSeconds]
    );
    return attemptId;
}

export async function addProctorAssignment(pool: pg.Pool, tenantId: string, examInstanceId: string, personId: string): Promise<string> {
    const res = await pool.query(
        'INSERT INTO secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3) RETURNING id',
        [tenantId, examInstanceId, personId]
    );
    return res.rows[0].id;
}

export function baselineQuestion(index: number, correct = 'B') {
    return {
        schemaVersion: 1,
        questionType: 'MULTIPLE_CHOICE_SINGLE',
        prompt: `Soal nomor ${index}: berapakah ${index} + ${index}?`,
        options: ['A', 'B', 'C', 'D', 'E'].map((id, i) => ({ id, content: String(index * 2 + i - 1) })),
        correctOptionId: correct,
        maxScore: 1,
    };
}

export async function addQuestionSnapshots(pool: pg.Pool, tenantId: string, examInstanceId: string, count: number): Promise<string[]> {
    const ids: string[] = [];
    for (let i = 1; i <= count; i++) {
        const res = await pool.query(
            'INSERT INTO secure_assessment_exam_question_snapshots (tenant_id, exam_instance_id, frozen_content) VALUES ($1, $2, $3) RETURNING id',
            [tenantId, examInstanceId, JSON.stringify(baselineQuestion(i))]
        );
        ids.push(res.rows[0].id);
    }
    return ids;
}
