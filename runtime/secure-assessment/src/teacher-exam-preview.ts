import type pg from 'pg';
import { validateBaselineQuestionSnapshotFrozenContent } from './question-snapshot-baseline-frozen-content-contract.ts';
import { MULTIPLE_RESPONSE_DESCRIPTOR, MULTIPLE_RESPONSE_TYPE } from './question-types/multiple-response.ts';
import { MATCHING_DESCRIPTOR, MATCHING_TYPE } from './question-types/matching.ts';
import { ORDERING_DESCRIPTOR, ORDERING_TYPE } from './question-types/ordering.ts';
import { NUMERIC_ANSWER_DESCRIPTOR, NUMERIC_ANSWER_TYPE } from './question-types/numeric-answer.ts';
import { TRUE_FALSE_DESCRIPTOR, TRUE_FALSE_TYPE } from './question-types/true-false.ts';
import { ESSAY_DESCRIPTOR, ESSAY_TYPE } from './question-types/essay.ts';

// Teacher preview of an exam before it opens (ASSESS-TEACHER-002; D04.3-38 LOCKED: the
// teacher previews the exam before READY, close to what students will see; D04.3-39 LOCKED:
// a preview never creates attempt data; D04.3-84: Teacher Preview is not a Student Attempt).
// Only the teacher who manages the exam (the same assignment-scoped authority that marks it
// ready and opens it, D04.4-26A/26C) reads it, while it is SCHEDULED or READY. The questions
// come from the frozen snapshots in the order students receive them, with the key and score
// for the teacher. The read runs in a read-only transaction: it cannot write anything.

export interface TeacherExamPreviewQuestion {
    snapshotId: string;
    /** Position as students receive it, 1-based. */
    no: number;
    prompt: string;
    options: Array<{ id: string; content: string }>;
    correctOptionId: string | null;
    maxScore: number | null;
    /** False when the stored content is not a valid question of a delivered type (readiness blocks the exam). */
    valid: boolean;
    /** ASSESS-QUESTION-002 §4A.6/§11.3: the valid type; absent for invalid content. */
    questionType?: 'MULTIPLE_CHOICE_SINGLE' | 'MULTIPLE_RESPONSE' | 'TRUE_FALSE' | 'MATCHING' | 'ORDERING' | 'NUMERIC_ANSWER' | 'ESSAY';
    /** Essay only (ASSESS-QUESTION-008 §4.6): the rubric as authored, possibly empty; absent on every other item. */
    rubric?: string;
    /** True/false only: the key (ASSESS-QUESTION-003 §4A.5); absent on every other item. */
    correctValue?: boolean;
    /** Multiple response: the key options in authored order; null for v1; absent for invalid content. */
    correctOptionIds?: string[] | null;
    /** Matching only (ASSESS-QUESTION-004 §4.3): the items in authored order and the key; absent on every other item. */
    leftItems?: Array<{ id: string; content: string }>;
    rightItems?: Array<{ id: string; content: string }>;
    correctPairs?: Array<{ leftId: string; rightId: string }>;
    /** Ordering only (ASSESS-QUESTION-005 §4.3): the items in display order and the correct order; absent on every other item. */
    items?: Array<{ id: string; content: string }>;
    correctOrder?: string[];
    /** Numeric answer only (ASSESS-QUESTION-007 §4.3): the canonical key and tolerance; absent on every other item. */
    expected?: string;
    tolerance?: string;
}

export interface TeacherExamPreview {
    exam: {
        examInstanceId: string;
        subjectLabel: string | null;
        groupLabel: string | null;
        assessmentTypeLabel: string | null;
        lifecycleState: string;
        windowStartsAt: string | null;
        windowEndsAt: string | null;
        durationMinutes: number | null;
    };
    questions: TeacherExamPreviewQuestion[];
}

export type TeacherExamPreviewOutcome =
    | { type: 'ok'; preview: TeacherExamPreview }
    | { type: 'invalid_state'; lifecycleState: string }
    | { type: 'forbidden' }
    | { type: 'unavailable' };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PREVIEW_STATES = new Set(['SCHEDULED', 'READY']);

function isoOrNull(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toQuestion(snapshotId: string, no: number, content: unknown): TeacherExamPreviewQuestion {
    const checked = validateBaselineQuestionSnapshotFrozenContent(content);
    if (checked.type === 'baseline_question_snapshot_content_valid') {
        const record = content as { prompt: string; options: Array<{ id: string; content: string }>; correctOptionId: string; maxScore: number };
        return {
            snapshotId, no, prompt: record.prompt,
            options: record.options.map(o => ({ id: o.id, content: o.content })),
            correctOptionId: record.correctOptionId, maxScore: record.maxScore, valid: true,
            questionType: 'MULTIPLE_CHOICE_SINGLE', correctOptionIds: null,
        };
    }
    if (content && typeof content === 'object' && !Array.isArray(content) && (content as Record<string, unknown>)['schemaVersion'] === 2
        && MULTIPLE_RESPONSE_DESCRIPTOR.validateContent(content as Record<string, unknown>).ok) {
        const record = content as { prompt: string; options: Array<{ id: string; content: string }>; correctOptionIds: string[]; maxScore: number };
        const keys = new Set(record.correctOptionIds);
        return {
            snapshotId, no, prompt: record.prompt,
            options: record.options.map(o => ({ id: o.id, content: o.content })),
            correctOptionId: null, maxScore: record.maxScore, valid: true,
            questionType: MULTIPLE_RESPONSE_TYPE, correctOptionIds: record.options.filter(o => keys.has(o.id)).map(o => o.id),
        };
    }
    if (content && typeof content === 'object' && !Array.isArray(content) && (content as Record<string, unknown>)['schemaVersion'] === 2
        && TRUE_FALSE_DESCRIPTOR.validateContent(content as Record<string, unknown>).ok) {
        const record = content as { prompt: string; correctValue: boolean; maxScore: number };
        return {
            snapshotId, no, prompt: record.prompt, options: [], correctOptionId: null, maxScore: record.maxScore, valid: true,
            questionType: TRUE_FALSE_TYPE, correctOptionIds: null, correctValue: record.correctValue,
        };
    }
    if (content && typeof content === 'object' && !Array.isArray(content) && (content as Record<string, unknown>)['schemaVersion'] === 2
        && MATCHING_DESCRIPTOR.validateContent(content as Record<string, unknown>).ok) {
        const record = content as {
            prompt: string; maxScore: number;
            leftItems: Array<{ id: string; content: string }>; rightItems: Array<{ id: string; content: string }>;
            correctPairs: Array<{ leftId: string; rightId: string }>;
        };
        const items = (list: Array<{ id: string; content: string }>) => list.map(i => ({ id: i.id, content: i.content }));
        const keyOf = new Map(record.correctPairs.map(p => [p.leftId, p.rightId]));
        return {
            snapshotId, no, prompt: record.prompt, options: [], correctOptionId: null, maxScore: record.maxScore, valid: true,
            questionType: MATCHING_TYPE, correctOptionIds: null,
            leftItems: items(record.leftItems), rightItems: items(record.rightItems),
            correctPairs: record.leftItems.map(i => ({ leftId: i.id, rightId: keyOf.get(i.id) as string })),
        };
    }
    if (content && typeof content === 'object' && !Array.isArray(content) && (content as Record<string, unknown>)['schemaVersion'] === 2
        && ORDERING_DESCRIPTOR.validateContent(content as Record<string, unknown>).ok) {
        const record = content as { prompt: string; maxScore: number; items: Array<{ id: string; content: string }>; correctOrder: string[] };
        return {
            snapshotId, no, prompt: record.prompt, options: [], correctOptionId: null, maxScore: record.maxScore, valid: true,
            questionType: ORDERING_TYPE, correctOptionIds: null,
            items: record.items.map(i => ({ id: i.id, content: i.content })), correctOrder: [...record.correctOrder],
        };
    }
    if (content && typeof content === 'object' && !Array.isArray(content) && (content as Record<string, unknown>)['schemaVersion'] === 2
        && NUMERIC_ANSWER_DESCRIPTOR.validateContent(content as Record<string, unknown>).ok) {
        const record = content as { prompt: string; maxScore: number; expected: string; tolerance: string };
        return {
            snapshotId, no, prompt: record.prompt, options: [], correctOptionId: null, maxScore: record.maxScore, valid: true,
            questionType: NUMERIC_ANSWER_TYPE, correctOptionIds: null, expected: record.expected, tolerance: record.tolerance,
        };
    }
    if (content && typeof content === 'object' && !Array.isArray(content) && (content as Record<string, unknown>)['schemaVersion'] === 2
        && ESSAY_DESCRIPTOR.validateContent(content as Record<string, unknown>).ok) {
        const record = content as { prompt: string; maxScore: number; rubric: string };
        return {
            snapshotId, no, prompt: record.prompt, options: [], correctOptionId: null, maxScore: record.maxScore, valid: true,
            questionType: ESSAY_TYPE, correctOptionIds: null, rubric: record.rubric,
        };
    }
    // Show what is there, without trusting its shape.
    const record = (content && typeof content === 'object' ? content : {}) as Record<string, unknown>;
    const options = Array.isArray(record['options'])
        ? (record['options'] as unknown[]).map((o, i) => {
            const option = (o && typeof o === 'object' ? o : {}) as Record<string, unknown>;
            return { id: typeof option['id'] === 'string' ? option['id'] : `option-${i}`, content: typeof option['content'] === 'string' ? option['content'] : '' };
        })
        : [];
    return {
        snapshotId, no, prompt: typeof record['prompt'] === 'string' ? record['prompt'] : '',
        // No type fields: invalid content keeps exactly its earlier shape (record §11.3).
        options, correctOptionId: null, maxScore: null, valid: false,
    };
}

export async function readTeacherExamPreview(
    pool: pg.Pool,
    actor: { tenantId: string; personId: string },
    examInstanceId: string
): Promise<TeacherExamPreviewOutcome> {
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
            `SELECT i.lifecycle_state, i.window_starts_at, i.window_ends_at, i.configured_attempt_duration_seconds,
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
        const row = exam.rows[0];
        if (!PREVIEW_STATES.has(row.lifecycle_state)) {
            await client.query('ROLLBACK');
            return { type: 'invalid_state', lifecycleState: row.lifecycle_state };
        }
        // The order students receive (question-delivery.ts).
        const snapshots = await client.query(
            `SELECT id, frozen_content FROM secure_assessment_exam_question_snapshots
             WHERE tenant_id = $1 AND exam_instance_id = $2
             ORDER BY display_order ASC NULLS LAST, id ASC`,
            [actor.tenantId, examInstanceId]
        );
        await client.query('COMMIT');
        const duration = row.configured_attempt_duration_seconds === null ? null : Number(row.configured_attempt_duration_seconds);
        return {
            type: 'ok',
            preview: {
                exam: {
                    examInstanceId,
                    subjectLabel: row.subject_label ?? null,
                    groupLabel: row.group_label ?? null,
                    assessmentTypeLabel: row.assessment_type_label ?? null,
                    lifecycleState: row.lifecycle_state,
                    windowStartsAt: isoOrNull(row.window_starts_at),
                    windowEndsAt: isoOrNull(row.window_ends_at),
                    durationMinutes: duration === null ? null : Math.round(duration / 60),
                },
                questions: snapshots.rows.map((s, index) => toQuestion(s.id, index + 1, s.frozen_content)),
            },
        };
    } catch {
        await client.query('ROLLBACK').catch(() => {});
        return { type: 'unavailable' };
    } finally {
        client.release();
    }
}
