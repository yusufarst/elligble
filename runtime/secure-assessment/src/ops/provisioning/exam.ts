import type pg from 'pg';
import { findAccountByElligbleId } from '../../../../identity-access/src/provisioning.ts';
import { findActiveTeacherAssignment, findMembership, findTenant } from '../../../../tenant-access/src/provisioning.ts';
import {
    LATEST_START_POLICIES, buildBaselineFrozenContent, ensureAssessmentType, listEnrolledStudents, provisionScheduledExam, type LatestStartPolicy,
} from '../../exam-provisioning.ts';
import { QUESTIONS_HEADER, QUESTIONS_TEMPLATE, describeQuestionProblem, parseQuestionFile } from '../../question-import.ts';
import { recordProvisioningEvent, sha256, type OperatorContext } from './audit.ts';

// Exam import (templates elligble-exam-v1 JSON + elligble-questions-v1 CSV): a scheduled,
// teacher-managed exam with baseline multiple-choice questions in the authored order.
// Participants are the students enrolled in the group for the period on the exam day
// (or an explicit subset of them); proctors are members of the school. Importing the same
// files twice is refused (the input hash is recorded in the provisioning audit).

export const EXAM_TEMPLATE = 'elligble-exam-v1';
export { QUESTIONS_HEADER, QUESTIONS_TEMPLATE };

export interface ExamSetup {
    template: typeof EXAM_TEMPLATE;
    teacher: string;
    subject: string;
    period: string;
    group: string;
    assessmentType: string;
    window: { startsAt: string; endsAt: string };
    durationMinutes: number;
    latestStartPolicy: LatestStartPolicy;
    participants: 'group' | string[];
    proctors: string[];
}

const OFFSET_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export function validateExamSetup(value: unknown): { setup: ExamSetup | null; problems: string[] } {
    const v = value as Record<string, any>;
    const problems: string[] = [];
    if (!v || typeof v !== 'object' || v.template !== EXAM_TEMPLATE) return { setup: null, problems: [`"template" must be "${EXAM_TEMPLATE}"`] };
    for (const key of ['teacher', 'subject', 'period', 'group', 'assessmentType']) {
        if (typeof v[key] !== 'string' || v[key].trim().length === 0) problems.push(`"${key}" is required`);
    }
    const startsAt = v.window?.startsAt;
    const endsAt = v.window?.endsAt;
    if (typeof startsAt !== 'string' || typeof endsAt !== 'string' || !OFFSET_DATE_TIME.test(startsAt) || !OFFSET_DATE_TIME.test(endsAt)) {
        problems.push('"window" needs startsAt and endsAt as date-times with a time zone, for example 2026-10-05T08:00:00+07:00');
    } else if (!(Date.parse(endsAt) > Date.parse(startsAt))) {
        problems.push('the window must end after it starts');
    }
    if (!Number.isInteger(v.durationMinutes) || v.durationMinutes < 1 || v.durationMinutes > 24 * 60) problems.push('"durationMinutes" must be a whole number from 1 to 1440');
    if (!LATEST_START_POLICIES.includes(v.latestStartPolicy)) problems.push(`"latestStartPolicy" must be one of ${LATEST_START_POLICIES.join(', ')}`);
    if (v.participants !== 'group' && !(Array.isArray(v.participants) && v.participants.length > 0 && v.participants.every((p: unknown) => typeof p === 'string'))) {
        problems.push('"participants" must be "group" or a non-empty list of student ELLIGBLE IDs');
    }
    if (!Array.isArray(v.proctors) || !v.proctors.every((p: unknown) => typeof p === 'string')) problems.push('"proctors" must be a list of ELLIGBLE IDs (may be empty)');
    return { setup: problems.length === 0 ? (v as ExamSetup) : null, problems };
}

/** The shared question file check (question-import.ts) with the CLI's English wording. */
export function parseQuestionsCsv(text: string): { questions: Record<string, unknown>[]; problems: string[] } {
    const parsed = parseQuestionFile(text);
    return {
        questions: parsed.problems.length > 0 ? [] : parsed.questions.map(q => buildBaselineFrozenContent({
            prompt: q.prompt, options: q.options, correctIndex: q.correctIndex, maxScore: q.maxScore,
        })),
        problems: parsed.problems.map(describeQuestionProblem),
    };
}

export interface ExamImportResult {
    ok: boolean;
    dryRun: boolean;
    problems: string[];
    examInstanceId: string | null;
    summary: Record<string, number | string>;
}

export async function importExam(
    pool: pg.Pool,
    input: { tenantId: string; examText: string; questionsText: string; context: OperatorContext; dryRun: boolean }
): Promise<ExamImportResult> {
    const result: ExamImportResult = { ok: false, dryRun: input.dryRun, problems: [], examInstanceId: null, summary: {} };
    let json: unknown;
    try {
        json = JSON.parse(input.examText);
    } catch {
        result.problems.push('the exam file is not valid JSON');
        return result;
    }
    const { setup, problems } = validateExamSetup(json);
    result.problems.push(...problems);
    let questions: Record<string, unknown>[] = [];
    try {
        const parsed = parseQuestionsCsv(input.questionsText);
        questions = parsed.questions;
        result.problems.push(...parsed.problems);
    } catch (err) {
        result.problems.push(err instanceof Error ? err.message : 'the questions file cannot be read');
    }
    if (!setup || result.problems.length > 0) return result;

    const inputSha256 = sha256(input.examText, input.questionsText);
    const tenantId = input.tenantId;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        if (!(await findTenant(client, tenantId))) {
            result.problems.push('school (tenant) not found');
            await client.query('ROLLBACK');
            return result;
        }
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`exam_import:${tenantId}:${inputSha256}`]);
        const already = await client.query(
            `SELECT summary->>'examInstanceId' AS exam FROM platform_provisioning_events
             WHERE tenant_id = $1 AND action = 'exam_imported' AND input_sha256 = $2`,
            [tenantId, inputSha256]
        );
        if ((already.rowCount ?? 0) > 0) {
            result.problems.push(`these exact files were already imported (exam ${already.rows[0].exam})`);
            await client.query('ROLLBACK');
            return result;
        }

        const teacher = await findAccountByElligbleId(client, setup.teacher.trim().toLowerCase());
        const teacherAssignmentId = teacher ? await findActiveTeacherAssignment(client, tenantId, teacher.personId) : null;
        const teaching = teacherAssignmentId ? await client.query(
            `SELECT ta.id AS teaching_assignment_id, g.id AS group_id, p.id AS period_id
             FROM academic_core_teaching_assignments ta
             JOIN academic_core_academic_groups g ON g.id = ta.academic_group_id AND g.tenant_id = ta.tenant_id
             JOIN academic_core_subject_offerings o ON o.id = ta.subject_offering_id AND o.tenant_id = ta.tenant_id
             JOIN academic_core_subjects s ON s.id = o.subject_id AND s.tenant_id = o.tenant_id
             JOIN academic_core_academic_periods p ON p.id = o.academic_period_id AND p.tenant_id = o.tenant_id
             WHERE ta.tenant_id = $1 AND ta.teacher_assignment_id = $2 AND ta.revoked_at IS NULL
               AND s.display_label = $3 AND p.display_label = $4 AND g.display_label = $5`,
            [tenantId, teacherAssignmentId, setup.subject.trim(), setup.period.trim(), setup.group.trim()]
        ) : null;
        if (!teaching || teaching.rowCount !== 1) {
            result.problems.push(`no single active teaching assignment for teacher "${setup.teacher}", subject "${setup.subject}", period "${setup.period}" and group "${setup.group}" (run the academic import first)`);
            await client.query('ROLLBACK');
            return result;
        }
        const { teaching_assignment_id: teachingAssignmentId, group_id: groupId, period_id: periodId } = teaching.rows[0];

        // Students enrolled in the group for the period on the exam day (D04.4-02/05).
        const examDay = setup.window.startsAt.slice(0, 10);
        const enrolled = await listEnrolledStudents(client, tenantId, { groupId, periodId, examDay });
        const byId = new Map(enrolled.map(r => [r.elligbleId, r]));
        let chosen = enrolled;
        if (setup.participants !== 'group') {
            chosen = [];
            for (const id of setup.participants) {
                const row = byId.get(id.trim().toLowerCase());
                if (!row) result.problems.push(`participant "${id}" is not enrolled in "${setup.group}" for "${setup.period}" on ${examDay}`);
                else chosen.push(row);
            }
        }
        if (chosen.length === 0) result.problems.push(`no students are enrolled in "${setup.group}" for "${setup.period}" on ${examDay}`);
        const proctorPersonIds: string[] = [];
        for (const id of setup.proctors) {
            const account = await findAccountByElligbleId(client, id.trim().toLowerCase());
            if (!account || !(await findMembership(client, tenantId, account.personId))) result.problems.push(`proctor "${id}" is not a member of this school`);
            else proctorPersonIds.push(account.personId);
        }
        if (result.problems.length > 0) {
            await client.query('ROLLBACK');
            return result;
        }

        const assessmentType = await ensureAssessmentType(client, tenantId, setup.assessmentType);
        const { examInstanceId } = await provisionScheduledExam(client, tenantId, {
            teachingAssignmentId,
            assessmentTypeId: assessmentType.id,
            windowStartsAt: new Date(setup.window.startsAt),
            windowEndsAt: new Date(setup.window.endsAt),
            durationSeconds: setup.durationMinutes * 60,
            latestStartPolicy: setup.latestStartPolicy,
            questions,
            participants: chosen.map(r => ({ personId: r.personId, academicEnrollmentId: r.enrollmentId })),
            proctorPersonIds,
        });
        result.examInstanceId = examInstanceId;
        result.summary = { examInstanceId, questions: questions.length, participants: chosen.length, proctors: new Set(proctorPersonIds).size };
        if (input.dryRun) {
            await client.query('ROLLBACK');
            result.examInstanceId = null;
            result.ok = true;
            return result;
        }
        await recordProvisioningEvent(client, { tenantId, action: 'exam_imported', context: input.context, inputSha256, summary: result.summary });
        await client.query('COMMIT');
        result.ok = true;
        return result;
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
    }
}

/**
 * The school's assessment types (D04.2-26), defined by the operator at onboarding so that
 * teachers can schedule their own exams; idempotent by label (an existing type is kept).
 */
export async function addAssessmentTypes(
    pool: pg.Pool,
    input: { tenantId: string; labels: string[]; context: OperatorContext; dryRun: boolean }
): Promise<{ ok: boolean; problems: string[]; created: string[]; existing: string[] }> {
    const labels = [...new Set(input.labels.map(l => l.trim()))];
    const problems = labels.length === 0 ? ['give at least one --type'] : labels.filter(l => l.length === 0 || l.length > 100).map(l => `type label "${l}" must be 1 to 100 characters`);
    const result = { ok: false, problems, created: [] as string[], existing: [] as string[] };
    if (problems.length > 0) return result;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        if (!(await findTenant(client, input.tenantId))) {
            result.problems.push('school (tenant) not found');
            await client.query('ROLLBACK');
            return result;
        }
        for (const label of labels) {
            const ensured = await ensureAssessmentType(client, input.tenantId, label);
            (ensured.created ? result.created : result.existing).push(label);
        }
        // Like every operator run, a repeat that changes nothing is still recorded.
        if (input.dryRun) {
            await client.query('ROLLBACK');
        } else {
            await recordProvisioningEvent(client, {
                tenantId: input.tenantId, action: 'assessment_types_added', context: input.context, inputSha256: null,
                summary: { created: result.created.length, existing: result.existing.length },
            });
            await client.query('COMMIT');
        }
        result.ok = true;
        return result;
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
    }
}
