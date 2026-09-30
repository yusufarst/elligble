import type * as http from 'node:http';
import { parseCookies } from './http-utils.ts';

// Browser session transport. The credential is `<sessionId>.<secret>` issued by the
// Identity runtime (BU-088). Browsers receive it only as an HttpOnly, SameSite=Strict
// cookie so page scripts can never read it; non-browser clients may present the same
// credential in `Authorization: ELLIGBLE-Session <sessionId>.<secret>` (BU-090).

export interface SessionCookieConfig {
    secure: boolean;
}

export interface SessionCredential {
    sessionId: string;
    secret: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SECRET_REGEX = /^[A-Za-z0-9_-]{16,128}$/;
const AUTH_SCHEME = 'ELLIGBLE-Session ';

export function sessionCookieName(config: SessionCookieConfig): string {
    return config.secure ? '__Host-elligble_session' : 'elligble_session';
}

function parseCredential(token: string): SessionCredential | null {
    const parts = token.split('.');
    if (parts.length !== 2 || !UUID_REGEX.test(parts[0]) || !SECRET_REGEX.test(parts[1])) {
        return null;
    }
    return { sessionId: parts[0], secret: parts[1] };
}

export type CredentialLookup =
    | { kind: 'none' }
    | { kind: 'malformed' }
    | { kind: 'present'; credential: SessionCredential; source: 'header' | 'cookie' };

/** Header credentials take precedence over cookies so explicit API clients are unambiguous. */
export function readSessionCredential(req: http.IncomingMessage, config: SessionCookieConfig | null): CredentialLookup {
    const authHeader = req.headers['authorization'];
    if (authHeader !== undefined) {
        if (typeof authHeader !== 'string' || !authHeader.startsWith(AUTH_SCHEME)) {
            return { kind: 'malformed' };
        }
        const credential = parseCredential(authHeader.substring(AUTH_SCHEME.length).trim());
        return credential ? { kind: 'present', credential, source: 'header' } : { kind: 'malformed' };
    }
    if (!config) return { kind: 'none' };
    const raw = parseCookies(req.headers['cookie']).get(sessionCookieName(config));
    if (raw === undefined || raw === '') return { kind: 'none' };
    const credential = parseCredential(raw);
    return credential ? { kind: 'present', credential, source: 'cookie' } : { kind: 'malformed' };
}

export function buildSessionCookie(config: SessionCookieConfig, credential: SessionCredential, expiresAt: Date, now: Date = new Date()): string {
    const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
    const attributes = [
        `${sessionCookieName(config)}=${credential.sessionId}.${credential.secret}`,
        'Path=/',
        `Max-Age=${maxAge}`,
        'HttpOnly',
        'SameSite=Strict',
    ];
    if (config.secure) attributes.push('Secure');
    return attributes.join('; ');
}

export function buildClearedSessionCookie(config: SessionCookieConfig): string {
    const attributes = [`${sessionCookieName(config)}=`, 'Path=/', 'Max-Age=0', 'HttpOnly', 'SameSite=Strict'];
    if (config.secure) attributes.push('Secure');
    return attributes.join('; ');
}
