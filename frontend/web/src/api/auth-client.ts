import { apiFetch } from './http.ts';

export interface MembershipOption {
  tenantId: string;
  displayLabel: string | null;
}

export interface SessionInfo {
  status: 'authenticated';
  /** The account's own ELLIGBLE ID, for display and same-account re-authentication. */
  username: string | null;
  expiresAt: string;
  memberships: MembershipOption[];
}

export interface WorkspaceCapabilities {
  examParticipant: boolean;
  proctor: boolean;
  teacher: boolean;
}

export interface MeContext {
  tenantId: string;
  tenantDisplayLabel: string | null;
  capabilities: WorkspaceCapabilities;
}

export type LoginFailure = 'invalid_credentials' | 'too_many_attempts' | 'invalid_request' | 'unavailable';

export class LoginError extends Error {
  readonly reason: LoginFailure;
  constructor(reason: LoginFailure) {
    super(reason);
    this.name = 'LoginError';
    this.reason = reason;
  }
}

export async function login(username: string, password: string): Promise<SessionInfo> {
  let res: Response;
  try {
    res = await apiFetch('/api/v1/auth/login', { method: 'POST', json: { username, password } });
  } catch {
    throw new LoginError('unavailable');
  }
  if (res.ok) return res.json() as Promise<SessionInfo>;
  if (res.status === 401) throw new LoginError('invalid_credentials');
  if (res.status === 429) throw new LoginError('too_many_attempts');
  if (res.status === 400) throw new LoginError('invalid_request');
  throw new LoginError('unavailable');
}

/** Returns null when there is no valid session (401). Throws on network/server failure. */
export async function getSession(): Promise<SessionInfo | null> {
  const res = await apiFetch('/api/v1/auth/session');
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`session_check_failed_${res.status}`);
  return res.json() as Promise<SessionInfo>;
}

export async function logout(): Promise<void> {
  try {
    await apiFetch('/api/v1/auth/logout', { method: 'POST' });
  } catch {
    // The cookie is cleared server-side when reachable; the UI signs out regardless.
  }
}

export async function getMeContext(): Promise<MeContext> {
  const res = await apiFetch('/api/v1/me/context');
  if (!res.ok) throw new Error(`me_context_failed_${res.status}`);
  return res.json() as Promise<MeContext>;
}
