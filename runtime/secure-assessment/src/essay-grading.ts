import type * as pg from 'pg';
import { listElligbleIds } from '../../identity-access/src/directory.ts';
import { AuthenticationError } from './http/authenticated-context.ts';
import { lockManagedExam, readManagedExam } from './managed-exam.ts';
import { classifyFrozenContent } from './question-contract.ts';
import { ESSAY_KEY, essayTextOf } from './question-types/essay.ts';
import { SHORT_ANSWER_KEY, isManualShortAnswer, shortTextOf } from './question-types/short-answer.ts';

// Essay grading by the managing Teacher (ASSESS-QUESTION-008 §4.2/§4.3; Owner O02-9/O02-10,
// A01-3, E1-E3). One grader: the person holding the exam's active teaching assignment
// (managed-exam.ts). Grades are append-only revisions; the current grade is the highest
// revision. Grading is open while the exam is ACTIVE, PAUSED or ENDED; once FINALIZED the
// results are immutable (O02-10) and the worklist is read-only.
//
// Population (shared with results and finalization): the first attempt of each participant,
// when it is submitted, ordered by ELLIGBLE ID (D04.8-51). Only non-empty essays are listed
// and gradable.
//
// The grade write locks the exam FOR KEY SHARE, which conflicts with finalization's FOR
// UPDATE: a grade either commits before finalization locks the exam, or waits and then sees
// FINALIZED. A per-answer advisory lock (tenant, attempt, snapshot) serializes revisions, and
// the expected revision makes a stale form an explicit refusal.
//
// RESULT-004 E7 (D04.4-26D, LOCKED; Owner RS-2): the worklist of a running institution exam would
// show, per ELLIGBLE ID, who has submitted and their answers as they arrive, which is whole-exam
// monitoring its subject Teacher does not hold. The worklist and the grade write of an institution
// exam therefore open only once it has ended; teacher-managed exams keep ACTIVE, PAUSED and ENDED.

const MICRO = 1_000_000n;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Same as the import score format (question-import.ts SCORE_FORMAT). */
const SCORE_FORMAT = /^\d{1,4}([.,]\d{1,2})?$/;
const GRADING_STATES = new Set(['ACTIVE', 'PAUSED', 'ENDED']);
const READABLE_STATES = new Set(['ACTIVE', 'PAUSED', 'ENDED', 'FINALIZED']);

const RUNNING_STATES = new Set(['ACTIVE', 'PAUSED']);

/**
 * RESULT-004 E6/E7: an institution exam (one with a session) that is ACTIVE or PAUSED. Its results,
 * export, worklist and grade write are refused to its subject Teacher with institution_exam_running.
 */
export function isRunningInstitutionExam(institutionSessionId: string | null | undefined, lifecycleState: string): boolean {
    return typeof institutionSessionId === 'string' && institutionSessionId.length > 0 && RUNNING_STATES.has(lifecycleState);
}

export interface CurrentGrade {
    scoreMicro: bigint;
    revision: number;
}

/** Micro-points as a decimal string with "." and no trailing zeros ("3.5", "4"). */
export function microToDecimal(micro: bigint): string {
    const int = micro / MICRO;
    const frac = (micro % MICRO).toString().padStart(6, '0').replace(/0+$/, '');
    return frac ? `${int}.${frac}` : `${int}`;
}

/** A score as typed ("3,5", "3.5", "4") in micro-points, or null when it is not in SCORE_FORMAT. */
export function parseGradeScore(text: string): bigint | null {
    if (!SCORE_FORMAT.test(text)) return null;
    const [int, frac = ''] = text.replace(',', '.').split('.');
    return BigInt(int) * MICRO + BigInt(frac.padEnd(6, '0'));
}

const maxMicroOf = (content: Record<string, unknown>): bigint => BigInt(Math.round(Number(content['maxScore']) * 1_000_000));

export type TeacherGradedType = 'ESSAY' | 'SHORT_ANSWER';

/**
 * A question graded by the teacher (ASSESS-QUESTION-006 §4.2): a valid essay, or a valid short
 * answer without accepted forms (manual mode, D1). Null for every other question.
 */
export function teacherGradedContentOf(frozen: unknown): { content: Record<string, unknown>; questionType: TeacherGradedType } | null {
    const kind = classifyFrozenContent(frozen);
    if (kind.kind !== 'registered' || !kind.descriptor.validateContent(kind.content).ok) return null;
    if (kind.key === ESSAY_KEY) return { content: kind.content, questionType: 'ESSAY' };
    if (kind.key === SHORT_ANSWER_KEY && isManualShortAnswer(kind.content)) return { content: kind.content, questionType: 'SHORT_ANSWER' };
    return null;
}

/** Whether a frozen question is graded by the teacher (the results' and readiness "essayCount", E5). */
export function isTeacherGradedQuestion(frozen: unknown): boolean {
    return teacherGradedContentOf(frozen) !== null;
}

/** The non-empty valid answer text of a question graded by the teacher, by its type, or null. */
export function teacherGradedTextOf(questionType: TeacherGradedType, payload: unknown): string | null {
    return questionType === 'ESSAY' ? essayTextOf(payload) : shortTextOf(payload);
}

/** The current grade of every graded answer of the given attempts: attempt id -> snapshot id -> grade. */
export async function readCurrentGrades(client: pg.ClientBase, tenantId: string, attemptIds: readonly string[]): Promise<Map<string, Map<string, CurrentGrade>>> {
    const grades = new Map<string, Map<string, CurrentGrade>>();
    if (attemptIds.length === 0) return grades;
    const rows = await client.query(
        `SELECT DISTINCT ON (exam_attempt_id, exam_question_snapshot_id) exam_attempt_id, exam_question_snapshot_id, revision, score_micro
         FROM secure_assessment_essay_grade_revisions
         WHERE tenant_id = $1 AND exam_attempt_id = ANY($2::uuid[])
         ORDER BY exam_attempt_id, exam_question_snapshot_id, revision DESC`,
        [tenantId, attemptIds]
    );
    for (const row of rows.rows) {
        let byQuestion = grades.get(row.exam_attempt_id);
        if (!byQuestion) grades.set(row.exam_attempt_id, (byQuestion = new Map()));
        byQuestion.set(row.exam_question_snapshot_id, { scoreMicro: BigInt(row.score_micro), revision: Number(row.revision) });
    }
    return grades;
}

/** snapshot id -> score micro-points, as scoreAttempt takes it. */
export function gradeScores(grades: ReadonlyMap<string, CurrentGrade> | undefined): Map<string, bigint> {
    return new Map([...(grades ?? new Map<string, CurrentGrade>())].map(([id, grade]) => [id, grade.scoreMicro]));
}

export interface EssayGradeEntry {
    score: string;
    revision: number;
    gradedAt: string;
}

export interface EssayWorklist {
    exam: { examInstanceId: string; lifecycleState: string };
    questions: Array<{
        snapshotId: string;
        no: number;
        /** ASSESS-QUESTION-006: essays and manual short answers share this workflow (E5). */
        questionType: TeacherGradedType;
        prompt: unknown;
        rubric: string;
        maxScore: string;
        answers: Array<{ attemptId: string; elligbleId: string | null; essayText: string; grade: EssayGradeEntry | null; history: EssayGradeEntry[] }>;
    }>;
}

export type EssayWorklistOutcome =
    | { type: 'ok'; worklist: EssayWorklist }
    | { type: 'forbidden' }
    | { type: 'institution_exam_running'; currentState: string }
    | { type: 'invalid_state'; currentState: string }
    | { type: 'unavailable' };

const FIRST_SUBMITTED_ATTEMPTS = `
    SELECT p.person_id, a.id AS attempt_id
    FROM secure_assessment_exam_participants p
    JOIN LATERAL (
        SELECT att.id FROM secure_assessment_exam_attempts att
        WHERE att.tenant_id = p.tenant_id AND att.exam_participant_id = p.id
        ORDER BY att.created_at ASC, att.id ASC
        LIMIT 1
    ) a ON TRUE
    WHERE p.tenant_id = $1 AND p.exam_instance_id = $2
      AND EXISTS (SELECT 1 FROM secure_assessment_exam_submissions s WHERE s.tenant_id = p.tenant_id AND s.exam_attempt_id = a.id)`;

function compareIds(a: string | null, b: string | null): number {
    if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
    return a < b ? -1 : a > b ? 1 : 0;
}

export async function readEssayWorklist(pool: pg.Pool, actor: { tenantId: string; personId: string }, examInstanceId: string): Promise<EssayWorklistOutcome> {
    if (!UUID_REGEX.test(examInstanceId) || !UUID_REGEX.test(actor.tenantId) || !UUID_REGEX.test(actor.personId)) return { type: 'forbidden' };
    let client: pg.PoolClient;
    try { client = await pool.connect(); } catch { return { type: 'unavailable' }; }
    try {
        await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const exam = await readManagedExam(client, actor, examInstanceId);
        if (!exam) { await client.query('ROLLBACK'); return { type: 'forbidden' }; }
        if (isRunningInstitutionExam(exam.institution_session_id, exam.lifecycle_state)) {
            await client.query('ROLLBACK');
            return { type: 'institution_exam_running', currentState: exam.lifecycle_state };
        }
        if (!READABLE_STATES.has(exam.lifecycle_state)) { await client.query('ROLLBACK'); return { type: 'invalid_state', currentState: exam.lifecycle_state }; }
        const snapshots = await client.query(
            `SELECT id, frozen_content FROM secure_assessment_exam_question_snapshots
             WHERE tenant_id = $1 AND exam_instance_id = $2 ORDER BY display_order ASC NULLS LAST, id ASC`,
            [actor.tenantId, examInstanceId]
        );
        const essays = snapshots.rows
            .map((row, index) => ({ id: row.id as string, no: index + 1, graded: teacherGradedContentOf(row.frozen_content) }))
            .filter((q): q is { id: string; no: number; graded: NonNullable<ReturnType<typeof teacherGradedContentOf>> } => q.graded !== null)
            .map(q => ({ id: q.id, no: q.no, content: q.graded.content, questionType: q.graded.questionType }));
        const population = essays.length > 0 ? (await client.query(FIRST_SUBMITTED_ATTEMPTS, [actor.tenantId, examInstanceId])).rows : [];
        const attemptIds = population.map(row => row.attempt_id as string);
        const answers = attemptIds.length > 0 ? (await client.query(
            `SELECT exam_attempt_id, exam_question_snapshot_id, answer_payload FROM secure_assessment_exam_answers
             WHERE tenant_id = $1 AND exam_attempt_id = ANY($2::uuid[]) AND exam_question_snapshot_id = ANY($3::uuid[])`,
            [actor.tenantId, attemptIds, essays.map(q => q.id)]
        )).rows : [];
        const revisions = attemptIds.length > 0 ? (await client.query(
            `SELECT exam_attempt_id, exam_question_snapshot_id, revision, score_micro, graded_at
             FROM secure_assessment_essay_grade_revisions
             WHERE tenant_id = $1 AND exam_attempt_id = ANY($2::uuid[]) ORDER BY revision ASC`,
            [actor.tenantId, attemptIds]
        )).rows : [];
        const ids = await listElligbleIds(client, population.map(row => row.person_id as string));
        await client.query('COMMIT');

        const personOf = new Map(population.map(row => [row.attempt_id as string, row.person_id as string]));
        const answerOf = new Map(answers.map(row => [`${row.exam_attempt_id}:${row.exam_question_snapshot_id}`, row.answer_payload]));
        const historyOf = new Map<string, EssayGradeEntry[]>();
        for (const row of revisions) {
            const key = `${row.exam_attempt_id}:${row.exam_question_snapshot_id}`;
            const list = historyOf.get(key) ?? [];
            list.push({ score: microToDecimal(BigInt(row.score_micro)), revision: Number(row.revision), gradedAt: new Date(row.graded_at).toISOString() });
            historyOf.set(key, list);
        }
        return {
            type: 'ok',
            worklist: {
                exam: { examInstanceId, lifecycleState: exam.lifecycle_state },
                questions: essays.map(q => ({
                    snapshotId: q.id,
                    no: q.no,
                    questionType: q.questionType,
                    prompt: q.content['prompt'],
                    rubric: q.content['rubric'] as string,
                    maxScore: microToDecimal(maxMicroOf(q.content)),
                    answers: attemptIds
                        .map(attemptId => {
                            const essayText = teacherGradedTextOf(q.questionType, answerOf.get(`${attemptId}:${q.id}`));
                            if (essayText === null) return null;
                            const history = historyOf.get(`${attemptId}:${q.id}`) ?? [];
                            return { attemptId, elligbleId: ids.get(personOf.get(attemptId)!) ?? null, essayText, grade: history.at(-1) ?? null, history };
                        })
                        .filter((a): a is NonNullable<typeof a> => a !== null)
                        .sort((a, b) => compareIds(a.elligbleId, b.elligbleId)),
                })),
            },
        };
    } catch {
        await client.query('ROLLBACK').catch(() => {});
        return { type: 'unavailable' };
    } finally {
        client.release();
    }
}

export interface GradeEssayRequest {
    examInstanceId: string;
    attemptId: string;
    snapshotId: string;
    score: string;
    expectedRevision: number | null;
}

export type GradeEssayOutcome =
    | { type: 'ok'; revision: number; score: string; gradedAt: string }
    | { type: 'forbidden' }
    | { type: 'institution_exam_running'; currentState: string }
    | { type: 'invalid_state'; currentState: string }
    | { type: 'not_gradable' }
    | { type: 'invalid_score' }
    | { type: 'stale_grade'; current: number | null }
    | { type: 'unavailable' };

const GRADE_KEYS = ['attemptId', 'examInstanceId', 'expectedRevision', 'score', 'snapshotId'];

/** The exact grade body (§4.3), or null for 400 invalid_request. */
export function parseGradeRequest(body: Record<string, unknown>): GradeEssayRequest | null {
    const keys = Object.keys(body).sort();
    if (keys.length !== GRADE_KEYS.length || keys.some((key, i) => key !== GRADE_KEYS[i])) return null;
    const { examInstanceId, attemptId, snapshotId, score, expectedRevision } = body;
    if (typeof examInstanceId !== 'string' || !UUID_REGEX.test(examInstanceId)) return null;
    if (typeof attemptId !== 'string' || !UUID_REGEX.test(attemptId)) return null;
    if (typeof snapshotId !== 'string' || !UUID_REGEX.test(snapshotId)) return null;
    if (typeof score !== 'string') return null;
    if (expectedRevision !== null && (typeof expectedRevision !== 'number' || !Number.isSafeInteger(expectedRevision) || expectedRevision < 1)) return null;
    return { examInstanceId, attemptId, snapshotId, score, expectedRevision: expectedRevision as number | null };
}

/**
 * Records a new grade revision. `reauthenticate` re-checks the session as a mutation inside the
 * transaction and returns false when it no longer belongs to the actor; it may throw the
 * authentication error, which the caller maps.
 */
export async function gradeEssay(
    pool: pg.Pool,
    actor: { tenantId: string; personId: string },
    request: GradeEssayRequest,
    reauthenticate: (client: pg.PoolClient) => Promise<boolean>
): Promise<GradeEssayOutcome> {
    let client: pg.PoolClient;
    try { client = await pool.connect(); } catch { return { type: 'unavailable' }; }
    const refuse = async <T extends GradeEssayOutcome>(outcome: T): Promise<T> => { await client.query('ROLLBACK'); return outcome; };
    try {
        await client.query('BEGIN');
        if (!(await reauthenticate(client))) return await refuse({ type: 'forbidden' });
        const exam = await lockManagedExam(client, actor, request.examInstanceId, true);
        if (!exam) return await refuse({ type: 'forbidden' });
        // E7: the exam row is held FOR KEY SHARE, so END cannot commit between this check and the write.
        if (isRunningInstitutionExam(exam.institution_session_id, exam.lifecycle_state)) {
            return await refuse({ type: 'institution_exam_running', currentState: exam.lifecycle_state });
        }
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`sa-essay-grade:${actor.tenantId}:${request.attemptId}:${request.snapshotId}`]);
        if (!(await reauthenticate(client))) return await refuse({ type: 'forbidden' });

        if (!GRADING_STATES.has(exam.lifecycle_state)) return await refuse({ type: 'invalid_state', currentState: exam.lifecycle_state });
        const attempt = await client.query(
            `SELECT a.id FROM secure_assessment_exam_attempts a
             JOIN secure_assessment_exam_participants p ON p.id = a.exam_participant_id AND p.tenant_id = a.tenant_id
             WHERE a.tenant_id = $1 AND a.id = $2 AND p.exam_instance_id = $3
               AND a.id = (SELECT att.id FROM secure_assessment_exam_attempts att
                           WHERE att.tenant_id = a.tenant_id AND att.exam_participant_id = p.id
                           ORDER BY att.created_at ASC, att.id ASC LIMIT 1)
               AND EXISTS (SELECT 1 FROM secure_assessment_exam_submissions s WHERE s.tenant_id = a.tenant_id AND s.exam_attempt_id = a.id)`,
            [actor.tenantId, request.attemptId, request.examInstanceId]
        );
        if (attempt.rows.length !== 1) return await refuse({ type: 'not_gradable' });
        const snapshot = await client.query(
            'SELECT frozen_content FROM secure_assessment_exam_question_snapshots WHERE tenant_id = $1 AND id = $2 AND exam_instance_id = $3',
            [actor.tenantId, request.snapshotId, request.examInstanceId]
        );
        // An essay or a manual short answer; an auto-scored short answer is not gradable (§4.2).
        const graded = snapshot.rows.length === 1 ? teacherGradedContentOf(snapshot.rows[0].frozen_content) : null;
        if (!graded) return await refuse({ type: 'not_gradable' });
        const content = graded.content;
        const answer = await client.query(
            'SELECT answer_payload FROM secure_assessment_exam_answers WHERE tenant_id = $1 AND exam_attempt_id = $2 AND exam_question_snapshot_id = $3',
            [actor.tenantId, request.attemptId, request.snapshotId]
        );
        if (answer.rows.length !== 1 || teacherGradedTextOf(graded.questionType, answer.rows[0].answer_payload) === null) return await refuse({ type: 'not_gradable' });

        const scoreMicro = parseGradeScore(request.score);
        if (scoreMicro === null || scoreMicro > maxMicroOf(content)) return await refuse({ type: 'invalid_score' });

        const current = await client.query(
            `SELECT max(revision)::int AS revision FROM secure_assessment_essay_grade_revisions
             WHERE tenant_id = $1 AND exam_attempt_id = $2 AND exam_question_snapshot_id = $3`,
            [actor.tenantId, request.attemptId, request.snapshotId]
        );
        const currentRevision: number | null = current.rows[0].revision ?? null;
        if (currentRevision !== request.expectedRevision) return await refuse({ type: 'stale_grade', current: currentRevision });

        const inserted = await client.query(
            `INSERT INTO secure_assessment_essay_grade_revisions
                (tenant_id, exam_attempt_id, exam_question_snapshot_id, revision, score_micro, graded_by_person_id)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING revision, score_micro, graded_at`,
            [actor.tenantId, request.attemptId, request.snapshotId, (currentRevision ?? 0) + 1, scoreMicro.toString(), actor.personId]
        );
        if (!(await reauthenticate(client))) return await refuse({ type: 'forbidden' });
        await client.query('COMMIT');
        const row = inserted.rows[0];
        return { type: 'ok', revision: Number(row.revision), score: microToDecimal(BigInt(row.score_micro)), gradedAt: new Date(row.graded_at).toISOString() };
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        const code = error && typeof error === 'object' && 'code' in error ? (error as { code?: unknown }).code : undefined;
        if (code === '23505') {
            const current = await pool.query(
                `SELECT max(revision)::int AS revision FROM secure_assessment_essay_grade_revisions
                 WHERE tenant_id = $1 AND exam_attempt_id = $2 AND exam_question_snapshot_id = $3`,
                [actor.tenantId, request.attemptId, request.snapshotId]
            ).catch(() => null);
            return { type: 'stale_grade', current: current?.rows[0]?.revision ?? null };
        }
        if (error instanceof AuthenticationError) throw error;
        return { type: 'unavailable' };
    } finally {
        client.release();
    }
}
