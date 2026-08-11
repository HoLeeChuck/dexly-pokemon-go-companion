import { CATEGORY_IDS, type CategoryId } from '../shared/types';
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
import {
  addTradeSpecimen,
  deleteTradeSpecimen,
  getBootstrap,
  getCollectionRevision,
  setCollectionEntry,
  setWantedEntry,
  undoMutation,
} from './repository';

const FORM_ID_PATTERN = /^form-[a-z0-9-]{3,80}$/;
const OPERATION_ID_PATTERN = /^[a-zA-Z0-9:_-]{8,120}$/;
const MUTATION_ID_PATTERN = /^mutation:[0-9a-f-]{36}$/;
const TRADE_ID_PATTERN = /^trade:[0-9a-f-]{36}$/;

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

function expectedRevisionField(body: Record<string, unknown>): number | undefined {
  const value = body.expectedRevision;
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new ApiError(400, 'INVALID_FIELD', 'expectedRevision must be a non-negative integer.');
  }
  return value as number;
}

async function handleApi(request: Request, env: AppEnv): Promise<Response> {
  const url = new URL(request.url);
  let path: string;
  try {
    path = decodeURIComponent(url.pathname).replace(/\/$/, '') || '/';
  } catch {
    throw new ApiError(400, 'INVALID_REQUEST_PATH', 'The request path contains invalid encoding.');
  }

  if (request.method === 'GET' && path === '/api/health') {
    const database = await env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>();
    return jsonResponse(
      {
        ok: database?.ok === 1,
        service: 'dexly-companion',
        runtime: 'cloudflare-workers',
      },
      { cache: 'public' },
    );
  }

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
        categoryField(body),
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
      traitsValue.length > CATEGORY_IDS.length ||
      traitsValue.some(
        (trait) => typeof trait !== 'string' || !CATEGORY_IDS.includes(trait as CategoryId),
      )
    ) {
      throw new ApiError(
        400,
        'INVALID_TRAITS',
        'traits must be a list of supported category identifiers.',
      );
    }
    const traits = [...new Set(traitsValue as CategoryId[])];
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
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  throw new ApiError(404, 'API_ROUTE_NOT_FOUND', 'That API endpoint does not exist.');
}

export default {
  async fetch(request: Request, env: AppEnv): Promise<Response> {
    const id = requestId(request);
    try {
      return await handleApi(request, env);
    } catch (error) {
      return errorResponse(error, id);
    }
  },
} satisfies ExportedHandler<AppEnv>;
