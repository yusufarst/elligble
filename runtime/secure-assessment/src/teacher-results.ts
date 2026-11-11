import type * as pg from 'pg';
import { listElligbleIds } from '../../identity-access/src/directory.ts';
import type { FinalizationSource } from './submission.ts';
import { BASELINE_SCORING_RULE, isCompositeScore, scoreAttempt, type AttemptScore, type CompositeAttemptScore, type ScorableQuestion } from './scoring.ts';
import { gradeScores, isRunningInstitutionExam, isTeacherGradedQuestion, readCurrentGrades } from './essay-grading.ts';
import { readFinalizedResults, type FinalizedResultRow } from './result-finalization.ts';
import { classifyFrozenContent, V1_SINGLE_CHOICE_KEY, V1_SINGLE_CHOICE_RULE } from './question-contract.ts';
import { ESSAY_KEY, ESSAY_RULE } from './question-types/essay.ts';
import { MATCHING_KEY, MATCHING_RULE } from './question-types/matching.ts';
import { MULTIPLE_RESPONSE_KEY, MULTIPLE_RESPONSE_RULE } from './question-types/multiple-response.ts';
import { NUMERIC_ANSWER_KEY, NUMERIC_ANSWER_RULE } from './question-types/numeric-answer.ts';
import { ORDERING_KEY, ORDERING_RULE } from './question-types/ordering.ts';
import { SHORT_ANSWER_KEY, SHORT_ANSWER_RULE } from './question-types/short-answer.ts';
import { TRUE_FALSE_KEY, TRUE_FALSE_RULE } from './question-types/true-false.ts';

// Provisional results of a teacher-managed exam for the teacher who manages it (D04.4-26A/C,
// D04.8). Scores are computed on read from the frozen snapshots and the answers the server
// accepted (deterministic, D04.8-56), only for finalized attempts: in-progress attempts
// have no score yet and participants who never started have none at all (absent is not
// zero, D04.4-12). Results are neither finalized nor published (D04.8-17/21): students do
// not see them. Participants are listed by ELLIGBLE ID, never ranked by score (D04.8-51).
// When a participant has more than one attempt, the original (first) attempt is shown.
// Once the exam is finalized (D04.8-17/20) the frozen results are shown instead, exactly
// as stored at finalization; a participant who did not work on it is ABSENT.
//
// RESULT-004 (E6, E8): the subject Teacher of an institution exam sees no results while the exam is
// ACTIVE or PAUSED (D04.4-26D: no whole-exam monitoring); and every response carries the item
// projection of RS-1: `questions` ({no, typeCode, maxScore}, in display order) and, on each row with a
// score, `items` ({no, outcome, score}). PROVISIONAL items come from the same scoreAttempt call as the
// totals; FINAL items and questions come only from the frozen item outcomes (never recomputed,
// D04.8-20). No prompt, option, key, accepted form, tolerance or rubric is projected.

export type ParticipantResultStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'ABSENT';

/** The v2 import type code of a question (question-import.ts ImportQuestionType). */
export type ResultTypeCode = 'PG' | 'PGK' | 'BS' | 'MJ' | 'UR' | 'IA' | 'IS' | 'ES';

/** One question of the item projection (RS-1, E8). */
export interface ResultQuestion {
    no: number;
    typeCode: ResultTypeCode;
    maxScore: number;
}

/** One item of a scored row (RS-1, E8): the earned points; 0 for UNGRADED. */
export interface ResultItem {
    no: number;
    outcome: string;
    score: number;
}

const TYPE_CODE_BY_CONTENT_KEY: ReadonlyMap<string, ResultTypeCode> = new Map([
    [V1_SINGLE_CHOICE_KEY, 'PG'], [MULTIPLE_RESPONSE_KEY, 'PGK'], [TRUE_FALSE_KEY, 'BS'], [MATCHING_KEY, 'MJ'],
    [ORDERING_KEY, 'UR'], [NUMERIC_ANSWER_KEY, 'IA'], [SHORT_ANSWER_KEY, 'IS'], [ESSAY_KEY, 'ES'],
]);

const TYPE_CODE_BY_RULE: ReadonlyMap<string, ResultTypeCode> = new Map([
    [V1_SINGLE_CHOICE_RULE, 'PG'], [MULTIPLE_RESPONSE_RULE, 'PGK'], [TRUE_FALSE_RULE, 'BS'], [MATCHING_RULE, 'MJ'],
    [ORDERING_RULE, 'UR'], [NUMERIC_ANSWER_RULE, 'IA'], [SHORT_ANSWER_RULE, 'IS'], [ESSAY_RULE, 'ES'],
]);

/** The type code of a frozen question's content key (automatic and manual short answers alike are IS). */
export function typeCodeOfContent(frozenContent: unknown): ResultTypeCode {
    const kind = classifyFrozenContent(frozenContent);
    const code = kind.kind === 'v1' || kind.kind === 'registered' ? TYPE_CODE_BY_CONTENT_KEY.get(kind.key) : undefined;
    if (!code) throw new Error('A scorable question has no type code');
    return code;
}

/** The type code of a frozen item outcome's rule; an entry without ruleId is a v1 single choice. */
export function typeCodeOfRule(ruleId: string | undefined): ResultTypeCode {
    const code = TYPE_CODE_BY_RULE.get(ruleId ?? V1_SINGLE_CHOICE_RULE);
    if (!code) throw new Error(`A frozen item outcome has an unknown rule ${ruleId}`);
    return code;
}

const MICRO = 1_000_000;

/** PROVISIONAL questions: the snapshots in display order, each with the maximum the scoring gives it. */
export function provisionalQuestions(questions: readonly ScorableQuestion[], score: AttemptScore | CompositeAttemptScore): ResultQuestion[] {
    const contentOf = new Map(questions.map(q => [q.id, q.frozenContent]));
    return score.items.map((item, index) => ({
        no: index + 1,
        typeCode: typeCodeOfContent(contentOf.get(item.questionSnapshotId)),
        maxScore: isCompositeScore(score) ? Number(score.items[index].maxScoreMicro) / MICRO : item.maxScore,
    }));
}

/** PROVISIONAL items of one scored attempt, from the same score that gives its totals, matched by snapshot id. */
export function provisionalItems(score: AttemptScore | CompositeAttemptScore, noBySnapshot: ReadonlyMap<string, number>): ResultItem[] {
    return score.items.map(item => {
        const no = noBySnapshot.get(item.questionSnapshotId);
        if (no === undefined) throw new Error('A scored item has no question');
        const earned = 'scoreMicro' in item ? Number(item.scoreMicro) / MICRO : item.score;
        return { no, outcome: item.outcome, score: earned };
    });
}

type FrozenItem = NonNullable<FinalizedResultRow['itemOutcomes']>[number];

/** FINAL questions: the frozen order, maxima and rules of the item outcomes of one SUBMITTED row. */
export function finalQuestions(itemOutcomes: readonly FrozenItem[]): ResultQuestion[] {
    return itemOutcomes.map((item, index) => ({ no: index + 1, typeCode: typeCodeOfRule(item.ruleId), maxScore: Number(item.maxScoreMicro) / MICRO }));
}

/** FINAL items of one SUBMITTED row: each frozen outcome matched to its question by snapshot id. */
export function finalItems(itemOutcomes: readonly FrozenItem[], noBySnapshot: ReadonlyMap<string, number>): ResultItem[] {
    return itemOutcomes
        .map(item => {
            const no = noBySnapshot.get(item.questionSnapshotId);
            if (no === undefined) throw new Error('A frozen item outcome has no question');
            return { no, outcome: item.outcome, score: Number(item.scoreMicro) / MICRO };
        })
        .sort((a, b) => a.no - b.no);
}

export interface ParticipantScore {
    /** D1 (ASSESS-QUESTION-008): automatically scored items only. */
    correct: number;
    incorrect: number;
    unanswered: number;
    /** Essays with a grade, and answered essays still waiting for one (0 once FINAL). */
    graded: number;
    ungraded: number;
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
    /** RS-1: present only on a row with a score, one entry per question. */
    items?: ResultItem[];
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
    /** autoScoredCount: questions that are not essays; essayCount: essay questions (ASSESS-QUESTION-008). */
    scoring: { rule: string; available: boolean; questionCount: number; maxScore: number | null; autoScoredCount: number; essayCount: number };
    resultState: 'PROVISIONAL' | 'FINAL';
    /** When the results were finalized (FINAL only). */
    finalizedAt: string | null;
    summary: { participants: number; notStarted: number; inProgress: number; submitted: number };
    participants: ParticipantResult[];
    /** RS-1: one entry per question in display order; [] when the exam cannot be scored. */
    questions: ResultQuestion[];
}

export type TeacherExamResultsOutcome =
    | { type: 'ok'; results: TeacherExamResults }
    | { type: 'forbidden' }
    /** E6 (D04.4-26D): an institution exam in ACTIVE or PAUSED; nothing about its participants. */
    | { type: 'institution_exam_running'; currentState: string }
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
    examInstanceId: string,
    transaction?: pg.PoolClient
): Promise<TeacherExamResultsOutcome> {
    if (!UUID_REGEX.test(examInstanceId) || !UUID_REGEX.test(actor.tenantId) || !UUID_REGEX.test(actor.personId)) {
        return { type: 'forbidden' };
    }
    let client: pg.PoolClient;
    try {
        client = transaction ?? await pool.connect();
    } catch (transactionError) {
        if (transaction) throw transactionError;
        return { type: 'unavailable' };
    }
    try {
        if (!transaction) await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const exam = await client.query(
            `SELECT i.id, i.lifecycle_state, i.window_starts_at, i.window_ends_at,
                    (to_jsonb(i) ->> 'institution_session_id') AS institution_session_id,
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
            if (!transaction) await client.query('ROLLBACK');
            return { type: 'forbidden' };
        }
        const examRow = exam.rows[0];
        // E6: placed after the authority check and before any participant is read.
        if (isRunningInstitutionExam(examRow.institution_session_id ?? null, examRow.lifecycle_state)) {
            if (!transaction) await client.query('ROLLBACK');
            return { type: 'institution_exam_running', currentState: examRow.lifecycle_state };
        }
        const examInfo = {
            examInstanceId,
            subjectLabel: examRow.subject_label ?? null,
            groupLabel: examRow.group_label ?? null,
            assessmentTypeLabel: examRow.assessment_type_label ?? null,
            lifecycleState: examRow.lifecycle_state,
            windowStartsAt: isoOrNull(examRow.window_starts_at),
            windowEndsAt: isoOrNull(examRow.window_ends_at),
        };

        const snapshots = await client.query(
            `SELECT id, frozen_content FROM secure_assessment_exam_question_snapshots
             WHERE tenant_id = $1 AND exam_instance_id = $2
             ORDER BY display_order ASC NULLS LAST, id ASC`,
            [actor.tenantId, examInstanceId]
        );
        const questions: ScorableQuestion[] = snapshots.rows.map(row => ({ id: row.id, frozenContent: row.frozen_content }));
        const essayCount = questions.filter(q => isTeacherGradedQuestion(q.frozenContent)).length;
        const autoScoredCount = questions.length - essayCount;

        const finalized = await readFinalizedResults(client, actor.tenantId, examInstanceId);
        if (finalized) {
            const ids = await listElligbleIds(client, finalized.rows.map(row => row.personId));
            if (!transaction) await client.query('COMMIT');
            // E8 FINAL: only frozen data. The questions follow the frozen item order of a SUBMITTED row
            // (every SUBMITTED row of one finalization has the same order and maxima); with none, the
            // snapshots give them as for a provisional read, and no row has item cells.
            const firstSubmitted = finalized.rows.find(row => row.standing === 'SUBMITTED' && Array.isArray(row.itemOutcomes));
            let finalQuestionList: ResultQuestion[];
            if (firstSubmitted) {
                finalQuestionList = finalQuestions(firstSubmitted.itemOutcomes!);
            } else {
                const probe = scoreAttempt(questions, new Map());
                finalQuestionList = probe.type === 'scored' ? provisionalQuestions(questions, probe.score) : [];
            }
            const finalNo = new Map((firstSubmitted?.itemOutcomes ?? []).map((item, index) => [item.questionSnapshotId, index + 1]));
            const list: ParticipantResult[] = finalized.rows.map(row => {
                const result: ParticipantResult = {
                    elligbleId: ids.get(row.personId) ?? null,
                    status: row.standing === 'SUBMITTED' ? 'SUBMITTED' : 'ABSENT',
                    finalizationSource: (row.finalizationSource as FinalizationSource | null) ?? null,
                    submittedAt: row.submittedAt,
                    score: row.standing === 'SUBMITTED'
                        ? {
                            correct: row.correct ?? 0,
                            incorrect: row.incorrect ?? 0,
                            unanswered: row.unanswered ?? 0,
                            graded: (row.itemOutcomes ?? []).filter(item => item.outcome === 'GRADED').length,
                            ungraded: 0,
                            rawScore: row.rawScore ?? 0,
                            maxScore: row.maxScore ?? 0,
                            scaledScore: row.scaledScore ?? 0,
                        }
                        : null,
                };
                if (result.score) result.items = finalItems(row.itemOutcomes ?? [], finalNo);
                return result;
            });
            sortByElligbleId(list);
            return {
                type: 'ok',
                results: {
                    exam: examInfo,
                    scoring: { rule: finalized.scoringRule, available: true, questionCount: finalized.questionCount, maxScore: finalized.maxScore, autoScoredCount, essayCount },
                    resultState: 'FINAL',
                    finalizedAt: finalized.finalizedAt,
                    summary: {
                        participants: list.length,
                        notStarted: list.filter(r => r.status === 'ABSENT').length,
                        inProgress: 0,
                        submitted: list.filter(r => r.status === 'SUBMITTED').length,
                    },
                    participants: list,
                    questions: finalQuestionList,
                },
            };
        }

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

        const grades = await readCurrentGrades(client, actor.tenantId, submittedAttempts);
        const elligbleIds = await listElligbleIds(client, participants.rows.map(row => row.person_id as string));
        if (!transaction) await client.query('COMMIT');

        // ASSESS-QUESTION-002 §4.4: all-v1 exams score exactly as before; a delivered new type
        // selects the composite rule.
        const probe = scoreAttempt(questions, new Map());
        const scoringAvailable = probe.type === 'scored';
        // E8 PROVISIONAL: the snapshots in display order; [] when the content cannot be scored.
        const questionList = probe.type === 'scored' ? provisionalQuestions(questions, probe.score) : [];
        const noBySnapshot = new Map(questions.map((q, index) => [q.id, index + 1]));
        const results: ParticipantResult[] = participants.rows.map(row => {
            const status: ParticipantResultStatus = row.submitted_at ? 'SUBMITTED' : row.started_at ? 'IN_PROGRESS' : 'NOT_STARTED';
            let score: ParticipantScore | null = null;
            let items: ResultItem[] | undefined;
            if (status === 'SUBMITTED' && scoringAvailable) {
                const scored = scoreAttempt(questions, answersByAttempt.get(row.attempt_id) ?? new Map(), undefined, gradeScores(grades.get(row.attempt_id)));
                if (scored.type === 'scored') {
                    const { correct, incorrect, unanswered, rawScore, maxScore, scaledScore } = scored.score;
                    const graded = isCompositeScore(scored.score) ? scored.score.gradedCount : 0;
                    const ungraded = isCompositeScore(scored.score) ? scored.score.ungradedCount : 0;
                    score = { correct, incorrect, unanswered, graded, ungraded, rawScore, maxScore, scaledScore };
                    // The same score gives the totals and the items, so they cannot disagree.
                    items = provisionalItems(scored.score, noBySnapshot);
                }
            }
            const result: ParticipantResult = {
                elligbleId: elligbleIds.get(row.person_id) ?? null,
                status,
                finalizationSource: status === 'SUBMITTED' ? (row.finalization_source ?? null) : null,
                submittedAt: status === 'SUBMITTED' ? isoOrNull(row.submitted_at) : null,
                score,
            };
            if (score && items) result.items = items;
            return result;
        });
        sortByElligbleId(results);

        const count = (status: ParticipantResultStatus) => results.filter(r => r.status === status).length;
        return {
            type: 'ok',
            results: {
                exam: examInfo,
                scoring: {
                    rule: probe.type === 'scored' ? probe.score.rule : BASELINE_SCORING_RULE,
                    available: scoringAvailable,
                    questionCount: questions.length,
                    maxScore: probe.type === 'scored' ? probe.score.maxScore : null,
                    autoScoredCount,
                    essayCount,
                },
                resultState: 'PROVISIONAL',
                finalizedAt: null,
                summary: { participants: results.length, notStarted: count('NOT_STARTED'), inProgress: count('IN_PROGRESS'), submitted: count('SUBMITTED') },
                participants: results,
                questions: questionList,
            },
        };
    } catch (transactionError) {
        if (!transaction) await client.query('ROLLBACK').catch(() => {});
        if (transaction) throw transactionError;
        return { type: 'unavailable' };
    } finally {
        if (!transaction) client.release();
    }
}
