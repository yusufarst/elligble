import type * as pg from 'pg';
import { listElligbleIds } from '../../identity-access/src/directory.ts';
import type { FinalizationSource } from './submission.ts';
import { BASELINE_SCORING_RULE, scoreBaselineAttempt, type ScorableQuestion } from './scoring.ts';
import { readFinalizedResults } from './result-finalization.ts';

// Provisional results of a teacher-managed exam for the teacher who manages it (D04.4-26A/C,
// D04.8). Scores are computed on read from the frozen snapshots and the answers the server
// accepted (deterministic, D04.8-56), only for finalized attempts: in-progress attempts
// have no score yet and participants who never started have none at all (absent is not
// zero, D04.4-12). Results are neither finalized nor published (D04.8-17/21): students do
// not see them. Participants are listed by ELLIGBLE ID, never ranked by score (D04.8-51).
// When a participant has more than one attempt, the original (first) attempt is shown.
// Once the exam is finalized (D04.8-17/20) the frozen results are shown instead, exactly
// as stored at finalization; a participant who did not work on it is ABSENT.

export type ParticipantResultStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'ABSENT';

export interface ParticipantScore {
    correct: number;
    incorrect: number;
    unanswered: number;
    rawScore: number;
    maxScore: number;
    scaledScore: number;
}

export interface ParticipantResult {
    elligbleId: string | null;
    status: ParticipantResultStatus;
    /** How the attempt was finalized; null while not submitted or for submissions before migration 0041. */
    finalizationSource: FinalizationSource | null;
    submittedAt: string | null;
    score: ParticipantScore | null;
}

export interface TeacherExamResults {
    exam: {
        examInstanceId: string;
        subjectLabel: string | null;
        groupLabel: string | null;
        assessmentTypeLabel: string | null;
        lifecycleState: string;
        windowStartsAt: string | null;
        windowEndsAt: string | null;
    };
    scoring: { rule: string; available: boolean; questionCount: number; maxScore: number | null };
    resultState: 'PROVISIONAL' | 'FINAL';
    /** When the results were finalized (FINAL only). */
    finalizedAt: string | null;
    summary: { participants: number; notStarted: number; inProgress: number; submitted: number };
    participants: ParticipantResult[];
}

export type TeacherExamResultsOutcome =
    | { type: 'ok'; results: TeacherExamResults }
    | { type: 'forbidden' }
    | { type: 'unavailable' };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isoOrNull(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Rows follow the ELLIGBLE ID, never the score (D04.8-51). */
function sortByElligbleId(list: ParticipantResult[]): void {
    list.sort((a, b) => {
        if (a.elligbleId === null || b.elligbleId === null) return a.elligbleId === b.elligbleId ? 0 : a.elligbleId === null ? 1 : -1;
        return a.elligbleId < b.elligbleId ? -1 : a.elligbleId > b.elligbleId ? 1 : 0;
    });
}

export async function readTeacherExamResults(
    pool: pg.Pool,
    actor: { tenantId: string; personId: string },
    examInstanceId: string
): Promise<TeacherExamResultsOutcome> {
    if (!UUID_REGEX.test(examInstanceId) || !UUID_REGEX.test(actor.tenantId) || !UUID_REGEX.test(actor.personId)) {
        return { type: 'forbidden' };
    }
    let client: pg.PoolClient;
    try {
        client = await pool.connect();
    } catch {
        return { type: 'unavailable' };
    }
    try {
        await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const exam = await client.query(
            `SELECT i.id, i.lifecycle_state, i.window_starts_at, i.window_ends_at,
                    s.display_label AS subject_label, g.display_label AS group_label, at.display_label AS assessment_type_label
             FROM secure_assessment_exam_instances i
             JOIN academic_core_teaching_assignments ata
               ON ata.id = i.teaching_assignment_id AND ata.tenant_id = i.tenant_id AND ata.revoked_at IS NULL
             JOIN tenant_teacher_assignments tta
               ON tta.id = ata.teacher_assignment_id AND tta.tenant_id = ata.tenant_id AND tta.revoked_at IS NULL
             JOIN tenant_memberships tm
               ON tm.id = tta.membership_id AND tm.tenant_id = tta.tenant_id AND tm.person_id = $3
             LEFT JOIN academic_core_subject_offerings so ON so.id = ata.subject_offering_id AND so.tenant_id = ata.tenant_id
             LEFT JOIN academic_core_subjects s ON s.id = so.subject_id AND s.tenant_id = so.tenant_id
             LEFT JOIN academic_core_academic_groups g ON g.id = ata.academic_group_id AND g.tenant_id = ata.tenant_id
             LEFT JOIN secure_assessment_assessment_types at ON at.id = i.assessment_type_id AND at.tenant_id = i.tenant_id
             WHERE i.id = $1 AND i.tenant_id = $2`,
            [examInstanceId, actor.tenantId, actor.personId]
        );
        if (exam.rows.length !== 1) {
            await client.query('ROLLBACK');
            return { type: 'forbidden' };
        }
        const examRow = exam.rows[0];
        const examInfo = {
            examInstanceId,
            subjectLabel: examRow.subject_label ?? null,
            groupLabel: examRow.group_label ?? null,
            assessmentTypeLabel: examRow.assessment_type_label ?? null,
            lifecycleState: examRow.lifecycle_state,
            windowStartsAt: isoOrNull(examRow.window_starts_at),
            windowEndsAt: isoOrNull(examRow.window_ends_at),
        };

        const finalized = await readFinalizedResults(client, actor.tenantId, examInstanceId);
        if (finalized) {
            const ids = await listElligbleIds(client, finalized.rows.map(row => row.personId));
            await client.query('COMMIT');
            const list: ParticipantResult[] = finalized.rows.map(row => ({
                elligbleId: ids.get(row.personId) ?? null,
                status: row.standing === 'SUBMITTED' ? 'SUBMITTED' : 'ABSENT',
                finalizationSource: (row.finalizationSource as FinalizationSource | null) ?? null,
                submittedAt: row.submittedAt,
                score: row.standing === 'SUBMITTED'
                    ? {
                        correct: row.correct ?? 0,
                        incorrect: row.incorrect ?? 0,
                        unanswered: row.unanswered ?? 0,
                        rawScore: row.rawScore ?? 0,
                        maxScore: row.maxScore ?? 0,
                        scaledScore: row.scaledScore ?? 0,
                    }
                    : null,
            }));
            sortByElligbleId(list);
            return {
                type: 'ok',
                results: {
                    exam: examInfo,
                    scoring: { rule: finalized.scoringRule, available: true, questionCount: finalized.questionCount, maxScore: finalized.maxScore },
                    resultState: 'FINAL',
                    finalizedAt: finalized.finalizedAt,
                    summary: {
                        participants: list.length,
                        notStarted: list.filter(r => r.status === 'ABSENT').length,
                        inProgress: 0,
                        submitted: list.filter(r => r.status === 'SUBMITTED').length,
                    },
                    participants: list,
                },
            };
        }

        const snapshots = await client.query(
            `SELECT id, frozen_content FROM secure_assessment_exam_question_snapshots
             WHERE tenant_id = $1 AND exam_instance_id = $2
             ORDER BY display_order ASC NULLS LAST, id ASC`,
            [actor.tenantId, examInstanceId]
        );
        const questions: ScorableQuestion[] = snapshots.rows.map(row => ({ id: row.id, frozenContent: row.frozen_content }));

        const participants = await client.query(
            `SELECT p.id AS participant_id, p.person_id, a.id AS attempt_id, t.started_at,
                    sub.submitted_at, sub.finalization_source
             FROM secure_assessment_exam_participants p
             LEFT JOIN LATERAL (
                 SELECT att.id FROM secure_assessment_exam_attempts att
                 WHERE att.tenant_id = p.tenant_id AND att.exam_participant_id = p.id
                 ORDER BY att.created_at ASC, att.id ASC
                 LIMIT 1
             ) a ON TRUE
             LEFT JOIN secure_assessment_timer_state t ON t.tenant_id = p.tenant_id AND t.exam_attempt_id = a.id
             LEFT JOIN secure_assessment_exam_submissions sub ON sub.tenant_id = p.tenant_id AND sub.exam_attempt_id = a.id
             WHERE p.tenant_id = $1 AND p.exam_instance_id = $2`,
            [actor.tenantId, examInstanceId]
        );

        const submittedAttempts = participants.rows.filter(row => row.submitted_at).map(row => row.attempt_id as string);
        const answersByAttempt = new Map<string, Map<string, unknown>>();
        if (submittedAttempts.length > 0) {
            const answers = await client.query(
                `SELECT exam_attempt_id, exam_question_snapshot_id, answer_payload FROM secure_assessment_exam_answers
                 WHERE tenant_id = $1 AND exam_attempt_id = ANY($2::uuid[])`,
                [actor.tenantId, submittedAttempts]
            );
            for (const row of answers.rows) {
                let byQuestion = answersByAttempt.get(row.exam_attempt_id);
                if (!byQuestion) answersByAttempt.set(row.exam_attempt_id, (byQuestion = new Map()));
                byQuestion.set(row.exam_question_snapshot_id, row.answer_payload);
            }
        }

        const elligbleIds = await listElligbleIds(client, participants.rows.map(row => row.person_id as string));
        await client.query('COMMIT');

        const probe = scoreBaselineAttempt(questions, new Map());
        const scoringAvailable = probe.type === 'scored';
        const results: ParticipantResult[] = participants.rows.map(row => {
            const status: ParticipantResultStatus = row.submitted_at ? 'SUBMITTED' : row.started_at ? 'IN_PROGRESS' : 'NOT_STARTED';
            let score: ParticipantScore | null = null;
            if (status === 'SUBMITTED' && scoringAvailable) {
                const scored = scoreBaselineAttempt(questions, answersByAttempt.get(row.attempt_id) ?? new Map());
                if (scored.type === 'scored') {
                    const { correct, incorrect, unanswered, rawScore, maxScore, scaledScore } = scored.score;
                    score = { correct, incorrect, unanswered, rawScore, maxScore, scaledScore };
                }
            }
            return {
                elligbleId: elligbleIds.get(row.person_id) ?? null,
                status,
                finalizationSource: status === 'SUBMITTED' ? (row.finalization_source ?? null) : null,
                submittedAt: status === 'SUBMITTED' ? isoOrNull(row.submitted_at) : null,
                score,
            };
        });
        sortByElligbleId(results);

        const count = (status: ParticipantResultStatus) => results.filter(r => r.status === status).length;
        return {
            type: 'ok',
            results: {
                exam: examInfo,
                scoring: {
                    rule: BASELINE_SCORING_RULE,
                    available: scoringAvailable,
                    questionCount: questions.length,
                    maxScore: probe.type === 'scored' ? probe.score.maxScore : null,
                },
                resultState: 'PROVISIONAL',
                finalizedAt: null,
                summary: { participants: results.length, notStarted: count('NOT_STARTED'), inProgress: count('IN_PROGRESS'), submitted: count('SUBMITTED') },
                participants: results,
            },
        };
    } catch {
        await client.query('ROLLBACK').catch(() => {});
        return { type: 'unavailable' };
    } finally {
        client.release();
    }
}
