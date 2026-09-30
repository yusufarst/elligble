// Readiness is evaluated while an exam is SCHEDULED (to become READY) and again while it
// is READY: D04.2-25 (READY must be re-evaluated after high-impact changes) and D04.2-68
// (activation requires a final readiness check).
export const READINESS_EVALUABLE_STATES: ReadonlySet<string> = new Set(['SCHEDULED', 'READY']);

export function isReadinessEvaluableState(state: unknown): boolean {
    return typeof state === 'string' && READINESS_EVALUABLE_STATES.has(state);
}
