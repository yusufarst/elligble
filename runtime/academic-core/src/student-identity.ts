import type { ClientBase } from 'pg';
import { ensureStudentEnrollment, enrollmentSlotKey, isIsoDate } from './provisioning.ts';

// AUTH-002 Academic-owned roster matching, effective identity binding and compatible
// enrollment (record §5/§6A). Matching is exact on own-tenant NISN + date of birth with a
// deterministic name confirmation; nothing here is a similarity score or a global lookup.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function requireUuid(...values: string[]): void {
    if (!values.every(v => typeof v === 'string' && UUID.test(v))) throw new Error('Invalid academic scope');
}

/** §6A.7: Unicode NFC, trim, collapse internal whitespace, case-fold, then exact equality. */
export function normalizeClaimName(value: string): string {
    return value.normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase();
}

export function claimNamesMatch(submitted: string, recorded: string): boolean {
    return normalizeClaimName(submitted) === normalizeClaimName(recorded);
}

/** Bounded claim matching fields; NISN keeps leading zeros, no numeric coercion. */
export function isClaimNisn(value: unknown): value is string {
    return typeof value === 'string' && value.length >= 1 && value.length <= 64 && value.trim() === value && !/[\u0000-\u001f\u007f]/u.test(value);
}
export function isClaimName(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length >= 1 && [...value].length <= 200 && !/[\u0000-\u001f\u007f]/u.test(value);
}
export const isClaimBirthDate = (value: unknown): value is string => isIsoDate(value);

export interface RosterIdentity {
    id: string; tenantId: string; revision: number; fullName: string;
    academicYearId: string; academicPeriodId: string; academicGroupId: string; groupLabel: string | null;
    /** 0056 person_id or the AUTH-002 binding; null when unbound. */
    personId: string | null;
}

const ROSTER_SELECT = `SELECT r.id, r.tenant_id, r.revision, r.full_name, r.academic_year_id, r.academic_period_id, r.academic_group_id,
        g.display_label AS group_label, r.person_id AS recorded_person, b.person_id AS bound_person
    FROM academic_core_student_roster_records r
    LEFT JOIN academic_core_roster_identity_bindings b ON b.roster_id = r.id AND b.tenant_id = r.tenant_id
    LEFT JOIN academic_core_academic_groups g ON g.id = r.academic_group_id AND g.tenant_id = r.tenant_id`;

function toRoster(row: Record<string, unknown>): RosterIdentity {
    const recorded = (row.recorded_person as string | null) ?? null, bound = (row.bound_person as string | null) ?? null;
    if (recorded && bound && recorded !== bound) throw new Error('Roster identity disagreement');
    return {
        id: row.id as string, tenantId: row.tenant_id as string, revision: Number(row.revision), fullName: row.full_name as string,
        academicYearId: row.academic_year_id as string, academicPeriodId: row.academic_period_id as string,
        academicGroupId: row.academic_group_id as string, groupLabel: (row.group_label as string | null) ?? null,
        personId: recorded ?? bound,
    };
}

/** Own-tenant exact NISN + date of birth match; at most one record by the 0056 constraint. */
export async function matchRosterForClaim(client: ClientBase, tenantId: string, nisn: string, birth: string): Promise<RosterIdentity | null> {
    requireUuid(tenantId);
    const r = await client.query(`${ROSTER_SELECT} WHERE r.tenant_id = $1 AND r.nisn = $2 AND r.date_of_birth = $3::date`,
        [tenantId.toLowerCase(), nisn, birth]);
    return r.rows.length === 1 ? toRoster(r.rows[0]) : null;
}

/** Current roster identity; `lock` takes the roster row FOR UPDATE (last in the §6A.3 order). */
export async function readRosterIdentity(client: ClientBase, tenantId: string, rosterId: string, lock = false): Promise<RosterIdentity | null> {
    requireUuid(tenantId, rosterId);
    const r = await client.query(`${ROSTER_SELECT} WHERE r.id = $1 AND r.tenant_id = $2 ${lock ? 'FOR UPDATE OF r' : ''}`,
        [rosterId.toLowerCase(), tenantId.toLowerCase()]);
    return r.rows.length === 1 ? toRoster(r.rows[0]) : null;
}

/** Current roster records of a tenant inside the given group/period scopes (Homeroom queue). */
export async function rosterIdsInScope(client: ClientBase, tenantId: string, scopes: ReadonlyArray<{ academicGroupId: string; academicPeriodId: string }>): Promise<string[]> {
    requireUuid(tenantId, ...scopes.flatMap(s => [s.academicGroupId, s.academicPeriodId]));
    if (!scopes.length) return [];
    const r = await client.query(`SELECT r.id FROM academic_core_student_roster_records r
        JOIN unnest($2::uuid[], $3::uuid[]) AS s(group_id, period_id) ON s.group_id = r.academic_group_id AND s.period_id = r.academic_period_id
        WHERE r.tenant_id = $1 ORDER BY r.id`,
        [tenantId.toLowerCase(), scopes.map(s => s.academicGroupId.toLowerCase()), scopes.map(s => s.academicPeriodId.toLowerCase())]);
    return r.rows.map(row => row.id as string);
}

/** Does the claim's submitted NISN/date/name still match this current roster record exactly? */
export async function rosterStillMatches(client: ClientBase, roster: RosterIdentity, submitted: { nisn: string; birth: string; name: string }): Promise<boolean> {
    const r = await client.query(`SELECT 1 FROM academic_core_student_roster_records WHERE id = $1 AND tenant_id = $2 AND nisn = $3 AND date_of_birth = $4::date`,
        [roster.id, roster.tenantId, submitted.nisn, submitted.birth]);
    return r.rows.length === 1 && claimNamesMatch(submitted.name, roster.fullName);
}

/** Roster records of one tenant bound to a Person through 0056 or the binding table. */
export async function rosterRecordsBoundToPerson(client: ClientBase, tenantId: string, personId: string): Promise<string[]> {
    requireUuid(tenantId, personId);
    const r = await client.query(`SELECT id FROM academic_core_student_roster_records WHERE tenant_id = $1 AND person_id = $2
        UNION SELECT roster_id FROM academic_core_roster_identity_bindings WHERE tenant_id = $1 AND person_id = $2`,
        [tenantId.toLowerCase(), personId.toLowerCase()]);
    return r.rows.map(row => row.id as string);
}

export interface RosterBindingInput {
    tenantId: string; rosterId: string; personId: string; claimId: string; decidedByPersonId: string; decisionEventId: string;
}

/** Append-only first binding; the caller holds the roster-tenant fence and the roster row lock. */
export async function bindRosterIdentity(client: ClientBase, input: RosterBindingInput): Promise<void> {
    requireUuid(input.tenantId, input.rosterId, input.personId, input.claimId, input.decidedByPersonId, input.decisionEventId);
    await client.query(`INSERT INTO academic_core_roster_identity_bindings(tenant_id, roster_id, person_id, claim_id, decided_by_person_id, decision_event_id)
        VALUES($1,$2,$3,$4,$5,$6)`, [input.tenantId.toLowerCase(), input.rosterId.toLowerCase(), input.personId.toLowerCase(),
        input.claimId.toLowerCase(), input.decidedByPersonId.toLowerCase(), input.decisionEventId]);
}

/** Enrollment-slot key of a claim approval, from the shared canonical helper. */
export function claimEnrollmentSlot(roster: RosterIdentity, membershipId: string): string {
    return enrollmentSlotKey(roster.tenantId, membershipId, roster.academicPeriodId);
}

/** Open enrollments of the membership in the roster period; read after the slot lock. */
export async function claimEnrollmentState(client: ClientBase, roster: RosterIdentity, membershipId: string): Promise<{ compatible: boolean; enrolled: boolean }> {
    requireUuid(membershipId);
    const r = await client.query(`SELECT academic_group_id FROM academic_core_student_enrollments
        WHERE tenant_id = $1 AND membership_id = $2 AND academic_period_id = $3 AND end_date IS NULL`,
        [roster.tenantId, membershipId.toLowerCase(), roster.academicPeriodId]);
    return { compatible: r.rows.length <= 1 && r.rows.every(x => x.academic_group_id === roster.academicGroupId), enrolled: r.rows.length === 1 };
}

/** Compatible enrollment through the existing writer; start date is the school-local approval date. */
export async function ensureClaimEnrollment(client: ClientBase, roster: RosterIdentity, membershipId: string, startDate: string): Promise<{ id: string; created: boolean }> {
    if (!isIsoDate(startDate)) throw new Error('Invalid enrollment date');
    return ensureStudentEnrollment(client, roster.tenantId, {
        academicYearId: roster.academicYearId, academicPeriodId: roster.academicPeriodId, academicGroupId: roster.academicGroupId,
        membershipId, startDate, source: 'student_claim',
    });
}

/** Academic staff responsibilities of a Person in any tenant and any state (§6A.1 N1). */
export async function personHasAcademicStaffRole(client: ClientBase, personId: string): Promise<boolean> {
    requireUuid(personId);
    const r = await client.query(`SELECT EXISTS (SELECT 1 FROM academic_core_teaching_assignments ata
            JOIN tenant_teacher_assignments tta ON tta.id = ata.teacher_assignment_id AND tta.tenant_id = ata.tenant_id
            JOIN tenant_memberships m ON m.id = tta.membership_id AND m.tenant_id = tta.tenant_id WHERE m.person_id = $1)
        OR EXISTS (SELECT 1 FROM academic_core_homeroom_responsibilities h
            JOIN tenant_memberships m ON m.id = h.membership_id AND m.tenant_id = h.tenant_id WHERE m.person_id = $1) AS staff`,
        [personId.toLowerCase()]);
    return r.rows[0]?.staff === true;
}
