// Shared transport for every API call. The session credential travels only in the
// HttpOnly same-origin cookie (never readable here); the selected tenant is an explicit,
// non-secret locator sent as X-Tenant-ID and re-validated by the server on every request.

const TENANT_STORAGE_KEY = 'elligble.activeTenant';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let activeTenantId: string | null = readStoredTenant();
const unauthorizedListeners = new Set<() => void>();

function readStoredTenant(): string | null {
  try {
    const value = window.localStorage.getItem(TENANT_STORAGE_KEY);
    return value && UUID_REGEX.test(value) ? value : null;
  } catch {
    return null;
  }
}

export function getActiveTenantId(): string | null {
  return activeTenantId;
}

export function setActiveTenantId(tenantId: string | null): void {
  activeTenantId = tenantId && UUID_REGEX.test(tenantId) ? tenantId : null;
  try {
    if (activeTenantId) window.localStorage.setItem(TENANT_STORAGE_KEY, activeTenantId);
    else window.localStorage.removeItem(TENANT_STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode): the choice lasts for this page only.
  }
}

/** Called whenever the server reports 401, so the UI can ask for re-authentication. */
export function onUnauthorized(listener: () => void): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

export async function apiFetch(url: string, init: RequestInit & { json?: unknown } = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (activeTenantId && !headers.has('X-Tenant-ID')) {
    headers.set('X-Tenant-ID', activeTenantId);
  }
  let body = init.body;
  if (init.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(init.json);
  }
  const { json: _json, ...rest } = init;
  const res = await fetch(url, { ...rest, body, headers, credentials: 'same-origin' });
  if (res.status === 401 && !url.startsWith('/api/v1/auth/')) {
    unauthorizedListeners.forEach(listener => listener());
  }
  return res;
}
