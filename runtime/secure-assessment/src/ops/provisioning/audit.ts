import { createHash, randomUUID } from 'node:crypto';
import type { ClientBase } from 'pg';

// Append-only provisioning audit (migration 0040): who (operator), why (case reference),
// what (action) and a count-only summary. Never personal data or activation codes.

export type ProvisioningAction = 'tenant_created' | 'people_imported' | 'activation_reissued' | 'academic_imported' | 'exam_imported';

export interface OperatorContext {
    operator: string;
    caseReference: string;
}

export function isValidOperatorContext(context: Partial<OperatorContext>): context is OperatorContext {
    const ok = (value: unknown) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 200;
    return ok(context.operator) && ok(context.caseReference);
}

export function sha256(...parts: string[]): string {
    const hash = createHash('sha256');
    for (const part of parts) hash.update(part).update('\0');
    return hash.digest('hex');
}

export async function recordProvisioningEvent(
    client: ClientBase,
    event: { tenantId: string | null; action: ProvisioningAction; context: OperatorContext; inputSha256: string | null; summary: Record<string, number | string> }
): Promise<string> {
    const batchId = randomUUID();
    await client.query(
        `INSERT INTO platform_provisioning_events (batch_id, tenant_id, operator_label, case_reference, action, input_sha256, summary)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [batchId, event.tenantId, event.context.operator.trim(), event.context.caseReference.trim(), event.action, event.inputSha256, JSON.stringify(event.summary)]
    );
    return batchId;
}
