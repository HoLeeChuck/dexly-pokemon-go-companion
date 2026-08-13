import { type AppEnv, securelyEqual } from './auth';
import { ApiError, requestId } from './http';

const LOCAL_BYPASS_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export type OwnerRateLimitEnv = Pick<AppEnv, 'APP_ACCESS_TOKEN'> &
  Partial<Pick<AppEnv, 'OWNER_AUTH_LIMITER' | 'OWNER_MUTATION_LIMITER'>>;

function isLoopback(request: Request): boolean {
  return LOCAL_BYPASS_HOSTS.has(new URL(request.url).hostname);
}

async function sha256Key(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function connectingKey(request: Request): string {
  // IP is a fallback for unauthenticated attempts. Authenticated mutations use a
  // token-derived key so legitimate owners remain stable across mobile networks.
  return request.headers.get('cf-connecting-ip') ?? 'unknown-client';
}

function bearerToken(request: Request): string {
  const authorization = request.headers.get('authorization') ?? '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
}

export async function enforceOwnerBoundary(
  request: Request,
  env: OwnerRateLimitEnv,
): Promise<void> {
  if (isLoopback(request)) return;

  const id = requestId(request);
  const token = bearerToken(request);
  const expected = env.APP_ACCESS_TOKEN;
  const authorized = Boolean(expected && token && (await securelyEqual(token, expected)));

  if (!authorized) {
    console.warn({
      event: 'owner_auth_failed',
      requestId: id,
      method: request.method,
      path: new URL(request.url).pathname,
    });
    if (!env.OWNER_AUTH_LIMITER) {
      throw new ApiError(
        503,
        'OWNER_RATE_LIMIT_NOT_CONFIGURED',
        'Private collection access is temporarily unavailable.',
      );
    }
    const outcome = await env.OWNER_AUTH_LIMITER.limit({
      key: `auth:${await sha256Key(connectingKey(request))}`,
    });
    if (!outcome.success) {
      console.warn({
        event: 'owner_auth_rate_limited',
        requestId: id,
        method: request.method,
        path: new URL(request.url).pathname,
      });
      throw new ApiError(429, 'RATE_LIMITED', 'Too many access attempts. Try again later.');
    }
  }

  if (authorized && request.method !== 'GET' && request.method !== 'HEAD') {
    if (!env.OWNER_MUTATION_LIMITER) {
      throw new ApiError(
        503,
        'OWNER_RATE_LIMIT_NOT_CONFIGURED',
        'Private collection changes are temporarily unavailable.',
      );
    }
    const outcome = await env.OWNER_MUTATION_LIMITER.limit({
      key: `mutation:${await sha256Key(token)}`,
    });
    if (!outcome.success) {
      console.warn({
        event: 'owner_mutation_rate_limited',
        requestId: id,
        method: request.method,
        path: new URL(request.url).pathname,
      });
      throw new ApiError(429, 'RATE_LIMITED', 'Too many collection changes. Try again shortly.');
    }
  }
}
