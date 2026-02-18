/**
 * Backend API base URL.
 * In production, set NEXT_PUBLIC_API_URL to your backend (e.g. Railway URL).
 * When admin is served from same origin as API, leave unset to use relative URLs.
 */
export function getApiUrl(): string {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || '';
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
}

export async function fetchApi<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const base = getApiUrl();
  const url = base ? `${base.replace(/\/$/, '')}${path}` : path;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message || `API ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface BillingStatus {
  subscribed: boolean;
  upgradeUrl?: string;
  error?: string;
}

export async function getBillingStatus(shop: string): Promise<BillingStatus> {
  return fetchApi<BillingStatus>(
    `/api/billing/status?shop=${encodeURIComponent(shop)}`,
  );
}
