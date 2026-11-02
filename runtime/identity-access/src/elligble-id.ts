import { randomBytes } from 'node:crypto';

export const ELLIGBLE_ID_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
export const GENERATED_ID_PATTERN = /^elg-[abcdefghjkmnpqrstuvwxyz23456789]{4}-[abcdefghjkmnpqrstuvwxyz23456789]{4}-[abcdefghjkmnpqrstuvwxyz23456789]{4}$/;
export const ID_COLLISION_LIMIT = 10;

/** Reserved generated-format keys fold ASCII case; legacy lookup itself stays exact. */
export function identifierKey(username: string): string {
    const folded = username.replace(/[A-Z]/g, c => c.toLowerCase());
    return GENERATED_ID_PATTERN.test(folded) ? folded : username;
}

/** Rejection sampling: 248 = 31 * 8, so every accepted symbol is equally likely. */
export function generateElligbleId(): string {
    let symbols = '';
    while (symbols.length < 12) {
        for (const byte of randomBytes(24)) {
            if (byte < 248) symbols += ELLIGBLE_ID_ALPHABET[byte % 31];
            if (symbols.length === 12) break;
        }
    }
    return `elg-${symbols.slice(0, 4)}-${symbols.slice(4, 8)}-${symbols.slice(8)}`;
}
