import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  getMeContext,
  getSession,
  activate as activateRequest,
  login as loginRequest,
  logout as logoutRequest,
  type MeContext,
  type MembershipOption,
  type SessionInfo,
} from '../api/auth-client.ts';
import { getActiveTenantId, onUnauthorized, setActiveTenantId } from '../api/http.ts';

export type SessionPhase =
  | { kind: 'checking' }
  | { kind: 'unavailable' }
  | { kind: 'anonymous' }
  | { kind: 'no_membership'; session: SessionInfo }
  | { kind: 'selecting_tenant'; session: SessionInfo }
  | { kind: 'loading_context'; session: SessionInfo; tenantId: string }
  | { kind: 'ready'; session: SessionInfo; me: MeContext };

export interface SessionApi {
  phase: SessionPhase;
  /** True while a previously ready session has expired and re-authentication is pending. */
  expired: boolean;
  login(username: string, password: string): Promise<void>;
  /** First sign-in of a provisioned account with its activation code. */
  activate(username: string, activationCode: string, newPassword: string): Promise<void>;
  reauthenticate(username: string, password: string): Promise<void>;
  logout(): Promise<void>;
  selectTenant(tenantId: string): void;
  switchTenant(): void;
  retry(): void;
}

const SessionContext = createContext<SessionApi | null>(null);

export function useSession(): SessionApi {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}

/** For components that also render standalone (tests, embedded views). */
export function useOptionalSession(): SessionApi | null {
  return useContext(SessionContext);
}

function chooseTenant(memberships: MembershipOption[]): string | null {
  const stored = getActiveTenantId();
  if (stored && memberships.some(m => m.tenantId === stored)) return stored;
  if (memberships.length === 1) return memberships[0].tenantId;
  return null;
}

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [phase, setPhase] = useState<SessionPhase>({ kind: 'checking' });
  const [expired, setExpired] = useState(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const enterSession = useCallback(async (session: SessionInfo) => {
    if (session.memberships.length === 0) {
      setActiveTenantId(null);
      setPhase({ kind: 'no_membership', session });
      return;
    }
    const tenantId = chooseTenant(session.memberships);
    if (!tenantId) {
      setPhase({ kind: 'selecting_tenant', session });
      return;
    }
    setActiveTenantId(tenantId);
    setPhase({ kind: 'loading_context', session, tenantId });
    try {
      const me = await getMeContext();
      setPhase({ kind: 'ready', session, me });
    } catch {
      setPhase({ kind: 'unavailable' });
    }
  }, []);

  const check = useCallback(async () => {
    setPhase({ kind: 'checking' });
    try {
      const session = await getSession();
      if (!session) {
        setPhase({ kind: 'anonymous' });
        return;
      }
      await enterSession(session);
    } catch {
      setPhase({ kind: 'unavailable' });
    }
  }, [enterSession]);

  useEffect(() => {
    check();
  }, [check]);

  useEffect(() => onUnauthorized(() => {
    // Keep the current screen mounted (an exam in progress must not be torn down);
    // a blocking dialog asks for the password again.
    if (phaseRef.current.kind === 'ready') setExpired(true);
  }), []);

  const login = useCallback(async (username: string, password: string) => {
    const session = await loginRequest(username, password);
    setExpired(false);
    await enterSession(session);
  }, [enterSession]);

  const activate = useCallback(async (username: string, activationCode: string, newPassword: string) => {
    const session = await activateRequest(username, activationCode, newPassword);
    setExpired(false);
    await enterSession(session);
  }, [enterSession]);

  const reauthenticate = useCallback(async (username: string, password: string) => {
    const session = await loginRequest(username, password);
    const current = phaseRef.current;
    if (
      current.kind === 'ready' &&
      session.username !== null &&
      session.username === current.session.username &&
      session.memberships.some(m => m.tenantId === current.me.tenantId)
    ) {
      // Same account, same school: keep the mounted screen and its in-progress state.
      setPhase({ kind: 'ready', session, me: current.me });
      setExpired(false);
      return;
    }
    // A different account or lost membership: never carry the previous context (D02.2-21).
    setExpired(false);
    await enterSession(session);
  }, [enterSession]);

  const logout = useCallback(async () => {
    await logoutRequest();
    // Shared devices: the next person must not inherit this person's school choice.
    setActiveTenantId(null);
    setExpired(false);
    setPhase({ kind: 'anonymous' });
  }, []);

  const selectTenant = useCallback((tenantId: string) => {
    const current = phaseRef.current;
    if (current.kind !== 'selecting_tenant' && current.kind !== 'ready') return;
    const session = current.session;
    if (!session.memberships.some(m => m.tenantId === tenantId)) return;
    setActiveTenantId(tenantId);
    void enterSession(session);
  }, [enterSession]);

  const switchTenant = useCallback(() => {
    const current = phaseRef.current;
    if (current.kind !== 'ready' || current.session.memberships.length < 2) return;
    setActiveTenantId(null);
    setPhase({ kind: 'selecting_tenant', session: current.session });
  }, []);

  const api = useMemo<SessionApi>(() => ({
    phase, expired, login, activate, reauthenticate, logout, selectTenant, switchTenant, retry: check,
  }), [phase, expired, login, activate, reauthenticate, logout, selectTenant, switchTenant, check]);

  return <SessionContext.Provider value={api}>{children}</SessionContext.Provider>;
};
