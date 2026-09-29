import type pg from 'pg';
import { findAccountByElligbleId } from '../../../../identity-access/src/provisioning.ts';
import { findActiveTeacherAssignment, findMembership, findTenant } from '../../../../tenant-access/src/provisioning.ts';
import {
    LATEST_START_POLICIES, buildBaselineFrozenContent, ensureAssessmentType, provisionScheduledExam, type LatestStartPolicy,
} from '../../exam-provisioning.ts';
import { parseCsv, requireHeader } from './csv.ts';
import { recordProvisioningEvent, sha256, type OperatorContext } from './audit.ts';

// Exam import (templates elligble-exam-v1 JSON + elligble-questions-v1 CSV): a scheduled,
// teacher-managed exam with baseline multiple-choice questions in the authored order.
// Participants are the students enrolled in the group for the period on the exam day
// (or an explicit subset of them); proctors are members of the school. Importing the same
// files twice is refused (the input hash is recorded in the provisioning audit).

export const EXAM_TEMPLATE = 'elligble-exam-v1';
export const QUESTIONS_TEMPLATE = 'elligble-questions-v1';
export const QUESTIONS_HEADER = ['no', 'prompt', 'option_a', 'option_b', 'option_c', 'option_d', 'option_e', 'correct', 'score'] as const;
const LETTERS = ['A', 'B', 'C', 'D', 'E'];

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

export function parseQuestionsCsv(text: string): { questions: Record<string, unknown>[]; problems: string[] } {
    const problems: string[] = [];
    const questions: Record<string, unknown>[] = [];
    const rows = requireHeader(parseCsv(text), QUESTIONS_HEADER, QUESTIONS_TEMPLATE);
    rows.forEach((row, index) => {
        const cells = row.cells.map(c => c.trim());
        if (cells.length !== QUESTIONS_HEADER.length) {
            problems.push(`line ${row.line}: expected ${QUESTIONS_HEADER.length} columns`);
            return;
        }
        const [no, prompt, a, b, c, d, e, correct, score] = cells;
        if (no !== String(index + 1)) {
            problems.push(`line ${row.line}: "no" must be ${index + 1} (questions are numbered 1, 2, 3 in order)`);
            return;
        }
        const correctIndex = LETTERS.indexOf(correct.toUpperCase());
        const maxScore = Number(score.replace(',', '.'));
        if (!prompt) problems.push(`line ${row.line}: the question text is empty`);
        else if ([a, b, c, d, e].some(option => !option)) problems.push(`line ${row.line}: all five options (A to E) are required`);
        else if (new Set([a, b, c, d, e].map(o => o.toLowerCase())).size !== 5) problems.push(`line ${row.line}: options must be different from each other`);
        else if (correctIndex < 0) problems.push(`line ${row.line}: "correct" must be one of A, B, C, D, E`);
        else if (!Number.isFinite(maxScore) || maxScore <= 0) problems.push(`line ${row.line}: "score" must be a positive number`);
        else questions.push(buildBaselineFrozenContent({ prompt, options: [a, b, c, d, e], correctIndex, maxScore }));
    });
    if (rows.length === 0) problems.push('the questions file has no questions');
    return { questions, problems };
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
        const enrolled = await client.query(
            `SELECT e.id AS enrollment_id, m.person_id, c.username
             FROM academic_core_student_enrollments e
             JOIN tenant_memberships m ON m.id = e.membership_id AND m.tenant_id = e.tenant_id
             JOIN identity_user_accounts a ON a.person_id = m.person_id
             JOIN identity_account_credentials c ON c.user_account_id = a.id
             WHERE e.tenant_id = $1 AND e.academic_group_id = $2 AND e.academic_period_id = $3
               AND e.start_date <= $4::date AND (e.end_date IS NULL OR e.end_date >= $4::date)`,
            [tenantId, groupId, periodId, examDay]
        );
        const byId = new Map(enrolled.rows.map(r => [r.username as string, r]));
        let chosen = enrolled.rows;
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
            participants: chosen.map(r => ({ personId: r.person_id, academicEnrollmentId: r.enrollment_id })),
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
