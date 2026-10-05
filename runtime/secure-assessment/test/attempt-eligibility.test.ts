import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { evaluateStartEligibility, type ExamTimingRow } from '../src/attempt-eligibility.ts';

const NOW = new Date('2026-08-01T12:00:00Z');
const row = (over: Partial<ExamTimingRow> = {}): ExamTimingRow => ({
    lifecycle_state: 'ACTIVE',
    window_starts_at: new Date('2026-08-01T11:00:00Z'),
    window_ends_at: new Date('2026-08-01T14:00:00Z'),
    configured_attempt_duration_seconds: 3600,
    latest_start_policy: 'FULL_DURATION_BEYOND_WINDOW',
    ...over,
});

test('start eligibility', async (t) => {
    await t.test('only ACTIVE exams can be started', () => {
        for (const state of ['DRAFT', 'SCHEDULED', 'READY', 'FINALIZED', 'ARCHIVED']) {
            assert.deepEqual(evaluateStartEligibility(row({ lifecycle_state: state }), NOW), { eligible: false, reason: 'exam_not_active' });
        }
    });
    await t.test('PAUSED and ENDED stop new starts and say which applies', () => {
        assert.deepEqual(evaluateStartEligibility(row({ lifecycle_state: 'PAUSED' }), NOW), { eligible: false, reason: 'exam_paused' });
        assert.deepEqual(evaluateStartEligibility(row({ lifecycle_state: 'ENDED' }), NOW), { eligible: false, reason: 'exam_ended' });
    });
    await t.test('incomplete timing configuration is not startable', () => {
        assert.equal((evaluateStartEligibility(row({ window_starts_at: null }), NOW) as any).reason, 'exam_not_ready');
        assert.equal((evaluateStartEligibility(row({ configured_attempt_duration_seconds: null }), NOW) as any).reason, 'exam_not_ready');
        assert.equal((evaluateStartEligibility(row({ configured_attempt_duration_seconds: 0 }), NOW) as any).reason, 'exam_not_ready');
        assert.equal((evaluateStartEligibility(row({ latest_start_policy: null }), NOW) as any).reason, 'exam_not_ready');
        assert.equal((evaluateStartEligibility(row({ latest_start_policy: 'SOMETHING' }), NOW) as any).reason, 'exam_not_ready');
    });
    await t.test('window boundaries use server time; end is exclusive', () => {
        assert.equal((evaluateStartEligibility(row({ window_starts_at: new Date('2026-08-01T12:00:01Z') }), NOW) as any).reason, 'exam_not_open');
        assert.equal(evaluateStartEligibility(row({ window_starts_at: NOW }), NOW).eligible, true);
        assert.equal((evaluateStartEligibility(row({ window_ends_at: NOW }), NOW) as any).reason, 'exam_window_closed');
    });
    await t.test('FULL_DURATION_BEYOND_WINDOW keeps the full duration even near the end', () => {
        const r = evaluateStartEligibility(row({ window_ends_at: new Date('2026-08-01T12:05:00Z') }), NOW);
        assert.deepEqual(r, { eligible: true, effectiveDurationSeconds: 3600, policy: 'FULL_DURATION_BEYOND_WINDOW' });
    });
    await t.test('REMAINING_WINDOW_ONLY truncates to the remaining window', () => {
        const r = evaluateStartEligibility(row({ latest_start_policy: 'REMAINING_WINDOW_ONLY', window_ends_at: new Date('2026-08-01T12:05:00Z') }), NOW);
        assert.deepEqual(r, { eligible: true, effectiveDurationSeconds: 300, policy: 'REMAINING_WINDOW_ONLY' });
        const full = evaluateStartEligibility(row({ latest_start_policy: 'REMAINING_WINDOW_ONLY' }), NOW);
        assert.deepEqual(full, { eligible: true, effectiveDurationSeconds: 3600, policy: 'REMAINING_WINDOW_ONLY' });
    });
    await t.test('LATE_START_BLOCKED requires the full duration to fit', () => {
        assert.equal((evaluateStartEligibility(row({ latest_start_policy: 'LATE_START_BLOCKED', window_ends_at: new Date('2026-08-01T12:59:59Z') }), NOW) as any).reason, 'late_start_blocked');
        assert.equal(evaluateStartEligibility(row({ latest_start_policy: 'LATE_START_BLOCKED', window_ends_at: new Date('2026-08-01T13:00:00Z') }), NOW).eligible, true);
    });
    await t.test('string values from the database driver are accepted', () => {
        const r = evaluateStartEligibility(row({ window_starts_at: '2026-08-01T11:00:00Z', window_ends_at: '2026-08-01T14:00:00Z', configured_attempt_duration_seconds: '1800' }), NOW);
        assert.deepEqual(r, { eligible: true, effectiveDurationSeconds: 1800, policy: 'FULL_DURATION_BEYOND_WINDOW' });
    });
});
