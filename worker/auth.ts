import { ApiError } from './http';

export interface AppEnv {
  DB: D1Database;
  /** Production secret set with `wrangler secret put APP_ACCESS_TOKEN`. */
  APP_ACCESS_TOKEN?: string;
}

export interface Actor {
  userId: string;
  profileId: string;
  mode: 'local' | 'token';
}

const LOCAL_ACTOR: Actor = {
  userId: 'user:local-development',
  profileId: 'profile:local-development',
  mode: 'local',
};

function isLoopback(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

async function securelyEqual(actual: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [actualHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(actual)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const left = new Uint8Array(actualHash);
  const right = new Uint8Array(expectedHash);
  let different = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    different |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return different === 0;
}

export async function resolveActor(request: Request, env: AppEnv): Promise<Actor> {
  const hostname = new URL(request.url).hostname;
  if (isLoopback(hostname)) return LOCAL_ACTOR;

  if (!env.APP_ACCESS_TOKEN) {
    throw new ApiError(
      503,
      'PRIVATE_API_NOT_CONFIGURED',
      'Private collection access is locked until an application access token is configured.',
    );
  }

  const authorization = request.headers.get('authorization') ?? '';
  const provided = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!provided || !(await securelyEqual(provided, env.APP_ACCESS_TOKEN))) {
    throw new ApiError(401, 'AUTH_REQUIRED', 'Enter the collection access key to continue.');
  }

  return { ...LOCAL_ACTOR, mode: 'token' };
}
