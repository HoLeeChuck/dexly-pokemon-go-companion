export interface ErrorEnvelope {
  error?: { code?: string; message?: string; details?: unknown; requestId?: string };
}

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

const ACCESS_TOKEN_KEY = 'dexly:access-token';
export function storedAccessToken(): string {
  try {
    return globalThis.sessionStorage?.getItem(ACCESS_TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}
export function saveAccessToken(value: string): void {
  try {
    if (value) globalThis.sessionStorage?.setItem(ACCESS_TOKEN_KEY, value);
    else globalThis.sessionStorage?.removeItem(ACCESS_TOKEN_KEY);
  } catch {
    /* Hardened/private environments may reject Storage operations. */
  }
}

export async function requestJson<T>(
  path: string,
  init: RequestInit = {},
  token = storedAccessToken(),
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  let response: Response;
  try {
    response = await fetch(path, { ...init, headers });
  } catch {
    throw new ApiClientError(
      0,
      'NETWORK_ERROR',
      'CatchGrid could not reach the local collection service. Your collection was not changed.',
    );
  }
  if (!response.ok) {
    let envelope: ErrorEnvelope = {};
    try {
      envelope = (await response.json()) as ErrorEnvelope;
    } catch {
      /* stable fallback below */
    }
    throw new ApiClientError(
      response.status,
      envelope.error?.code ?? 'REQUEST_FAILED',
      envelope.error?.message ?? `The request failed with status ${response.status}.`,
      envelope.error?.details,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
