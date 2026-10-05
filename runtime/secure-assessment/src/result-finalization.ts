import type * as pg from 'pg';
import { BASELINE_SCORING_RULE, scoreBaselineAttempt, selectedOptionOf, type ScorableQuestion } from './scoring.ts';

// Result finalization (D04.8-17/18/19/20/56/57, D04.2-83; Owner decision 2026-09-30, ENDED
// point 5): an ended exam whose attempts are all finished is finalized explicitly, and its
// result state is frozen. Each participant's outcome is stored as computed now (rule,
// raw and maximum micro-points, scaled score, per-question outcome with the selected
// option), so later edits to questions, enrollment, assignments or default rules cannot
// change it. Nothing is deleted; answers stay as they are (D04.8-19). A participant who
// did not work on the exam is ABSENT, not zero (D04.4-12). Nothing becomes visible to
// students (D04.8-21). Called inside the lifecycle transaction, with the exam row locked.

const MICRO = 1_000_000;
const toMicro = (value: number) => Math.round(value * MICRO);

export type FreezeOutcome =
    | { type: 'frozen'; finalizationId: string }
    | { type: 'attempts_running'; running: number }
    | { type: 'scoring_unavailable' };

interface FrozenParticipant {
    exam_participant_id: string;
    exam_attempt_id: string | null;
    standing: 'SUBMITTED' | 'ABSENT';
    finalization_source: string | null;
    submitted_at: string | null;
    correct_count: number | null;
    incorrect_count: number | null;
    unanswered_count: number | null;
    raw_score_micro: number | null;
    max_score_micro: number | null;
    scaled_score: number | null;
    item_outcomes: unknown[] | null;
}

export async function freezeExamResults(
    client: pg.PoolClient,
    tenantId: string,
    examInstanceId: string,
    actorPersonId: string
): Promise<FreezeOutcome> {
    // Attempts whose time ran out but that the expiry sweep has not reached yet are
    // finalized from their accepted answers now, as the sweep would (D04.5-47).
    await client.query(
        `INSERT INTO secure_assessment_exam_submissions (tenant_id, exam_attempt_id, finalization_source)
         SELECT a.tenant_id, a.id, 'EXPIRY_SERVER'
         FROM secure_assessment_exam_attempts a
         JOIN secure_assessment_exam_participants p ON p.id = a.exam_participant_id AND p.tenant_id = a.tenant_id
         JOIN secure_assessment_timer_state t ON t.exam_attempt_id = a.id AND t.tenant_id = a.tenant_id
         WHERE p.tenant_id = $1 AND p.exam_instance_id = $2 AND t.started_at IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM secure_assessment_exam_submissions s WHERE s.tenant_id = a.tenant_id AND s.exam_attempt_id = a.id)
           AND secure_assessment_attempt_remaining_seconds(a.tenant_id, a.id, statement_timestamp()) <= 0
         ON CONFLICT (tenant_id, exam_attempt_id) DO NOTHING`,
        [tenantId, examInstanceId]
    );
    const running = await client.query(
        `SELECT count(*)::int AS n
         FROM secure_assessment_exam_attempts a
         JOIN secure_assessment_exam_participants p ON p.id = a.exam_participant_id AND p.tenant_id = a.tenant_id
         JOIN secure_assessment_timer_state t ON t.exam_attempt_id = a.id AND t.tenant_id = a.tenant_id
         WHERE p.tenant_id = $1 AND p.exam_instance_id = $2 AND t.started_at IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM secure_assessment_exam_submissions s WHERE s.tenant_id = a.tenant_id AND s.exam_attempt_id = a.id)`,
        [tenantId, examInstanceId]
    );
    if (running.rows[0].n > 0) return { type: 'attempts_running', running: running.rows[0].n };

    const snapshots = await client.query(
        `SELECT id, frozen_content FROM secure_assessment_exam_question_snapshots
         WHERE tenant_id = $1 AND exam_instance_id = $2
         ORDER BY display_order ASC NULLS LAST, id ASC`,
        [tenantId, examInstanceId]
    );
    const questions: ScorableQuestion[] = snapshots.rows.map(row => ({ id: row.id, frozenContent: row.frozen_content }));
    const probe = scoreBaselineAttempt(questions, new Map());
    if (probe.type !== 'scored') return { type: 'scoring_unavailable' };

    // The original (first) attempt of each participant, as the results show it.
    const participants = await client.query(
        `SELECT p.id AS participant_id, a.id AS attempt_id, sub.submitted_at, sub.finalization_source
         FROM secure_assessment_exam_participants p
         LEFT JOIN LATERAL (
             SELECT att.id FROM secure_assessment_exam_attempts att
             WHERE att.tenant_id = p.tenant_id AND att.exam_participant_id = p.id
             ORDER BY att.created_at ASC, att.id ASC
             LIMIT 1
         ) a ON TRUE
         LEFT JOIN secure_assessment_exam_submissions sub ON sub.tenant_id = p.tenant_id AND sub.exam_attempt_id = a.id
         WHERE p.tenant_id = $1 AND p.exam_instance_id = $2
         ORDER BY p.id`,
        [tenantId, examInstanceId]
    );
    const submitted = participants.rows.filter(row => row.submitted_at).map(row => row.attempt_id as string);
    const answersByAttempt = new Map<string, Map<string, unknown>>();
    if (submitted.length > 0) {
        const answers = await client.query(
            `SELECT exam_attempt_id, exam_question_snapshot_id, answer_payload FROM secure_assessment_exam_answers
             WHERE tenant_id = $1 AND exam_attempt_id = ANY($2::uuid[])`,
            [tenantId, submitted]
        );
        for (const row of answers.rows) {
            let byQuestion = answersByAttempt.get(row.exam_attempt_id);
            if (!byQuestion) answersByAttempt.set(row.exam_attempt_id, (byQuestion = new Map()));
            byQuestion.set(row.exam_question_snapshot_id, row.answer_payload);
        }
    }

    const frozen: FrozenParticipant[] = [];
    for (const row of participants.rows) {
        if (!row.submitted_at) {
            frozen.push({
                exam_participant_id: row.participant_id, exam_attempt_id: row.attempt_id ?? null, standing: 'ABSENT',
                finalization_source: null, submitted_at: null, correct_count: null, incorrect_count: null, unanswered_count: null,
                raw_score_micro: null, max_score_micro: null, scaled_score: null, item_outcomes: null,
            });
            continue;
        }
        const answers = answersByAttempt.get(row.attempt_id) ?? new Map<string, unknown>();
        const scored = scoreBaselineAttempt(questions, answers);
        if (scored.type !== 'scored') return { type: 'scoring_unavailable' };
        const score = scored.score;
        frozen.push({
            exam_participant_id: row.participant_id,
            exam_attempt_id: row.attempt_id,
            standing: 'SUBMITTED',
            finalization_source: row.finalization_source ?? null,
            submitted_at: new Date(row.submitted_at).toISOString(),
            correct_count: score.correct,
            incorrect_count: score.incorrect,
            unanswered_count: score.unanswered,
            raw_score_micro: toMicro(score.rawScore),
            max_score_micro: toMicro(score.maxScore),
            scaled_score: score.scaledScore,
            item_outcomes: score.items.map(item => ({
                questionSnapshotId: item.questionSnapshotId,
                selectedOptionId: selectedOptionOf(answers.get(item.questionSnapshotId)),
                outcome: item.outcome,
                scoreMicro: toMicro(item.score),
                maxScoreMicro: toMicro(item.maxScore),
            })),
        });
    }

    const finalization = await client.query(
        `INSERT INTO secure_assessment_exam_result_finalizations
            (tenant_id, exam_instance_id, finalized_by_person_id, scoring_rule, question_count, max_score_micro, pending_issues)
         VALUES ($1, $2, $3, $4, $5, $6, '[]'::jsonb)
         RETURNING id`,
        [tenantId, examInstanceId, actorPersonId, BASELINE_SCORING_RULE, questions.length, toMicro(probe.score.maxScore)]
    );
    const finalizationId: string = finalization.rows[0].id;
    if (frozen.length > 0) {
        await client.query(
            `INSERT INTO secure_assessment_attempt_results
                (tenant_id, finalization_id, exam_participant_id, exam_attempt_id, standing, finalization_source, submitted_at,
                 correct_count, incorrect_count, unanswered_count, raw_score_micro, max_score_micro, scaled_score, item_outcomes)
             SELECT $1, $2, r.exam_participant_id, r.exam_attempt_id, r.standing, r.finalization_source, r.submitted_at,
                    r.correct_count, r.incorrect_count, r.unanswered_count, r.raw_score_micro, r.max_score_micro, r.scaled_score, r.item_outcomes
             FROM jsonb_to_recordset($3::jsonb) AS r(
                 exam_participant_id uuid, exam_attempt_id uuid, standing text, finalization_source text, submitted_at timestamptz,
                 correct_count int, incorrect_count int, unanswered_count int, raw_score_micro bigint, max_score_micro bigint,
                 scaled_score numeric, item_outcomes jsonb)`,
            [tenantId, finalizationId, JSON.stringify(frozen)]
        );
    }
    return { type: 'frozen', finalizationId };
}

export interface FinalizedResultRow {
    personId: string;
    standing: 'SUBMITTED' | 'ABSENT';
    finalizationSource: string | null;
    submittedAt: string | null;
    correct: number | null;
    incorrect: number | null;
    unanswered: number | null;
    rawScore: number | null;
    maxScore: number | null;
    scaledScore: number | null;
    itemOutcomes: Array<{ questionSnapshotId: string; selectedOptionId: string | null; outcome: string; scoreMicro: number; maxScoreMicro: number }> | null;
}

export interface FinalizedResults {
    finalizedAt: string;
    finalizedByPersonId: string;
    scoringRule: string;
    questionCount: number;
    maxScore: number;
    rows: FinalizedResultRow[];
}

/** The frozen results of a finalized exam, or null when it has not been finalized. */
export async function readFinalizedResults(client: pg.PoolClient, tenantId: string, examInstanceId: string): Promise<FinalizedResults | null> {
    const head = await client.query(
        `SELECT id, finalized_at, finalized_by_person_id, scoring_rule, question_count, max_score_micro
         FROM secure_assessment_exam_result_finalizations WHERE tenant_id = $1 AND exam_instance_id = $2`,
        [tenantId, examInstanceId]
    );
    if (head.rows.length === 0) return null;
    const finalization = head.rows[0];
    const rows = await client.query(
        `SELECT p.person_id, r.standing, r.finalization_source, r.submitted_at, r.correct_count, r.incorrect_count, r.unanswered_count,
                r.raw_score_micro, r.max_score_micro, r.scaled_score, r.item_outcomes
         FROM secure_assessment_attempt_results r
         JOIN secure_assessment_exam_participants p ON p.id = r.exam_participant_id AND p.tenant_id = r.tenant_id
         WHERE r.tenant_id = $1 AND r.finalization_id = $2`,
        [tenantId, finalization.id]
    );
    const micro = (value: unknown) => (value === null || value === undefined ? null : Number(value) / MICRO);
    return {
        finalizedAt: new Date(finalization.finalized_at).toISOString(),
        finalizedByPersonId: finalization.finalized_by_person_id,
        scoringRule: finalization.scoring_rule,
        questionCount: Number(finalization.question_count),
        maxScore: Number(finalization.max_score_micro) / MICRO,
        rows: rows.rows.map(row => ({
            personId: row.person_id,
            standing: row.standing,
            finalizationSource: row.finalization_source ?? null,
            submittedAt: row.submitted_at ? new Date(row.submitted_at).toISOString() : null,
            correct: row.correct_count ?? null,
            incorrect: row.incorrect_count ?? null,
            unanswered: row.unanswered_count ?? null,
            rawScore: micro(row.raw_score_micro),
            maxScore: micro(row.max_score_micro),
            scaledScore: row.scaled_score === null ? null : Number(row.scaled_score),
            itemOutcomes: row.item_outcomes ?? null,
        })),
    };
}
