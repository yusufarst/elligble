/**
 * BU-066: Secure Assessment Baseline Question Snapshot Frozen-Content Contract Runtime Bootstrap
 *
 * Establishes the concrete runtime validation contract for the existing
 * secure_assessment_exam_question_snapshots.frozen_content JSONB.
 */

export const BASELINE_QUESTION_TYPE = 'MULTIPLE_CHOICE_SINGLE' as const;
export const BASELINE_OPTION_COUNT = 5 as const;
export const BASELINE_SCHEMA_VERSION = 1 as const;

export type BaselineQuestionSnapshotBlocker =
  | 'frozen_content_invalid'
  | 'schema_version_invalid'
  | 'question_type_invalid'
  | 'prompt_missing_or_empty'
  | 'option_count_invalid'
  | 'option_identity_invalid'
  | 'option_identity_duplicate'
  | 'option_content_missing_or_empty'
  | 'correct_option_invalid'
  | 'max_score_invalid';

export interface BaselineQuestionSnapshotValidResult {
  type: 'baseline_question_snapshot_content_valid';
  schemaVersion: 1;
  questionType: 'MULTIPLE_CHOICE_SINGLE';
  optionCount: 5;
  correctOptionId: string;
  maxScore: number;
}

export interface BaselineQuestionSnapshotInvalidResult {
  type: 'invalid_content';
  blocker: BaselineQuestionSnapshotBlocker;
}

export type BaselineQuestionSnapshotValidationResult =
  | BaselineQuestionSnapshotValidResult
  | BaselineQuestionSnapshotInvalidResult;

/**
 * Meaningful JSON helper:
 * Meaningful:
 * - non-empty string (trimmed length > 0)
 * - finite number
 * - boolean
 * - non-empty array
 * - non-empty object
 * Not meaningful:
 * - null
 * - undefined
 * - empty/whitespace-only string
 * - empty array
 * - empty object
 */
export function isMeaningfulJson(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (typeof value === 'boolean') {
    return true;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === 'object') {
    return Object.keys(value).length > 0;
  }
  return false;
}

/**
 * Validates baseline question snapshot frozen_content against the V1 contract.
 *
 * Deterministic validation order (first blocker wins):
 * 1. frozen_content_invalid
 * 2. schema_version_invalid
 * 3. question_type_invalid
 * 4. prompt_missing_or_empty
 * 5. option_count_invalid
 * 6. option_identity_invalid
 * 7. option_identity_duplicate
 * 8. option_content_missing_or_empty
 * 9. correct_option_invalid
 * 10. max_score_invalid
 *
 * Input is NOT mutated.
 */
export function validateBaselineQuestionSnapshotFrozenContent(
  frozenContent: unknown
): BaselineQuestionSnapshotValidationResult {
  // 1. frozen_content_invalid
  if (
    typeof frozenContent !== 'object' ||
    frozenContent === null ||
    Array.isArray(frozenContent)
  ) {
    return {
      type: 'invalid_content',
      blocker: 'frozen_content_invalid',
    };
  }

  const record = frozenContent as Record<string, unknown>;

  // 2. schema_version_invalid
  if (record.schemaVersion !== 1) {
    return {
      type: 'invalid_content',
      blocker: 'schema_version_invalid',
    };
  }

  // 3. question_type_invalid
  if (record.questionType !== 'MULTIPLE_CHOICE_SINGLE') {
    return {
      type: 'invalid_content',
      blocker: 'question_type_invalid',
    };
  }

  // 4. prompt_missing_or_empty
  if (!isMeaningfulJson(record.prompt)) {
    return {
      type: 'invalid_content',
      blocker: 'prompt_missing_or_empty',
    };
  }

  // 5. option_count_invalid
  if (!Array.isArray(record.options) || record.options.length !== 5) {
    return {
      type: 'invalid_content',
      blocker: 'option_count_invalid',
    };
  }

  // 6. option_identity_invalid
  for (const opt of record.options) {
    if (
      typeof opt !== 'object' ||
      opt === null ||
      Array.isArray(opt) ||
      typeof (opt as Record<string, unknown>).id !== 'string' ||
      ((opt as Record<string, unknown>).id as string).trim().length === 0
    ) {
      return {
        type: 'invalid_content',
        blocker: 'option_identity_invalid',
      };
    }
  }

  // 7. option_identity_duplicate
  const optionIds = (record.options as Array<{ id: string }>).map((o) => o.id);
  const uniqueOptionIds = new Set(optionIds);
  if (uniqueOptionIds.size !== optionIds.length) {
    return {
      type: 'invalid_content',
      blocker: 'option_identity_duplicate',
    };
  }

  // 8. option_content_missing_or_empty
  for (const opt of record.options as Array<{ id: string; content?: unknown }>) {
    if (!isMeaningfulJson(opt.content)) {
      return {
        type: 'invalid_content',
        blocker: 'option_content_missing_or_empty',
      };
    }
  }

  // 9. correct_option_invalid
  if (
    typeof record.correctOptionId !== 'string' ||
    record.correctOptionId.trim().length === 0 ||
    !uniqueOptionIds.has(record.correctOptionId)
  ) {
    return {
      type: 'invalid_content',
      blocker: 'correct_option_invalid',
    };
  }

  // 10. max_score_invalid
  if (
    typeof record.maxScore !== 'number' ||
    !Number.isFinite(record.maxScore) ||
    record.maxScore <= 0
  ) {
    return {
      type: 'invalid_content',
      blocker: 'max_score_invalid',
    };
  }

  return {
    type: 'baseline_question_snapshot_content_valid',
    schemaVersion: 1,
    questionType: 'MULTIPLE_CHOICE_SINGLE',
    optionCount: 5,
    correctOptionId: record.correctOptionId,
    maxScore: record.maxScore,
  };
}
