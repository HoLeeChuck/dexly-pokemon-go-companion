const PRIVATE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Cross-Origin-Opener-Policy': 'same-origin',
} as const;

const PUBLIC_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Cross-Origin-Opener-Policy': 'same-origin',
} as const;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function jsonResponse<T>(
  value: T,
  init: ResponseInit & { cache?: 'private' | 'public' } = {},
): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');

  if (init.cache === 'public') {
    if (!headers.has('Cache-Control')) {
      headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
    }
    for (const [name, content] of Object.entries(PUBLIC_HEADERS)) {
      headers.set(name, content);
    }
  } else {
    for (const [name, content] of Object.entries(PRIVATE_HEADERS)) {
      headers.set(name, content);
    }
  }

  return Response.json(value, { ...init, headers });
}

export function errorResponse(error: unknown, requestId: string): Response {
  if (error instanceof ApiError) {
    return jsonResponse(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          requestId,
        },
      },
      { status: error.status },
    );
  }

  console.error({
    event: 'api_unhandled_error',
    requestId,
    error: error instanceof Error ? error.message : String(error),
  });
  return jsonResponse(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong while handling this request.',
        requestId,
      },
    },
    { status: 500 },
  );
}

export async function readJsonObject(
  request: Request,
  maximumBytes = 128_000,
): Promise<Record<string, unknown>> {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.startsWith('application/json')) {
    throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Use application/json for this request.');
  }

  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > maximumBytes) {
    throw new ApiError(413, 'REQUEST_TOO_LARGE', 'The request body is too large.');
  }

  let text = '';
  if (request.body) {
    const reader = request.body.getReader();
    const decoder = new TextDecoder();
    let receivedBytes = 0;
    const chunks: string[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > maximumBytes) {
        await reader.cancel();
        throw new ApiError(413, 'REQUEST_TOO_LARGE', 'The request body is too large.');
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
    text = chunks.join('');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'The request body is not valid JSON.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ApiError(400, 'INVALID_BODY', 'The request body must be a JSON object.');
  }

  return parsed as Record<string, unknown>;
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  if (!origin) return;

  let requestOrigin: string;
  try {
    requestOrigin = new URL(request.url).origin;
  } catch {
    throw new ApiError(400, 'INVALID_REQUEST_URL', 'The request URL is invalid.');
  }

  if (origin !== requestOrigin) {
    throw new ApiError(
      403,
      'ORIGIN_NOT_ALLOWED',
      'Cross-origin collection changes are not allowed.',
    );
  }
}

export function requestId(request: Request): string {
  return request.headers.get('cf-ray') ?? crypto.randomUUID();
}

export function stringField(
  body: Record<string, unknown>,
  field: string,
  options: { min?: number; max?: number; pattern?: RegExp } = {},
): string {
  const value = body[field];
  if (typeof value !== 'string') {
    throw new ApiError(400, 'INVALID_FIELD', `${field} must be a string.`, { field });
  }

  const min = options.min ?? 1;
  const max = options.max ?? 500;
  if (
    value.length < min ||
    value.length > max ||
    (options.pattern && !options.pattern.test(value))
  ) {
    throw new ApiError(400, 'INVALID_FIELD', `${field} has an invalid value.`, { field });
  }
  return value;
}

export function booleanField(body: Record<string, unknown>, field: string): boolean {
  const value = body[field];
  if (typeof value !== 'boolean') {
    throw new ApiError(400, 'INVALID_FIELD', `${field} must be true or false.`, { field });
  }
  return value;
}

export function integerField(
  body: Record<string, unknown>,
  field: string,
  minimum: number,
  maximum: number,
): number {
  const value = body[field];
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new ApiError(
      400,
      'INVALID_FIELD',
      `${field} must be an integer from ${minimum} to ${maximum}.`,
      {
        field,
      },
    );
  }
  return value as number;
}
