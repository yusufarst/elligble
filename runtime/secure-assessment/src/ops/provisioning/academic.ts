import type pg from 'pg';
import {
    AcademicSetupConflict, ensureAcademicGroup, ensureAcademicPeriod, ensureAcademicYear, ensureGradeLevel,
    ensureStudentEnrollment, ensureSubject, ensureSubjectOffering, ensureTeachingAssignment, isIsoDate, isLabel,
} from '../../../../academic-core/src/provisioning.ts';
import { findAccountByElligbleId } from '../../../../identity-access/src/provisioning.ts';
import { findActiveTeacherAssignment, findMembership, findTenant } from '../../../../tenant-access/src/provisioning.ts';
import { recordProvisioningEvent, sha256, type OperatorContext } from './audit.ts';

// Academic setup import (template elligble-academic-v1, JSON) in the canonical onboarding
// order (D03.7-51): year and periods, grades, groups, subjects and offerings, teaching
// assignments, enrollments. People must already exist in the school (people import).
// Idempotent: an unchanged file re-applied creates nothing.

export const ACADEMIC_TEMPLATE = 'elligble-academic-v1';

export interface AcademicSetup {
    template: typeof ACADEMIC_TEMPLATE;
    year: { label: string; startDate: string; endDate: string };
    periods: Array<{ label: string; type?: string | null; startDate: string; endDate: string }>;
    grades: string[];
    groups: Array<{ label: string; grade: string }>;
    subjects: string[];
    offerings: Array<{ subject: string; period: string; grade: string }>;
    teaching: Array<{ teacher: string; subject: string; period: string; group: string }>;
    enrollments: Array<{ group: string; period: string; startDate: string; students: string[] }>;
}

function isArrayOf<T>(value: unknown, check: (item: any) => boolean): value is T[] {
    return Array.isArray(value) && value.every(check);
}

/** Structural and cross-reference validation of the whole file before any write. */
export function validateAcademicSetup(value: unknown): { setup: AcademicSetup | null; problems: string[] } {
    const problems: string[] = [];
    const v = value as Record<string, any>;
    if (!v || typeof v !== 'object' || v.template !== ACADEMIC_TEMPLATE) {
        return { setup: null, problems: [`"template" must be "${ACADEMIC_TEMPLATE}"`] };
    }
    if (!v.year || !isLabel(v.year.label) || !isIsoDate(v.year.startDate) || !isIsoDate(v.year.endDate) || v.year.startDate > v.year.endDate) {
        problems.push('year needs label, startDate and endDate (YYYY-MM-DD, start not after end)');
    }
    if (!isArrayOf(v.periods, p => isLabel(p?.label) && isIsoDate(p?.startDate) && isIsoDate(p?.endDate) && p.startDate <= p.endDate && (p.type === undefined || p.type === null || isLabel(p.type)))) {
        problems.push('periods need label, startDate and endDate; type is optional');
    }
    if (!isArrayOf(v.grades, isLabel)) problems.push('grades must be a list of labels');
    if (!isArrayOf(v.groups, g => isLabel(g?.label) && isLabel(g?.grade))) problems.push('groups need label and grade');
    if (!isArrayOf(v.subjects, isLabel)) problems.push('subjects must be a list of labels');
    if (!isArrayOf(v.offerings, o => isLabel(o?.subject) && isLabel(o?.period) && isLabel(o?.grade))) problems.push('offerings need subject, period and grade');
    if (!isArrayOf(v.teaching, t => typeof t?.teacher === 'string' && isLabel(t?.subject) && isLabel(t?.period) && isLabel(t?.group))) problems.push('teaching entries need teacher, subject, period and group');
    if (!isArrayOf(v.enrollments, e => isLabel(e?.group) && isLabel(e?.period) && isIsoDate(e?.startDate) && isArrayOf(e?.students, s => typeof s === 'string'))) {
        problems.push('enrollments need group, period, startDate and a list of student ELLIGBLE IDs');
    }
    if (problems.length > 0) return { setup: null, problems };

    const setup = v as AcademicSetup;
    const periods = new Set(setup.periods.map(p => p.label.trim()));
    const grades = new Set(setup.grades.map(g => g.trim()));
    const groups = new Map(setup.groups.map(g => [g.label.trim(), g.grade.trim()]));
    const subjects = new Set(setup.subjects.map(s => s.trim()));
    for (const p of setup.periods) {
        if (p.startDate < setup.year.startDate || p.endDate > setup.year.endDate) problems.push(`period "${p.label}" lies outside the year`);
    }
    for (const g of setup.groups) if (!grades.has(g.grade.trim())) problems.push(`group "${g.label}" refers to unknown grade "${g.grade}"`);
    for (const o of setup.offerings) {
        if (!subjects.has(o.subject.trim())) problems.push(`offering refers to unknown subject "${o.subject}"`);
        if (!periods.has(o.period.trim())) problems.push(`offering refers to unknown period "${o.period}"`);
        if (!grades.has(o.grade.trim())) problems.push(`offering refers to unknown grade "${o.grade}"`);
    }
    const offerings = new Set(setup.offerings.map(o => `${o.subject.trim()}|${o.period.trim()}|${o.grade.trim()}`));
    for (const t of setup.teaching) {
        const grade = groups.get(t.group.trim());
        if (!grade) problems.push(`teaching refers to unknown group "${t.group}"`);
        else if (!offerings.has(`${t.subject.trim()}|${t.period.trim()}|${grade}`)) problems.push(`teaching of "${t.subject}" for "${t.group}" has no matching offering`);
    }
    const enrolled = new Map<string, string>();
    for (const e of setup.enrollments) {
        if (!groups.has(e.group.trim())) problems.push(`enrollment refers to unknown group "${e.group}"`);
        if (!periods.has(e.period.trim())) problems.push(`enrollment refers to unknown period "${e.period}"`);
        for (const student of e.students) {
            const key = `${student.trim().toLowerCase()}|${e.period.trim()}`;
            if (enrolled.has(key) && enrolled.get(key) !== e.group.trim()) problems.push(`student "${student}" is listed in two groups for "${e.period}"`);
            enrolled.set(key, e.group.trim());
        }
    }
    return { setup: problems.length === 0 ? setup : null, problems };
}

export interface AcademicImportResult {
    ok: boolean;
    dryRun: boolean;
    problems: string[];
    summary: Record<string, number>;
}

export async function importAcademic(
    pool: pg.Pool,
    input: { tenantId: string; text: string; context: OperatorContext; dryRun: boolean }
): Promise<AcademicImportResult> {
    let json: unknown;
    try {
        json = JSON.parse(input.text);
    } catch {
        return { ok: false, dryRun: input.dryRun, problems: ['the file is not valid JSON'], summary: {} };
    }
    const { setup, problems } = validateAcademicSetup(json);
    const result: AcademicImportResult = { ok: false, dryRun: input.dryRun, problems, summary: {} };
    if (!setup) return result;

    const created: Record<string, number> = { years: 0, periods: 0, grades: 0, groups: 0, subjects: 0, offerings: 0, teaching: 0, enrollments: 0 };
    const tally = <T extends { created: boolean }>(key: string, ensured: T): T => { if (ensured.created) created[key]++; return ensured; };
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const tenantId = input.tenantId;
        if (!(await findTenant(client, tenantId))) {
            result.problems.push('school (tenant) not found');
            await client.query('ROLLBACK');
            return result;
        }
        const year = tally('years', await ensureAcademicYear(client, tenantId, setup.year));
        const periodIds = new Map<string, string>();
        for (const p of setup.periods) {
            periodIds.set(p.label.trim(), tally('periods', await ensureAcademicPeriod(client, tenantId, year.id, { label: p.label, type: p.type ?? null, startDate: p.startDate, endDate: p.endDate })).id);
        }
        const gradeIds = new Map<string, string>();
        for (const g of setup.grades) gradeIds.set(g.trim(), tally('grades', await ensureGradeLevel(client, tenantId, g)).id);
        const groupIds = new Map<string, string>();
        for (const g of setup.groups) {
            groupIds.set(g.label.trim(), tally('groups', await ensureAcademicGroup(client, tenantId, { academicYearId: year.id, gradeLevelId: gradeIds.get(g.grade.trim())!, label: g.label })).id);
        }
        const subjectIds = new Map<string, string>();
        for (const s of setup.subjects) subjectIds.set(s.trim(), tally('subjects', await ensureSubject(client, tenantId, s)).id);
        const offeringIds = new Map<string, string>();
        for (const o of setup.offerings) {
            const ensured = tally('offerings', await ensureSubjectOffering(client, tenantId, {
                subjectId: subjectIds.get(o.subject.trim())!, academicPeriodId: periodIds.get(o.period.trim())!, gradeLevelId: gradeIds.get(o.grade.trim())!,
            }));
            offeringIds.set(`${o.subject.trim()}|${o.period.trim()}|${o.grade.trim()}`, ensured.id);
        }
        const groupGrade = new Map(setup.groups.map(g => [g.label.trim(), g.grade.trim()]));
        for (const t of setup.teaching) {
            const account = await findAccountByElligbleId(client, t.teacher.trim().toLowerCase());
            const teacherAssignmentId = account ? await findActiveTeacherAssignment(client, tenantId, account.personId) : null;
            if (!teacherAssignmentId) {
                result.problems.push(`teacher "${t.teacher}" is not a teacher of this school (import them with kind "teacher" first)`);
                continue;
            }
            tally('teaching', await ensureTeachingAssignment(client, tenantId, {
                teacherAssignmentId,
                subjectOfferingId: offeringIds.get(`${t.subject.trim()}|${t.period.trim()}|${groupGrade.get(t.group.trim())}`)!,
                academicGroupId: groupIds.get(t.group.trim())!,
            }));
        }
        for (const e of setup.enrollments) {
            for (const student of e.students) {
                const account = await findAccountByElligbleId(client, student.trim().toLowerCase());
                const membershipId = account ? await findMembership(client, tenantId, account.personId) : null;
                if (!membershipId) {
                    result.problems.push(`student "${student}" is not a member of this school (import people first)`);
                    continue;
                }
                tally('enrollments', await ensureStudentEnrollment(client, tenantId, {
                    academicYearId: year.id, academicPeriodId: periodIds.get(e.period.trim())!, academicGroupId: groupIds.get(e.group.trim())!,
                    membershipId, startDate: e.startDate, source: 'OPERATOR_IMPORT',
                }));
            }
        }
        result.summary = created;
        if (result.problems.length > 0 || input.dryRun) {
            await client.query('ROLLBACK');
            result.ok = result.problems.length === 0;
            return result;
        }
        await recordProvisioningEvent(client, { tenantId, action: 'academic_imported', context: input.context, inputSha256: sha256(input.text), summary: created });
        await client.query('COMMIT');
        result.ok = true;
        return result;
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        if (err instanceof AcademicSetupConflict) {
            result.problems.push(err.message);
            return result;
        }
        throw err;
    } finally {
        client.release();
    }
}
