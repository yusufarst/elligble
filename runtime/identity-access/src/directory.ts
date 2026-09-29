import type { ClientBase } from 'pg';

// Read-only identity lookups for other domains' read models. The ELLIGBLE ID is the
// stable, non-secret identifier a person signs in with (D02.3-03); a read model shows it
// where the person must be recognizable (a teacher's results list), never credentials.
// Runs on the caller's client so it reads the same snapshot as the caller's transaction.

/** ELLIGBLE ID per person; people without an account are absent from the map. */
export async function listElligbleIds(client: ClientBase, personIds: readonly string[]): Promise<Map<string, string>> {
    if (personIds.length === 0) return new Map();
    const res = await client.query(
        `SELECT DISTINCT ON (a.person_id) a.person_id, c.username
         FROM identity_user_accounts a
         JOIN identity_account_credentials c ON c.user_account_id = a.id
         WHERE a.person_id = ANY($1::uuid[])
         ORDER BY a.person_id, c.username`,
        [personIds]
    );
    return new Map(res.rows.map(row => [row.person_id as string, row.username as string]));
}
