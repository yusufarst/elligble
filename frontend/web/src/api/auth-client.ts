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

export type ActivationFailure = 'invalid_activation' | 'password_rejected' | 'invalid_request' | 'unavailable';
export type PasswordRejection = 'too_short' | 'too_long' | 'too_common' | 'contains_username';

export class ActivationError extends Error {
  readonly reason: ActivationFailure;
  readonly passwordRejection: PasswordRejection | null;
  constructor(reason: ActivationFailure, passwordRejection: PasswordRejection | null = null) {
    super(reason);
    this.name = 'ActivationError';
    this.reason = reason;
    this.passwordRejection = passwordRejection;
  }
}

/** First sign-in with a single-use activation code; the new password is the person's own. */
export async function activate(username: string, activationCode: string, newPassword: string): Promise<SessionInfo> {
  let res: Response;
  try {
    res = await apiFetch('/api/v1/auth/activate', { method: 'POST', json: { username, activationCode, newPassword } });
  } catch {
    throw new ActivationError('unavailable');
  }
  if (res.ok) return res.json() as Promise<SessionInfo>;
  if (res.status === 401) throw new ActivationError('invalid_activation');
  if (res.status === 400) {
    const body = await res.json().catch(() => null);
    if (body && body.error === 'password_rejected') {
      const reason = body.reason as PasswordRejection;
      throw new ActivationError('password_rejected', ['too_short', 'too_long', 'too_common', 'contains_username'].includes(reason) ? reason : 'too_common');
    }
    throw new ActivationError('invalid_request');
  }
  throw new ActivationError('unavailable');
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
