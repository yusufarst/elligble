import { createHash, randomUUID } from 'node:crypto';
import type pg from 'pg';
import { evaluateExamReadiness } from './exam-lifecycle-operations.ts';
import {
    LATEST_START_POLICIES, buildBaselineFrozenContent, listEnrolledStudents, provisionScheduledExam, type LatestStartPolicy,
} from './exam-provisioning.ts';
import { MAX_IMPORT_QUESTIONS, MAX_QUESTION_SCORE, OPTION_LETTERS, parseQuestionFile, type QuestionProblem } from './question-import.ts';

// A teacher schedules a teacher-managed exam for one of their own teaching assignments from
// a question file (ASSESS-TEACHER-001; D04.4-26A/26C LOCKED: the teacher creates the exam for
// the authorized subject and class, participants stay inside that teaching context, and the
// teacher supervises it). The canonical elligble-questions-v1 file is checked as a whole
// (D04.3-61/62/64 LOCKED) and previewed before anything is kept (D04.3-63 LOCKED): the
// preview schedules the exam inside a transaction, runs the same readiness checks that
// marking it ready runs, and rolls everything back, so what the teacher previews is exactly
// what a confirmation creates. The confirmation repeats the preview on the same file (its
// SHA-256 must match) and keeps it. The teacher's device names each confirmed import with a
// key, and a retry with that key returns the exam already created instead of a second one
// (D04.3-65 LOCKED). The batch, the file's name and SHA-256, and each question's source line
// are kept with the exam (D04.3-66 LOCKED). Participants are the students enrolled in the
// class for the period on the exam day, all unless the teacher leaves some out (D04.4-03/04/05
// LOCKED); a participant already expected in another exam at an overlapping time blocks the
// scheduling (D04.2-37/38/39 LOCKED).

export interface TeacherImportActor {
    tenantId: string;
    personId: string;
}

/** Implementation limits (plan §7). */
export const MAX_QUESTION_FILE_CHARS = 512 * 1024;
export const MAX_DURATION_MINUTES = 24 * 60;
export const MAX_PARTICIPANT_CHOICES = 2000;

export interface TeacherExamSetup {
    /** The school's time zone; exam times are entered and shown in it (D04.2-36). */
    timeZone: string | null;
    teachingAssignments: Array<{ teachingAssignmentId: string; subjectLabel: string; groupLabel: string; periodLabel: string }>;
    assessmentTypes: Array<{ assessmentTypeId: string; label: string }>;
    limits: { maxQuestions: number; maxQuestionScore: number; maxFileCharacters: number; maxDurationMinutes: number };
}

export type SetupProblemCode =
    | 'file_too_large'
    | 'time_zone_missing'
    | 'window_invalid'
    | 'window_order'
    | 'window_ended'
    | 'duration_invalid'
    | 'duration_exceeds_window'
    | 'assessment_type_unknown'
    | 'participant_not_enrolled'
    | 'no_participants'
    | 'schedule_conflict'
    | 'not_ready';

export type ImportProblem =
    | ({ source: 'file' } & QuestionProblem)
    | { source: 'setup'; code: SetupProblemCode; count?: number; blocker?: string };

export interface PreviewQuestion {
    line: number;
    no: number;
    prompt: string;
    options: string[];
    correct: string;
    score: number;
}

export interface PreviewParticipant {
    enrollmentId: string;
    elligbleId: string;
    included: boolean;
    /** Already expected in another exam at an overlapping time. */
    conflict: boolean;
}

export interface TeacherExamImportPreview {
    sourceSha256: string;
    problems: ImportProblem[];
    questions: PreviewQuestion[];
    participants: PreviewParticipant[];
    window: { startsAt: string; endsAt: string } | null;
    totals: { questions: number; maxScore: number; participants: number };
}

export interface TeacherExamImportRequest {
    teachingAssignmentId: string;
    assessmentTypeId: string;
    /** Wall-clock date and time in the school's zone, `YYYY-MM-DDTHH:MM`. */
    windowStartsAt: string;
    windowEndsAt: string;
    durationMinutes: number;
    latestStartPolicy: LatestStartPolicy;
    questionsCsv: string;
    sourceFileName: string | null;
    /** The students taking part; null means everyone enrolled on the exam day. */
    participantEnrollmentIds: string[] | null;
    /** Confirmation only. */
    importKey?: string;
    expectedSha256?: string;
}

export type TeacherExamImportOutcome =
    | { type: 'preview'; preview: TeacherExamImportPreview }
    | { type: 'invalid'; preview: TeacherExamImportPreview }
    | { type: 'scheduled'; examInstanceId: string; replayed: boolean; questionCount: number; participantCount: number }
    | { type: 'content_changed' }
    | { type: 'import_key_reused' }
    | { type: 'forbidden' }
    | { type: 'unavailable' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Wall-clock date and time in the school's zone, as the teacher enters it. */
export const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;
const SCHEDULING_STATES = ['SCHEDULED', 'READY', 'ACTIVE', 'PAUSED'];

export function sha256Hex(text: string): string {
    return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** A `YYYY-MM-DDTHH:MM` value naming a real calendar date and time. */
export function isRealLocalDateTime(value: string): boolean {
    const m = LOCAL_DATE_TIME.exec(value);
    if (!m) return false;
    const [y, mo, d, h, mi] = m.slice(1).map(Number);
    const date = new Date(Date.UTC(y, mo - 1, d, h, mi));
    return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d && h < 24 && mi < 60;
}

/** Only the file's own name, without folders or control characters, at most 255 characters. */
function cleanFileName(value: unknown): string | null | undefined {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string') return undefined;
    const name = value.split(/[\\/]/).pop()!.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 255);
    return name.length > 0 ? name : null;
}

/** The request body as the import expects it, or null when it is malformed (400). */
export function parseTeacherExamImportRequest(body: Record<string, unknown>, confirm: boolean): TeacherExamImportRequest | null {
    const { teachingAssignmentId, assessmentTypeId, windowStartsAt, windowEndsAt, durationMinutes, latestStartPolicy, questionsCsv } = body;
    if (typeof teachingAssignmentId !== 'string' || !UUID.test(teachingAssignmentId)) return null;
    if (typeof assessmentTypeId !== 'string' || !UUID.test(assessmentTypeId)) return null;
    if (typeof windowStartsAt !== 'string' || !LOCAL_DATE_TIME.test(windowStartsAt)) return null;
    if (typeof windowEndsAt !== 'string' || !LOCAL_DATE_TIME.test(windowEndsAt)) return null;
    if (typeof durationMinutes !== 'number' || !Number.isFinite(durationMinutes)) return null;
    if (typeof latestStartPolicy !== 'string' || !LATEST_START_POLICIES.includes(latestStartPolicy as LatestStartPolicy)) return null;
    if (typeof questionsCsv !== 'string') return null;
    const sourceFileName = cleanFileName(body['sourceFileName']);
    if (sourceFileName === undefined) return null;
    const chosen = body['participantEnrollmentIds'];
    let participantEnrollmentIds: string[] | null = null;
    if (chosen !== undefined && chosen !== null) {
        if (!Array.isArray(chosen) || chosen.length > MAX_PARTICIPANT_CHOICES) return null;
        if (!chosen.every(id => typeof id === 'string' && UUID.test(id))) return null;
        const ids = (chosen as string[]).map(id => id.toLowerCase());
        if (new Set(ids).size !== ids.length) return null;
        participantEnrollmentIds = ids;
    }
    const request: TeacherExamImportRequest = {
        teachingAssignmentId: teachingAssignmentId.toLowerCase(),
        assessmentTypeId: assessmentTypeId.toLowerCase(),
        windowStartsAt,
        windowEndsAt,
        durationMinutes,
        latestStartPolicy: latestStartPolicy as LatestStartPolicy,
        questionsCsv,
        sourceFileName,
        participantEnrollmentIds,
    };
    if (confirm) {
        const { importKey, expectedSha256 } = body;
        if (typeof importKey !== 'string' || !UUID.test(importKey)) return null;
        if (typeof expectedSha256 !== 'string' || !SHA256_HEX.test(expectedSha256)) return null;
        request.importKey = importKey.toLowerCase();
        request.expectedSha256 = expectedSha256;
    }
    return request;
}

function isoOf(value: unknown): string {
    return (value instanceof Date ? value : new Date(String(value))).toISOString();
}

export async function readTeacherExamSetup(
    pool: pg.Pool,
    actor: TeacherImportActor
): Promise<{ type: 'ok'; setup: TeacherExamSetup } | { type: 'forbidden' } | { type: 'unavailable' }> {
    if (!UUID.test(actor.tenantId) || !UUID.test(actor.personId)) return { type: 'forbidden' };
    try {
        const assignments = await pool.query(
            `SELECT ata.id, s.display_label AS subject_label, g.display_label AS group_label, p.display_label AS period_label
             FROM tenant_memberships tm
             JOIN tenant_teacher_assignments tta
               ON tta.membership_id = tm.id AND tta.tenant_id = tm.tenant_id AND tta.revoked_at IS NULL
             JOIN academic_core_teaching_assignments ata
               ON ata.teacher_assignment_id = tta.id AND ata.tenant_id = tta.tenant_id AND ata.revoked_at IS NULL
             JOIN academic_core_subject_offerings o ON o.id = ata.subject_offering_id AND o.tenant_id = ata.tenant_id
             JOIN academic_core_subjects s ON s.id = o.subject_id AND s.tenant_id = o.tenant_id
             JOIN academic_core_academic_periods p ON p.id = o.academic_period_id AND p.tenant_id = o.tenant_id
             JOIN academic_core_academic_groups g ON g.id = ata.academic_group_id AND g.tenant_id = ata.tenant_id
             WHERE tm.tenant_id = $1 AND tm.person_id = $2
             ORDER BY p.start_date DESC, s.display_label, g.display_label, ata.id`,
            [actor.tenantId, actor.personId]
        );
        if ((assignments.rowCount ?? 0) === 0) return { type: 'forbidden' };
        const types = await pool.query(
            'SELECT id, display_label FROM secure_assessment_assessment_types WHERE tenant_id = $1 ORDER BY display_label, id',
            [actor.tenantId]
        );
        const tenant = await pool.query('SELECT time_zone FROM tenant_tenants WHERE id = $1', [actor.tenantId]);
        return {
            type: 'ok',
            setup: {
                timeZone: tenant.rows[0]?.time_zone ?? null,
                teachingAssignments: assignments.rows.map(r => ({
                    teachingAssignmentId: r.id, subjectLabel: r.subject_label, groupLabel: r.group_label, periodLabel: r.period_label,
                })),
                assessmentTypes: types.rows.map(r => ({ assessmentTypeId: r.id, label: r.display_label })),
                limits: {
                    maxQuestions: MAX_IMPORT_QUESTIONS,
                    maxQuestionScore: MAX_QUESTION_SCORE,
                    maxFileCharacters: MAX_QUESTION_FILE_CHARS,
                    maxDurationMinutes: MAX_DURATION_MINUTES,
                },
            },
        };
    } catch {
        return { type: 'unavailable' };
    }
}

function readinessProblem(readiness: Awaited<ReturnType<typeof evaluateExamReadiness>>): ImportProblem | null {
    if (readiness.ready) return null;
    const blocker = readiness.baseline.status === 'not_ready'
        ? (readiness.baseline as { blocker?: string }).blocker ?? readiness.baseline.status
        : (readiness.roomProctor as { blocker?: string }).blocker ?? readiness.roomProctor.status;
    switch (blocker) {
        case 'attempt_duration_exceeds_window': return { source: 'setup', code: 'duration_exceeds_window' };
        case 'participant_schedule_conflict': return { source: 'setup', code: 'schedule_conflict' };
        default: return { source: 'setup', code: 'not_ready', blocker };
    }
}

export async function runTeacherExamImport(
    pool: pg.Pool,
    actor: TeacherImportActor,
    request: TeacherExamImportRequest,
    mode: 'preview' | 'confirm'
): Promise<TeacherExamImportOutcome> {
    if (!UUID.test(actor.tenantId) || !UUID.test(actor.personId)) return { type: 'forbidden' };
    const sourceSha256 = sha256Hex(request.questionsCsv);
    if (mode === 'confirm' && request.expectedSha256 !== sourceSha256) return { type: 'content_changed' };

    const problems: ImportProblem[] = [];
    let parsed: ReturnType<typeof parseQuestionFile> = { questions: [], problems: [] };
    if (request.questionsCsv.length > MAX_QUESTION_FILE_CHARS) {
        problems.push({ source: 'setup', code: 'file_too_large' });
    } else {
        parsed = parseQuestionFile(request.questionsCsv);
        problems.push(...parsed.problems.map(p => ({ source: 'file' as const, ...p })));
    }
    const localWindowValid = isRealLocalDateTime(request.windowStartsAt) && isRealLocalDateTime(request.windowEndsAt);
    if (!localWindowValid) problems.push({ source: 'setup', code: 'window_invalid' });
    const durationValid = Number.isInteger(request.durationMinutes) && request.durationMinutes >= 1 && request.durationMinutes <= MAX_DURATION_MINUTES;
    if (!durationValid) problems.push({ source: 'setup', code: 'duration_invalid' });

    const preview: TeacherExamImportPreview = {
        sourceSha256,
        problems,
        questions: parsed.questions.map(q => ({
            line: q.line, no: q.no, prompt: q.prompt, options: q.options, correct: OPTION_LETTERS[q.correctIndex], score: q.maxScore,
        })),
        participants: [],
        window: null,
        totals: {
            questions: parsed.questions.length,
            maxScore: parsed.questions.reduce((sum, q) => sum + Math.round(q.maxScore * 100), 0) / 100,
            participants: 0,
        },
    };

    let client: pg.PoolClient;
    try {
        client = await pool.connect();
    } catch {
        return { type: 'unavailable' };
    }
    try {
        await client.query('BEGIN');
        if (mode === 'confirm') {
            await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`sa-question-import:${actor.tenantId}:${actor.personId}:${request.importKey}`]);
            const earlier = await client.query(
                `SELECT b.exam_instance_id, b.source_sha256, b.question_count,
                        (SELECT count(*)::int FROM secure_assessment_exam_participants p
                         WHERE p.tenant_id = b.tenant_id AND p.exam_instance_id = b.exam_instance_id) AS participants
                 FROM secure_assessment_question_import_batches b
                 WHERE b.tenant_id = $1 AND b.imported_by_person_id = $2 AND b.import_key = $3`,
                [actor.tenantId, actor.personId, request.importKey]
            );
            if ((earlier.rowCount ?? 0) > 0) {
                await client.query('ROLLBACK');
                const row = earlier.rows[0];
                if (row.source_sha256 !== sourceSha256) return { type: 'import_key_reused' };
                return { type: 'scheduled', examInstanceId: row.exam_instance_id, replayed: true, questionCount: row.question_count, participantCount: row.participants };
            }
        }

        // The teaching assignment must be the actor's own and active; it stays so until the end.
        const teaching = await client.query(
            `SELECT ata.id, ata.academic_group_id, o.academic_period_id
             FROM academic_core_teaching_assignments ata
             JOIN tenant_teacher_assignments tta
               ON tta.id = ata.teacher_assignment_id AND tta.tenant_id = ata.tenant_id AND tta.revoked_at IS NULL
             JOIN tenant_memberships tm ON tm.id = tta.membership_id AND tm.tenant_id = tta.tenant_id
             JOIN academic_core_subject_offerings o ON o.id = ata.subject_offering_id AND o.tenant_id = ata.tenant_id
             WHERE ata.id = $1 AND ata.tenant_id = $2 AND ata.revoked_at IS NULL AND tm.person_id = $3
             FOR SHARE OF ata, tta`,
            [request.teachingAssignmentId, actor.tenantId, actor.personId]
        );
        if (teaching.rowCount !== 1) {
            await client.query('ROLLBACK');
            return { type: 'forbidden' };
        }
        const { academic_group_id: groupId, academic_period_id: periodId } = teaching.rows[0];

        const tenant = await client.query('SELECT time_zone FROM tenant_tenants WHERE id = $1', [actor.tenantId]);
        const timeZone: string | null = tenant.rows[0]?.time_zone ?? null;
        if (!timeZone) problems.push({ source: 'setup', code: 'time_zone_missing' });

        let startsAt: Date | null = null;
        let endsAt: Date | null = null;
        if (timeZone && localWindowValid) {
            const window = await client.query(
                `SELECT ($1::timestamp AT TIME ZONE $3) AS starts_at, ($2::timestamp AT TIME ZONE $3) AS ends_at, statement_timestamp() AS db_now`,
                [request.windowStartsAt, request.windowEndsAt, timeZone]
            );
            startsAt = window.rows[0].starts_at;
            endsAt = window.rows[0].ends_at;
            preview.window = { startsAt: isoOf(startsAt), endsAt: isoOf(endsAt) };
            if (!(endsAt!.getTime() > startsAt!.getTime())) problems.push({ source: 'setup', code: 'window_order' });
            else if (!(endsAt!.getTime() > new Date(window.rows[0].db_now).getTime())) problems.push({ source: 'setup', code: 'window_ended' });
        }

        const type = await client.query(
            'SELECT 1 FROM secure_assessment_assessment_types WHERE id = $1 AND tenant_id = $2',
            [request.assessmentTypeId, actor.tenantId]
        );
        if (type.rowCount !== 1) problems.push({ source: 'setup', code: 'assessment_type_unknown' });

        // Participants: the class on the exam day (the school-zone date of the start).
        const enrolled = localWindowValid
            ? await listEnrolledStudents(client, actor.tenantId, { groupId, periodId, examDay: request.windowStartsAt.slice(0, 10) })
            : [];
        const chosen = request.participantEnrollmentIds === null ? null : new Set(request.participantEnrollmentIds);
        if (chosen) {
            const known = new Set(enrolled.map(s => s.enrollmentId));
            const unknown = [...chosen].filter(id => !known.has(id)).length;
            if (unknown > 0) problems.push({ source: 'setup', code: 'participant_not_enrolled', count: unknown });
        }
        const included = enrolled.filter(s => chosen === null || chosen.has(s.enrollmentId));
        if (localWindowValid && included.length === 0) problems.push({ source: 'setup', code: 'no_participants' });

        const conflicting = new Set<string>();
        if (startsAt && endsAt && endsAt.getTime() > startsAt.getTime() && included.length > 0) {
            const overlap = await client.query(
                `SELECT DISTINCT p.person_id
                 FROM secure_assessment_exam_participants p
                 JOIN secure_assessment_exam_instances i ON i.id = p.exam_instance_id AND i.tenant_id = p.tenant_id
                 WHERE p.tenant_id = $1 AND p.person_id = ANY($2::uuid[])
                   AND i.lifecycle_state = ANY($3::text[])
                   AND i.window_starts_at < $5 AND i.window_ends_at > $4`,
                [actor.tenantId, enrolled.map(s => s.personId), SCHEDULING_STATES, startsAt, endsAt]
            );
            for (const row of overlap.rows) conflicting.add(row.person_id);
            const blocked = included.filter(s => conflicting.has(s.personId)).length;
            if (blocked > 0) problems.push({ source: 'setup', code: 'schedule_conflict', count: blocked });
        }
        preview.participants = enrolled.map(s => ({
            enrollmentId: s.enrollmentId,
            elligbleId: s.elligbleId,
            included: chosen === null || chosen.has(s.enrollmentId),
            conflict: conflicting.has(s.personId),
        }));
        preview.totals.participants = included.length;

        let examInstanceId: string | null = null;
        if (problems.length === 0) {
            const created = await provisionScheduledExam(client, actor.tenantId, {
                teachingAssignmentId: request.teachingAssignmentId,
                assessmentTypeId: request.assessmentTypeId,
                windowStartsAt: startsAt!,
                windowEndsAt: endsAt!,
                durationSeconds: request.durationMinutes * 60,
                latestStartPolicy: request.latestStartPolicy,
                questions: parsed.questions.map(q => buildBaselineFrozenContent({
                    prompt: q.prompt, options: q.options, correctIndex: q.correctIndex, maxScore: q.maxScore,
                })),
                participants: included.map(s => ({ personId: s.personId, academicEnrollmentId: s.enrollmentId })),
                proctorPersonIds: [],
                importBatch: {
                    importedByPersonId: actor.personId,
                    importKey: request.importKey ?? randomUUID(),
                    sourceFileName: request.sourceFileName,
                    sourceSha256,
                    sourceLines: parsed.questions.map(q => q.line),
                },
            }, actor.personId);
            examInstanceId = created.examInstanceId;
            const blocked = readinessProblem(await evaluateExamReadiness(client, actor.tenantId, examInstanceId));
            if (blocked) problems.push(blocked);
        }

        if (mode === 'preview' || problems.length > 0 || !examInstanceId) {
            await client.query('ROLLBACK');
            return mode === 'preview' ? { type: 'preview', preview } : { type: 'invalid', preview };
        }
        await client.query('COMMIT');
        return { type: 'scheduled', examInstanceId, replayed: false, questionCount: parsed.questions.length, participantCount: included.length };
    } catch {
        await client.query('ROLLBACK').catch(() => {});
        return { type: 'unavailable' };
    } finally {
        client.release();
    }
}
