import type { ClientBase } from 'pg';

// Academic Core provisioning for operator setup (D03.7-44/45/51: platform-assisted setup in
// the canonical order year/period, grade, group, subject/offering, teaching assignment,
// enrollment; D03.3-38..40: enrollment provenance, idempotent and conflict-checked).
// Every function runs inside the caller's open transaction and is idempotent by the entity's
// label within the school: re-running an unchanged setup creates nothing, and an existing
// entity with different facts is a conflict, never silently changed.

export class AcademicSetupConflict extends Error {
    readonly entity: string;
    constructor(entity: string, message: string) {
        super(message);
        this.name = 'AcademicSetupConflict';
        this.entity = entity;
    }
}

export interface Ensured {
    id: string;
    created: boolean;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is string {
    if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isLabel(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 255;
}

async function lock(client: ClientBase, key: string): Promise<void> {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
}

async function single(client: ClientBase, entity: string, sql: string, params: unknown[]): Promise<Record<string, any> | null> {
    const res = await client.query(sql, params);
    if ((res.rowCount ?? 0) > 1) throw new AcademicSetupConflict(entity, `More than one ${entity} matches; resolve the duplicate first.`);
    return res.rowCount === 1 ? res.rows[0] : null;
}

export async function ensureAcademicYear(
    client: ClientBase,
    tenantId: string,
    input: { label: string; startDate: string; endDate: string }
): Promise<Ensured> {
    const label = input.label.trim();
    await lock(client, `ac_year:${tenantId}:${label}`);
    const existing = await single(client, 'academic year',
        `SELECT id, to_char(start_date, 'YYYY-MM-DD') AS start_date, to_char(end_date, 'YYYY-MM-DD') AS end_date
         FROM academic_core_academic_years WHERE tenant_id = $1 AND display_label = $2`, [tenantId, label]);
    if (existing) {
        if (existing.start_date !== input.startDate || existing.end_date !== input.endDate) {
            throw new AcademicSetupConflict('academic year', `Academic year "${label}" exists with different dates.`);
        }
        return { id: existing.id, created: false };
    }
    const res = await client.query(
        'INSERT INTO academic_core_academic_years (tenant_id, display_label, start_date, end_date) VALUES ($1, $2, $3, $4) RETURNING id',
        [tenantId, label, input.startDate, input.endDate]
    );
    return { id: res.rows[0].id, created: true };
}

export async function ensureAcademicPeriod(
    client: ClientBase,
    tenantId: string,
    academicYearId: string,
    input: { label: string; type: string | null; startDate: string; endDate: string }
): Promise<Ensured> {
    const label = input.label.trim();
    await lock(client, `ac_period:${tenantId}:${academicYearId}:${label}`);
    const existing = await single(client, 'academic period',
        `SELECT id, period_type, to_char(start_date, 'YYYY-MM-DD') AS start_date, to_char(end_date, 'YYYY-MM-DD') AS end_date
         FROM academic_core_academic_periods WHERE tenant_id = $1 AND academic_year_id = $2 AND display_label = $3`,
        [tenantId, academicYearId, label]);
    if (existing) {
        if (existing.start_date !== input.startDate || existing.end_date !== input.endDate || (existing.period_type ?? null) !== input.type) {
            throw new AcademicSetupConflict('academic period', `Academic period "${label}" exists with different facts.`);
        }
        return { id: existing.id, created: false };
    }
    const res = await client.query(
        `INSERT INTO academic_core_academic_periods (tenant_id, academic_year_id, display_label, period_type, start_date, end_date)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [tenantId, academicYearId, label, input.type, input.startDate, input.endDate]
    );
    return { id: res.rows[0].id, created: true };
}

async function ensureLabelled(client: ClientBase, entity: string, table: string, tenantId: string, label: string): Promise<Ensured> {
    const trimmed = label.trim();
    await lock(client, `${table}:${tenantId}:${trimmed}`);
    const existing = await single(client, entity, `SELECT id FROM ${table} WHERE tenant_id = $1 AND display_label = $2`, [tenantId, trimmed]);
    if (existing) return { id: existing.id, created: false };
    const res = await client.query(`INSERT INTO ${table} (tenant_id, display_label) VALUES ($1, $2) RETURNING id`, [tenantId, trimmed]);
    return { id: res.rows[0].id, created: true };
}

export function ensureGradeLevel(client: ClientBase, tenantId: string, label: string): Promise<Ensured> {
    return ensureLabelled(client, 'grade level', 'academic_core_grade_levels', tenantId, label);
}

export function ensureSubject(client: ClientBase, tenantId: string, label: string): Promise<Ensured> {
    return ensureLabelled(client, 'subject', 'academic_core_subjects', tenantId, label);
}

export async function ensureAcademicGroup(
    client: ClientBase,
    tenantId: string,
    input: { academicYearId: string; gradeLevelId: string; label: string }
): Promise<Ensured> {
    const label = input.label.trim();
    await lock(client, `ac_group:${tenantId}:${input.academicYearId}:${label}`);
    const existing = await single(client, 'academic group',
        'SELECT id, grade_level_id FROM academic_core_academic_groups WHERE tenant_id = $1 AND academic_year_id = $2 AND display_label = $3',
        [tenantId, input.academicYearId, label]);
    if (existing) {
        if (existing.grade_level_id !== input.gradeLevelId) {
            throw new AcademicSetupConflict('academic group', `Group "${label}" exists in another grade.`);
        }
        return { id: existing.id, created: false };
    }
    const res = await client.query(
        'INSERT INTO academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label) VALUES ($1, $2, $3, $4) RETURNING id',
        [tenantId, input.academicYearId, input.gradeLevelId, label]
    );
    return { id: res.rows[0].id, created: true };
}

export async function ensureSubjectOffering(
    client: ClientBase,
    tenantId: string,
    input: { subjectId: string; academicPeriodId: string; gradeLevelId: string | null }
): Promise<Ensured> {
    await lock(client, `ac_offering:${tenantId}:${input.subjectId}:${input.academicPeriodId}:${input.gradeLevelId ?? '-'}`);
    const existing = await single(client, 'subject offering',
        `SELECT id FROM academic_core_subject_offerings
         WHERE tenant_id = $1 AND subject_id = $2 AND academic_period_id = $3 AND grade_level_id IS NOT DISTINCT FROM $4`,
        [tenantId, input.subjectId, input.academicPeriodId, input.gradeLevelId]);
    if (existing) return { id: existing.id, created: false };
    const res = await client.query(
        'INSERT INTO academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES ($1, $2, $3, $4) RETURNING id',
        [tenantId, input.subjectId, input.academicPeriodId, input.gradeLevelId]
    );
    return { id: res.rows[0].id, created: true };
}

export async function ensureTeachingAssignment(
    client: ClientBase,
    tenantId: string,
    input: { teacherAssignmentId: string; subjectOfferingId: string; academicGroupId: string }
): Promise<Ensured> {
    await lock(client, `ac_teaching:${tenantId}:${input.teacherAssignmentId}:${input.subjectOfferingId}:${input.academicGroupId}`);
    const existing = await single(client, 'teaching assignment',
        `SELECT id FROM academic_core_teaching_assignments
         WHERE tenant_id = $1 AND teacher_assignment_id = $2 AND subject_offering_id = $3 AND academic_group_id = $4 AND revoked_at IS NULL`,
        [tenantId, input.teacherAssignmentId, input.subjectOfferingId, input.academicGroupId]);
    if (existing) return { id: existing.id, created: false };
    const res = await client.query(
        `INSERT INTO academic_core_teaching_assignments (tenant_id, teacher_assignment_id, subject_offering_id, academic_group_id)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [tenantId, input.teacherAssignmentId, input.subjectOfferingId, input.academicGroupId]
    );
    return { id: res.rows[0].id, created: true };
}

/**
 * One open enrollment per student and period: the same group again is idempotent, another
 * group is a conflict (moving a student is a governed change, not an import side effect).
 */
export async function ensureStudentEnrollment(
    client: ClientBase,
    tenantId: string,
    input: { academicYearId: string; academicPeriodId: string; academicGroupId: string; membershipId: string; startDate: string; source: string }
): Promise<Ensured> {
    await lock(client, `ac_enrollment:${tenantId}:${input.membershipId}:${input.academicPeriodId}`);
    const existing = await client.query(
        `SELECT id, academic_group_id FROM academic_core_student_enrollments
         WHERE tenant_id = $1 AND membership_id = $2 AND academic_period_id = $3 AND end_date IS NULL`,
        [tenantId, input.membershipId, input.academicPeriodId]
    );
    if ((existing.rowCount ?? 0) > 0) {
        if (existing.rows.some(row => row.academic_group_id !== input.academicGroupId)) {
            throw new AcademicSetupConflict('student enrollment', 'A student is already enrolled in another group for this period.');
        }
        return { id: existing.rows[0].id, created: false };
    }
    const res = await client.query(
        `INSERT INTO academic_core_student_enrollments
            (tenant_id, academic_year_id, membership_id, academic_group_id, academic_period_id, start_date, status, source)
         VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', $7) RETURNING id`,
        [tenantId, input.academicYearId, input.membershipId, input.academicGroupId, input.academicPeriodId, input.startDate, input.source]
    );
    return { id: res.rows[0].id, created: true };
}
