import {
  CATEGORY_IDS,
  TRADE_OFFER_TRAIT_IDS,
  TRADE_REQUEST_TRAIT_IDS,
  type CategoryId,
  type TradeOfferTrait,
  type TradeRequestTrait,
} from '../shared/types';
import { type AppEnv, resolveActor } from './auth';
import {
  ApiError,
  assertSameOrigin,
  booleanField,
  errorResponse,
  integerField,
  jsonResponse,
  readJsonObject,
  requestId,
  stringField,
} from './http';
import { applyImport, previewImport } from './imports';
import { enforceOwnerBoundary } from './rateLimit';
import {
  addTradeSpecimen,
  deleteTradeSpecimen,
  getBootstrap,
  getCollectionRevision,
  getPublicCatalog,
  setCollectionEntry,
  setWantedEntry,
  undoMutation,
} from './repository';

const FORM_ID_PATTERN = /^form-[a-z0-9-]{3,80}$/;
const OPERATION_ID_PATTERN = /^[a-zA-Z0-9:_-]{8,120}$/;
const MUTATION_ID_PATTERN = /^mutation:[0-9a-f-]{36}$/;
const TRADE_ID_PATTERN = /^trade:[0-9a-f-]{36}$/;
const PUBLIC_CATALOG_CACHE_CONTROL =
  'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';

function releaseMetadata(env: AppEnv) {
  const gitSha =
    typeof __BUILD_SHA__ === 'undefined' || !__BUILD_SHA__
      ? env.BUILD_SHA || 'development'
      : __BUILD_SHA__;
  const buildTime =
    typeof __BUILD_TIME__ === 'undefined' || !__BUILD_TIME__
      ? env.BUILD_TIME || null
      : __BUILD_TIME__;
  const environment =
    typeof __BUILD_ENVIRONMENT__ === 'undefined' || !__BUILD_ENVIRONMENT__
      ? env.ENVIRONMENT || 'development'
      : __BUILD_ENVIRONMENT__;
  return {
    gitSha,
    buildTime,
    environment,
    workerVersionId: env.CF_VERSION_METADATA.id,
    workerVersionTag: env.CF_VERSION_METADATA.tag,
    workerVersionTime: env.CF_VERSION_METADATA.timestamp,
  };
}

function headResponse(response: Response): Response {
  return new Response(null, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

function publicCatalogCacheKey(request: Request, env: AppEnv): Request {
  const url = new URL(request.url);
  url.pathname = '/api/v1/catalog';
  // A deployment that changes catalog data receives a new cache namespace without
  // putting an implementation-only version parameter in the public response URL.
  url.search = new URLSearchParams({ release: env.CF_VERSION_METADATA.id }).toString();
  return new Request(url.toString(), { method: 'GET' });
}

function categoryField(body: Record<string, unknown>): CategoryId {
  const value = body.categoryId;
  if (typeof value !== 'string' || !CATEGORY_IDS.includes(value as CategoryId)) {
    throw new ApiError(
      400,
      'INVALID_CATEGORY',
      'categoryId is not a supported collection category.',
    );
  }
  return value as CategoryId;
}

function tradeRequestTraitField(body: Record<string, unknown>): TradeRequestTrait {
  const value = body.traitId;
  if (typeof value !== 'string' || !TRADE_REQUEST_TRAIT_IDS.includes(value as TradeRequestTrait)) {
    throw new ApiError(400, 'INVALID_TRADE_TRAIT', 'traitId is not a supported trade request.');
  }
  return value as TradeRequestTrait;
}

function expectedRevisionField(body: Record<string, unknown>): number | undefined {
  const value = body.expectedRevision;
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new ApiError(400, 'INVALID_FIELD', 'expectedRevision must be a non-negative integer.');
  }
  return value as number;
}

async function handleApi(request: Request, env: AppEnv, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  let path: string;
  try {
    path = decodeURIComponent(url.pathname).replace(/\/$/, '') || '/';
  } catch {
    throw new ApiError(400, 'INVALID_REQUEST_PATH', 'The request path contains invalid encoding.');
  }

  if ((request.method === 'GET' || request.method === 'HEAD') && path === '/api/health') {
    const response = jsonResponse(
      {
        ok: true,
        service: 'catchgrid',
        runtime: 'cloudflare-workers',
        ...releaseMetadata(env),
      },
      { cache: 'public', headers: { 'Cache-Control': 'no-store' } },
    );
    return request.method === 'HEAD' ? headResponse(response) : response;
  }

  if ((request.method === 'GET' || request.method === 'HEAD') && path === '/api/ready') {
    let catalogVersion = 'unknown';
    let ready = false;
    try {
      const database = await env.DB.prepare(
        `SELECT
           (SELECT version FROM catalog_versions ORDER BY imported_at DESC LIMIT 1) AS catalog_version,
           1 AS ok`,
      ).first<{ catalog_version: string | null; ok: number }>();
      catalogVersion = database?.catalog_version ?? 'unknown';
      ready = database?.ok === 1 && catalogVersion !== 'unknown';
    } catch (error) {
      console.error({
        event: 'readiness_check_failed',
        requestId: requestId(request),
        error: error instanceof Error ? error.message : String(error),
      });
    }
    const response = jsonResponse(
      {
        ok: ready,
        service: 'catchgrid',
        database: ready ? 'ready' : 'unavailable',
        catalogVersion,
        ...releaseMetadata(env),
      },
      { status: ready ? 200 : 503 },
    );
    return request.method === 'HEAD' ? headResponse(response) : response;
  }

  if (
    (request.method === 'GET' || request.method === 'HEAD') &&
    path === '/api/v1/catalog/version'
  ) {
    const row = await env.DB.prepare(
      'SELECT version, imported_at FROM catalog_versions ORDER BY imported_at DESC LIMIT 1',
    ).first<{ version: string; imported_at: string }>();
    if (!row) throw new ApiError(503, 'CATALOG_NOT_READY', 'The catalog is not available yet.');
    const response = jsonResponse(
      { catalogVersion: row.version, importedAt: row.imported_at },
      {
        cache: 'public',
        headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' },
      },
    );
    return request.method === 'HEAD' ? headResponse(response) : response;
  }

  if ((request.method === 'GET' || request.method === 'HEAD') && path === '/api/v1/catalog') {
    const cacheKey = publicCatalogCacheKey(request, env);
    const cached = await caches.default.match(cacheKey);
    if (cached) {
      console.log({
        event: 'catalog_cache',
        requestId: requestId(request),
        method: request.method,
        outcome: 'hit',
        workerVersionId: env.CF_VERSION_METADATA.id,
      });
      const headers = new Headers(cached.headers);
      headers.set('X-CatchGrid-Cache', 'HIT');
      const cachedResponse = new Response(cached.body, { status: cached.status, headers });
      return request.method === 'HEAD' ? headResponse(cachedResponse) : cachedResponse;
    }

    const payload = await getPublicCatalog(env.DB);
    const response = jsonResponse(payload, {
      cache: 'public',
      headers: {
        'Cache-Control': PUBLIC_CATALOG_CACHE_CONTROL,
        ETag: `"catalog-${payload.catalogVersion}"`,
        'X-CatchGrid-Cache': 'MISS',
      },
    });
    console.log({
      event: 'catalog_cache',
      requestId: requestId(request),
      method: request.method,
      outcome: 'miss',
      workerVersionId: env.CF_VERSION_METADATA.id,
    });
    ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
    return request.method === 'HEAD' ? headResponse(response) : response;
  }

  await enforceOwnerBoundary(request, env);
  const actor = await resolveActor(request, env);

  if (request.method === 'GET' && path === '/api/v1/bootstrap') {
    const payload = await getBootstrap(env.DB, actor.profileId);
    const revision = await getCollectionRevision(env.DB, actor.profileId);
    return jsonResponse({ ...payload, revision, authMode: actor.mode });
  }

  if (request.method === 'PUT' && path === '/api/v1/collection') {
    assertSameOrigin(request);
    const body = await readJsonObject(request);
    const result = await setCollectionEntry(env.DB, actor.profileId, {
      formId: stringField(body, 'formId', { min: 8, max: 90, pattern: FORM_ID_PATTERN }),
      categoryId: categoryField(body),
      collected: booleanField(body, 'collected'),
      operationId: stringField(body, 'operationId', {
        min: 8,
        max: 120,
        pattern: OPERATION_ID_PATTERN,
      }),
      expectedRevision: expectedRevisionField(body),
    });
    return jsonResponse(result);
  }

  const undoMatch = path.match(/^\/api\/v1\/mutations\/(mutation:[0-9a-f-]{36})\/undo$/);
  if (request.method === 'POST' && undoMatch) {
    assertSameOrigin(request);
    const batchId = undoMatch[1];
    if (!batchId || !MUTATION_ID_PATTERN.test(batchId)) {
      throw new ApiError(400, 'INVALID_MUTATION_ID', 'The mutation identifier is invalid.');
    }
    return jsonResponse(await undoMutation(env.DB, actor.profileId, batchId));
  }

  if (request.method === 'PUT' && path === '/api/v1/wanted') {
    assertSameOrigin(request);
    const body = await readJsonObject(request);
    return jsonResponse(
      await setWantedEntry(
        env.DB,
        actor.profileId,
        stringField(body, 'formId', { min: 8, max: 90, pattern: FORM_ID_PATTERN }),
        tradeRequestTraitField(body),
        booleanField(body, 'wanted'),
      ),
    );
  }

  if (request.method === 'POST' && path === '/api/v1/imports/preview') {
    assertSameOrigin(request);
    const body = await readJsonObject(request, 1_100_000);
    const csv = stringField(body, 'csv', { min: 1, max: 512_000 });
    const sourceName = stringField(body, 'sourceName', { min: 1, max: 255 });
    const policyValue = body.policy;
    if (policyValue !== 'merge' && policyValue !== 'update' && policyValue !== 'replace') {
      throw new ApiError(400, 'INVALID_IMPORT_POLICY', 'policy must be merge, update, or replace.');
    }
    return jsonResponse(
      await previewImport(env.DB, actor.profileId, { csv, sourceName, policy: policyValue }),
    );
  }

  const importApplyMatch = path.match(/^\/api\/v1\/imports\/(import:[0-9a-f-]{36})\/apply$/);
  if (request.method === 'POST' && importApplyMatch) {
    assertSameOrigin(request);
    const jobId = importApplyMatch[1];
    if (!jobId) throw new ApiError(400, 'INVALID_IMPORT_ID', 'The import identifier is invalid.');
    return jsonResponse(await applyImport(env.DB, actor.profileId, jobId));
  }

  if (request.method === 'POST' && path === '/api/v1/trades') {
    assertSameOrigin(request);
    const body = await readJsonObject(request);
    const traitsValue = body.traits;
    if (
      !Array.isArray(traitsValue) ||
      traitsValue.length > TRADE_OFFER_TRAIT_IDS.length ||
      traitsValue.some(
        (trait) =>
          typeof trait !== 'string' || !TRADE_OFFER_TRAIT_IDS.includes(trait as TradeOfferTrait),
      )
    ) {
      throw new ApiError(
        400,
        'INVALID_TRAITS',
        'traits may contain only shiny, XXL, XXS, or costume.',
      );
    }
    const traits = [...new Set(traitsValue as TradeOfferTrait[])];
    const notesValue = body.notes ?? '';
    if (typeof notesValue !== 'string' || notesValue.length > 1000) {
      throw new ApiError(400, 'INVALID_FIELD', 'notes must be 1,000 characters or fewer.');
    }
    return jsonResponse(
      await addTradeSpecimen(env.DB, actor.profileId, {
        formId: stringField(body, 'formId', { min: 8, max: 90, pattern: FORM_ID_PATTERN }),
        traits,
        quantity: integerField(body, 'quantity', 1, 999),
        notes: notesValue,
      }),
      { status: 201 },
    );
  }

  const tradeMatch = path.match(/^\/api\/v1\/trades\/(trade:[0-9a-f-]{36})$/);
  if (request.method === 'DELETE' && tradeMatch) {
    assertSameOrigin(request);
    const tradeId = tradeMatch[1];
    if (!tradeId || !TRADE_ID_PATTERN.test(tradeId)) {
      throw new ApiError(400, 'INVALID_TRADE_ID', 'The trade identifier is invalid.');
    }
    await deleteTradeSpecimen(env.DB, actor.profileId, tradeId);
    return new Response(null, {
      status: 204,
      headers: {
        'Cache-Control': 'no-store',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Referrer-Policy': 'no-referrer',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
      },
    });
  }

  throw new ApiError(404, 'API_ROUTE_NOT_FOUND', 'That API endpoint does not exist.');
}

export default {
  async fetch(request: Request, env: AppEnv, ctx: ExecutionContext): Promise<Response> {
    const id = requestId(request);
    const startedAt = Date.now();
    try {
      const response = await handleApi(request, env, ctx);
      console.log({
        event: 'api_request',
        requestId: id,
        method: request.method,
        path: new URL(request.url).pathname,
        status: response.status,
        durationMs: Date.now() - startedAt,
        environment: releaseMetadata(env).environment,
        gitSha: releaseMetadata(env).gitSha,
      });
      return response;
    } catch (error) {
      const response = errorResponse(error, id);
      console.warn({
        event: 'api_request_failed',
        requestId: id,
        method: request.method,
        path: new URL(request.url).pathname,
        status: response.status,
        durationMs: Date.now() - startedAt,
        code: error instanceof ApiError ? error.code : 'INTERNAL_ERROR',
      });
      return response;
    }
  },
} satisfies ExportedHandler<AppEnv>;
