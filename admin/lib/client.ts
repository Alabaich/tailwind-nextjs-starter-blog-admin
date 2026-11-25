// Browser-side helpers shared by the client components.

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
}

/** fetch wrapper that never throws and always yields a displayable error. */
export async function api<T = unknown>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, { cache: 'no-store', ...init });
    const body: unknown = await res.json().catch(() => null);
    if (res.status === 401 && !url.endsWith('/api/login')) {
      // Session expired: send the user to the login page.
      window.location.assign('/login');
    }
    const error =
      !res.ok && body && typeof body === 'object' && 'error' in body
        ? String((body as { error: unknown }).error)
        : null;
    return {
      ok: res.ok,
      status: res.status,
      data: res.ok ? (body as T) : null,
      error: res.ok ? null : (error ?? `Request failed (${res.status})`),
    };
  } catch {
    return { ok: false, status: 0, data: null, error: 'Network error. Is the admin still running?' };
  }
}

export function postJson<T = unknown>(url: string, method: 'POST' | 'PUT', body: unknown) {
  return api<T>(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Tells the deploy rail that files on disk changed, so it re-checks at once. */
export const CONTENT_CHANGED = 'bg:content-changed';

export function notifyContentChanged(): void {
  window.dispatchEvent(new Event(CONTENT_CHANGED));
}

export function timeAgo(iso: string, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} d ago`;
}
