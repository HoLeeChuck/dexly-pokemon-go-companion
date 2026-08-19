import { env, SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { ApiError } from '../../worker/http';
import { enforceOwnerBoundary, type OwnerRateLimitEnv } from '../../worker/rateLimit';

import type {
  BootstrapPayload,
  RuleState,
  TradeOfferTrait,
  TradeRequestTrait,
  TradeSpecimen,
  WantedEntry,
} from '../../shared/types';

const LOCAL_ORIGIN = 'http://localhost';
const PROFILE_ID = 'profile:local-development';

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM import_jobs'),
    env.DB.prepare('DELETE FROM backup_snapshots'),
    env.DB.prepare('DELETE FROM mutation_batches'),
    env.DB.prepare('DELETE FROM trade_wanted_entries'),
    env.DB.prepare('DELETE FROM collection_entries'),
    env.DB.prepare('DELETE FROM wanted_entries'),
    env.DB.prepare('DELETE FROM trade_specimens'),
    env.DB.prepare(
      `UPDATE trainer_profiles
       SET collection_revision = 0
       WHERE id = 'profile:local-development'`,
    ),
    env.DB.prepare(
      `UPDATE form_category_rules
       SET state = CASE
         WHEN category_id IN ('normal', 'shiny', 'lucky', 'hundo', 'xxl', 'xxs')
           THEN 'released'
         WHEN form_id IN ('form-0001-standard', 'form-0004-standard', 'form-0007-standard')
           AND category_id IN ('shadow', 'purified')
           THEN 'released'
         ELSE 'unknown'
       END`,
    ),
    env.DB.prepare(
      `UPDATE form_category_rules
       SET state = 'ineligible'
       WHERE form_id = 'form-0151-standard' AND category_id = 'lucky'`,
    ),
  ]);
});

interface BootstrapResponse extends BootstrapPayload {
  revision: number;
  authMode: 'local' | 'token';
}

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string;
  };
}

interface MutationResponse {
  formId: string;
  categoryId: string;
  collected: boolean;
  previous: boolean;
  batchId: string | null;
  revision: number;
}

interface UndoResponse {
  batchId: string;
  revision: number;
  changes: Array<{ formId: string; categoryId: string; collected: boolean }>;
}

interface ImportPreviewResponse {
  jobId: string | null;
  expiresAt: string | null;
  preview: {
    summary: {
      sourceRows: number;
      resolvedRows: number;
      added: number;
      removed: number;
      unchanged: number;
      ignored: number;
      rejected: number;
    };
    issues: Array<{ code: string; severity: string }>;
  };
}

interface ImportApplyResponse {
  jobId: string;
  backupId: string;
  batchId: string | null;
  revision: number;
  added: number;
  removed: number;
}

function localApi(
  path: string,
  init: RequestInit = {},
  origin: string | null = LOCAL_ORIGIN,
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  if (origin !== null) {
    headers.set('origin', origin);
  }
  return SELF.fetch(`${LOCAL_ORIGIN}${path}`, { ...init, headers });
}

async function responseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function bootstrap(): Promise<BootstrapResponse> {
  const response = await localApi('/api/v1/bootstrap', {}, null);
  expect(response.status).toBe(200);
  return responseJson<BootstrapResponse>(response);
}

async function putCollection(input: {
  formId: string;
  categoryId: string;
  collected: boolean;
  operationId: string;
  expectedRevision?: number;
}): Promise<Response> {
  return localApi('/api/v1/collection', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

function putWanted(input: {
  formId: string;
  traitId: unknown;
  wanted: boolean;
}): Promise<Response> {
  return localApi('/api/v1/wanted', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

function postTrade(input: {
  formId: string;
  traits: unknown;
  quantity: number;
  notes?: string;
}): Promise<Response> {
  return localApi('/api/v1/trades', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

describe('Worker bootstrap and authentication boundary', () => {
  it('serves separate GET and HEAD liveness/readiness probes with release metadata', async () => {
    for (const path of ['/api/health', '/api/ready']) {
      const getResponse = await localApi(path, {}, null);
      const payload = await responseJson<{
        ok: boolean;
        gitSha: string;
        environment: string;
        catalogVersion?: string;
      }>(getResponse);
      expect(getResponse.status).toBe(200);
      expect(payload.ok).toBe(true);
      expect(payload.gitSha).toBeTruthy();
      expect(payload.environment).toBeTruthy();
      expect(getResponse.headers.get('cache-control')).toContain('no-store');

      const headResponse = await localApi(path, { method: 'HEAD' }, null);
      expect(headResponse.status).toBe(200);
      expect(await headResponse.text()).toBe('');
    }
  });

  it('serves public catalog HEAD and a profile-free cacheable payload', async () => {
    const versionResponse = await localApi('/api/v1/catalog/version', {}, null);
    expect(versionResponse.status).toBe(200);
    const versionPayload = await responseJson<{ catalogVersion: string }>(versionResponse);
    expect(versionPayload.catalogVersion).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
    const versionHead = await localApi('/api/v1/catalog/version', { method: 'HEAD' }, null);
    expect(versionHead.status).toBe(200);
    expect(await versionHead.text()).toBe('');

    const headResponse = await localApi('/api/v1/catalog', { method: 'HEAD' }, null);
    expect(headResponse.status).toBe(200);
    expect(headResponse.headers.get('cache-control')).toContain('s-maxage=3600');
    expect(await headResponse.text()).toBe('');

    const getResponse = await localApi('/api/v1/catalog', {}, null);
    const payload = await responseJson<Record<string, unknown> & { catalog: unknown[] }>(
      getResponse,
    );
    expect(getResponse.status).toBe(200);
    expect(getResponse.headers.get('x-catchgrid-cache')).toBe('HIT');
    expect(payload.catalog.length).toBeGreaterThan(0);
    expect(payload).not.toHaveProperty('profileId');
    expect(payload).not.toHaveProperty('collectionEntries');
    expect(payload).not.toHaveProperty('wantedEntries');
    expect(payload).not.toHaveProperty('tradeSpecimens');
    expect(payload).not.toHaveProperty('revision');
    expect(JSON.stringify(payload)).not.toContain('profile:local-development');
  });

  it('serves the seeded catalog to the localhost development actor', async () => {
    const response = await localApi('/api/v1/bootstrap', {}, null);
    const payload = await responseJson<BootstrapResponse>(response);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(payload.authMode).toBe('local');
    expect(payload.profileId).toBe(PROFILE_ID);
    expect(payload.catalogVersion).toBe('2026-08-19.1');
    expect(payload.revision).toBe(0);
    expect(payload.categories.map((category) => category.id)).toEqual([
      'normal',
      'shiny',
      'lucky',
      'hundo',
      'xxl',
      'xxs',
      'shadow',
      'purified',
    ]);
    expect(payload.catalog.length).toBeGreaterThanOrEqual(20);

    const bulbasaur = payload.catalog.find((item) => item.id === 'form-0001-standard');
    expect(bulbasaur).toMatchObject({
      dexNumber: 1,
      name: 'Bulbasaur',
      generation: 1,
      region: 'kanto',
      isDefault: true,
    });
    expect(bulbasaur?.rules).toMatchObject({
      normal: 'released',
      shiny: 'released',
      shadow: 'released',
      purified: 'released',
    });

    const solgaleo = payload.catalog.find((item) => item.id === 'form-0791-standard');
    expect(solgaleo).toMatchObject({
      dexNumber: 791,
      name: 'Solgaleo',
      shinySpriteUrl: expect.stringContaining('pm791.s.icon.png'),
    });
    expect(solgaleo?.rules.shiny).toBe('released');

    const mew = payload.catalog.find((item) => item.id === 'form-0151-standard');
    const cosmog = payload.catalog.find((item) => item.id === 'form-0789-standard');
    const meltan = payload.catalog.find((item) => item.id === 'form-0808-standard');
    expect(mew?.rules.lucky).toBe('ineligible');
    expect(cosmog?.rules.lucky).toBe('released');
    expect(meltan?.rules.lucky).toBe('released');

    const regieleki = payload.catalog.find((item) => item.id === 'form-0894-standard');
    const wyrdeer = payload.catalog.find((item) => item.id === 'form-0899-standard');
    expect(regieleki?.region).toBe('galar');
    expect(wyrdeer?.region).toBe('hisui');
  });

  it('fails closed on a production hostname when no access token is configured', async () => {
    const response = await SELF.fetch('https://dexly.example/api/v1/bootstrap');
    const payload = await responseJson<ErrorResponse>(response);

    expect(response.status).toBe(503);
    expect(payload.error.code).toBe('PRIVATE_API_NOT_CONFIGURED');
    expect(payload.error.requestId).toBeTruthy();
  });
});

describe('owner boundary rate limits', () => {
  function limiter(success: boolean): RateLimit {
    return { limit: async () => ({ success }) };
  }

  it('fails a rate-limited unauthenticated owner attempt before authentication', async () => {
    const env = {
      APP_ACCESS_TOKEN: 'expected-secret',
      OWNER_AUTH_LIMITER: limiter(false),
    } satisfies OwnerRateLimitEnv;

    await expect(
      enforceOwnerBoundary(
        new Request('https://dex.cjdev.app/api/v1/bootstrap', {
          headers: { 'cf-connecting-ip': '192.0.2.10', authorization: 'Bearer wrong-secret' },
        }),
        env,
      ),
    ).rejects.toMatchObject({ status: 429, code: 'RATE_LIMITED' } satisfies Partial<ApiError>);
  });

  it('rate-limits authenticated mutations by a token-derived key', async () => {
    const env = {
      APP_ACCESS_TOKEN: 'expected-secret',
      OWNER_AUTH_LIMITER: limiter(true),
      OWNER_MUTATION_LIMITER: limiter(false),
    } satisfies OwnerRateLimitEnv;

    await expect(
      enforceOwnerBoundary(
        new Request('https://dex.cjdev.app/api/v1/collection', {
          method: 'PUT',
          headers: { authorization: 'Bearer expected-secret' },
        }),
        env,
      ),
    ).rejects.toMatchObject({ status: 429, code: 'RATE_LIMITED' } satisfies Partial<ApiError>);
  });

  it('does not invoke production limiters for loopback development', async () => {
    const rejectingLimiter: RateLimit = {
      limit: async () => {
        throw new Error('Limiter should not run on loopback');
      },
    };
    await expect(
      enforceOwnerBoundary(new Request('http://localhost/api/v1/collection'), {
        OWNER_AUTH_LIMITER: rejectingLimiter,
        OWNER_MUTATION_LIMITER: rejectingLimiter,
      }),
    ).resolves.toBeUndefined();
  });
});

describe('sparse collection mutations', () => {
  it('writes one sparse row, increments once, deduplicates retries, and undoes it', async () => {
    const initial = await bootstrap();
    const request = {
      formId: 'form-0001-standard',
      categoryId: 'shiny',
      collected: true,
      operationId: 'op:test:collect:bulbasaur-shiny',
      expectedRevision: initial.revision,
    };

    const firstResponse = await putCollection(request);
    const first = await responseJson<MutationResponse>(firstResponse);
    expect(firstResponse.status).toBe(200);
    expect(first).toMatchObject({
      formId: request.formId,
      categoryId: request.categoryId,
      collected: true,
      previous: false,
      revision: 1,
    });
    expect(first.batchId).toMatch(/^mutation:[0-9a-f-]{36}$/);

    const retryResponse = await putCollection(request);
    const retry = await responseJson<MutationResponse>(retryResponse);
    expect(retryResponse.status).toBe(200);
    expect(retry.batchId).toBe(first.batchId);
    expect(retry.revision).toBe(1);
    expect(retry.collected).toBe(true);

    const afterRetry = await bootstrap();
    expect(afterRetry.revision).toBe(1);
    expect(
      afterRetry.collectionEntries.filter(
        (entry) => entry.formId === request.formId && entry.categoryId === request.categoryId,
      ),
    ).toHaveLength(1);

    const mutationCount = await env.DB.prepare(
      `SELECT count(*) AS count
       FROM mutation_batches
       WHERE profile_id = ? AND client_operation_id = ?`,
    )
      .bind(PROFILE_ID, request.operationId)
      .first<{ count: number }>();
    expect(mutationCount?.count).toBe(1);

    if (!first.batchId) throw new Error('Expected the collection write to create a mutation');
    const undoResponse = await localApi(`/api/v1/mutations/${first.batchId}/undo`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const undo = await responseJson<UndoResponse>(undoResponse);
    expect(undoResponse.status).toBe(200);
    expect(undo.revision).toBe(2);
    expect(undo.changes).toEqual([
      {
        formId: request.formId,
        categoryId: request.categoryId,
        collected: false,
      },
    ]);

    const restored = await bootstrap();
    expect(restored.revision).toBe(2);
    expect(
      restored.collectionEntries.some(
        (entry) => entry.formId === request.formId && entry.categoryId === request.categoryId,
      ),
    ).toBe(false);

    const originalBatch = await env.DB.prepare(
      'SELECT undone_at FROM mutation_batches WHERE id = ?',
    )
      .bind(first.batchId)
      .first<{ undone_at: string | null }>();
    expect(originalBatch?.undone_at).toBeTruthy();
  });

  it('replays only an identical operation and reports the current revision', async () => {
    const firstRequest = {
      formId: 'form-0001-standard',
      categoryId: 'normal',
      collected: true,
      operationId: 'op:test:idempotency:stable',
      expectedRevision: 0,
    };
    const firstResponse = await putCollection(firstRequest);
    expect(firstResponse.status).toBe(200);

    const secondResponse = await putCollection({
      formId: 'form-0004-standard',
      categoryId: 'normal',
      collected: true,
      operationId: 'op:test:idempotency:advance',
      expectedRevision: 1,
    });
    expect(secondResponse.status).toBe(200);

    const retryResponse = await putCollection(firstRequest);
    const retry = await responseJson<MutationResponse>(retryResponse);
    expect(retryResponse.status).toBe(200);
    expect(retry.revision).toBe(2);
    expect(retry.collected).toBe(true);

    const reusedResponse = await putCollection({
      ...firstRequest,
      formId: 'form-0007-standard',
    });
    const reused = await responseJson<ErrorResponse>(reusedResponse);
    expect(reusedResponse.status).toBe(409);
    expect(reused.error.code).toBe('OPERATION_ID_REUSED');

    const state = await bootstrap();
    expect(state.collectionEntries).toHaveLength(2);
    expect(state.revision).toBe(2);
  });

  it('records no-op operation IDs so retries cannot become later mutations', async () => {
    expect(
      (
        await putCollection({
          formId: 'form-0001-standard',
          categoryId: 'normal',
          collected: true,
          operationId: 'op:test:noop:initial',
          expectedRevision: 0,
        })
      ).status,
    ).toBe(200);

    const noopRequest = {
      formId: 'form-0001-standard',
      categoryId: 'normal',
      collected: true,
      operationId: 'op:test:noop:stable',
      expectedRevision: 1,
    };
    const noopResponse = await putCollection(noopRequest);
    const noop = await responseJson<MutationResponse>(noopResponse);
    expect(noopResponse.status).toBe(200);
    expect(noop.batchId).toBeNull();
    expect(noop.revision).toBe(1);

    expect(
      (
        await putCollection({
          formId: 'form-0001-standard',
          categoryId: 'normal',
          collected: false,
          operationId: 'op:test:noop:newer',
          expectedRevision: 1,
        })
      ).status,
    ).toBe(200);

    const retryResponse = await putCollection(noopRequest);
    const retry = await responseJson<ErrorResponse>(retryResponse);
    expect(retryResponse.status).toBe(409);
    expect(retry.error.code).toBe('OPERATION_SUPERSEDED');
    expect((await bootstrap()).collectionEntries).toEqual([]);
  });

  it('deduplicates two concurrent identical writes', async () => {
    const request = {
      formId: 'form-0001-standard',
      categoryId: 'normal',
      collected: true,
      operationId: 'op:test:idempotency:concurrent',
      expectedRevision: 0,
    };
    const responses = await Promise.all([putCollection(request), putCollection(request)]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const payloads = await Promise.all(
      responses.map((response) => responseJson<MutationResponse>(response)),
    );
    expect(new Set(payloads.map((payload) => payload.batchId)).size).toBe(1);
    expect((await bootstrap()).revision).toBe(1);
  });

  it.each(['unknown', 'unreleased', 'ineligible'] as const)(
    'rejects a %s category rule without changing collection state',
    async (ruleState) => {
      await env.DB.prepare(
        `UPDATE form_category_rules
         SET state = ?
         WHERE form_id = 'form-0025-standard' AND category_id = 'shadow'`,
      )
        .bind(ruleState satisfies RuleState)
        .run();

      const response = await putCollection({
        formId: 'form-0025-standard',
        categoryId: 'shadow',
        collected: true,
        operationId: `op:test:rule:${ruleState}`,
        expectedRevision: 0,
      });
      const payload = await responseJson<ErrorResponse>(response);

      expect(response.status).toBe(422);
      expect(payload.error.code).toBe('CATEGORY_NOT_COLLECTIBLE');
      expect(payload.error.details).toEqual({ ruleState });

      const state = await bootstrap();
      expect(state.revision).toBe(0);
      expect(state.collectionEntries).toEqual([]);
    },
  );

  it('rejects a cross-origin mutation before persisting it', async () => {
    const response = await localApi(
      '/api/v1/collection',
      {
        method: 'PUT',
        body: JSON.stringify({
          formId: 'form-0004-standard',
          categoryId: 'normal',
          collected: true,
          operationId: 'op:test:cross-origin',
          expectedRevision: 0,
        }),
      },
      'https://attacker.example',
    );
    const payload = await responseJson<ErrorResponse>(response);

    expect(response.status).toBe(403);
    expect(payload.error.code).toBe('ORIGIN_NOT_ALLOWED');
    const state = await bootstrap();
    expect(state.revision).toBe(0);
    expect(state.collectionEntries).toEqual([]);
  });
});

describe('trade requests and specimens', () => {
  it('persists every supported wanted trait and maps trait_id into bootstrap entries', async () => {
    const traits: TradeRequestTrait[] = ['normal', 'shiny', 'xxl', 'xxs', 'costume'];

    for (const traitId of traits) {
      const response = await putWanted({
        formId: 'form-0001-standard',
        traitId,
        wanted: true,
      });
      const payload = await responseJson<WantedEntry>(response);

      expect(response.status).toBe(200);
      expect(payload).toMatchObject({
        profileId: PROFILE_ID,
        formId: 'form-0001-standard',
        categoryId: traitId,
        wanted: true,
      });
    }

    const state = await bootstrap();
    expect(
      state.wantedEntries.map((entry) => `${entry.formId}:${entry.categoryId}`).sort(),
    ).toEqual(traits.map((traitId) => `form-0001-standard:${traitId}`).sort());

    const stored = await env.DB.prepare(
      `SELECT trait_id
       FROM trade_wanted_entries
       WHERE profile_id = ? AND form_id = ?
       ORDER BY trait_id`,
    )
      .bind(PROFILE_ID, 'form-0001-standard')
      .all<{ trait_id: TradeRequestTrait }>();
    expect(stored.results.map((row) => row.trait_id)).toEqual([...traits].sort());
  });

  it.each(['hundo', 'lucky', 'shadow', 'purified', 'party', null] as const)(
    'rejects unsupported wanted trait %s without persisting a row',
    async (traitId) => {
      const response = await putWanted({
        formId: 'form-0001-standard',
        traitId,
        wanted: true,
      });
      const payload = await responseJson<ErrorResponse>(response);

      expect(response.status).toBe(400);
      expect(payload.error.code).toBe('INVALID_TRADE_TRAIT');
      expect((await bootstrap()).wantedEntries).toEqual([]);
    },
  );

  it('rejects wanted and offered traits that are not released for the selected form', async () => {
    await env.DB.prepare(
      `UPDATE form_category_rules
       SET state = 'unreleased'
       WHERE form_id = 'form-0001-standard' AND category_id = 'shiny'`,
    ).run();

    const wantedResponse = await putWanted({
      formId: 'form-0001-standard',
      traitId: 'shiny',
      wanted: true,
    });
    const wantedPayload = await responseJson<ErrorResponse>(wantedResponse);
    expect(wantedResponse.status).toBe(422);
    expect(wantedPayload.error.code).toBe('TRAIT_NOT_AVAILABLE');

    const offerResponse = await postTrade({
      formId: 'form-0001-standard',
      traits: ['shiny'],
      quantity: 1,
    });
    const offerPayload = await responseJson<ErrorResponse>(offerResponse);
    expect(offerResponse.status).toBe(422);
    expect(offerPayload.error.code).toBe('TRAIT_NOT_AVAILABLE');

    const state = await bootstrap();
    expect(state.wantedEntries).toEqual([]);
    expect(state.tradeSpecimens).toEqual([]);
  });

  it.each(['xxl', 'xxs'] as const)(
    'rejects an active %s request when that size is already collected',
    async (traitId) => {
      const collectionResponse = await putCollection({
        formId: 'form-0001-standard',
        categoryId: traitId,
        collected: true,
        operationId: `op:test:owned-size:${traitId}`,
        expectedRevision: 0,
      });
      expect(collectionResponse.status).toBe(200);

      const response = await putWanted({
        formId: 'form-0001-standard',
        traitId,
        wanted: true,
      });
      const payload = await responseJson<ErrorResponse>(response);

      expect(response.status).toBe(409);
      expect(payload.error.code).toBe('SIZE_ALREADY_OWNED');
      expect((await bootstrap()).wantedEntries).toEqual([]);
    },
  );

  it.each(['xxl', 'xxs'] as const)(
    'clears an active %s request when that size is marked collected',
    async (traitId) => {
      const wantedResponse = await putWanted({
        formId: 'form-0001-standard',
        traitId,
        wanted: true,
      });
      expect(wantedResponse.status).toBe(200);
      expect((await bootstrap()).wantedEntries).toHaveLength(1);

      const collectionResponse = await putCollection({
        formId: 'form-0001-standard',
        categoryId: traitId,
        collected: true,
        operationId: `op:test:complete-size-goal:${traitId}`,
        expectedRevision: 0,
      });
      expect(collectionResponse.status).toBe(200);

      const state = await bootstrap();
      expect(state.wantedEntries).toEqual([]);
      expect(
        state.collectionEntries.some(
          (entry) =>
            entry.formId === 'form-0001-standard' &&
            entry.categoryId === traitId &&
            entry.collected,
        ),
      ).toBe(true);

      const stored = await env.DB.prepare(
        `SELECT count(*) AS count
         FROM trade_wanted_entries
         WHERE profile_id = ? AND form_id = ? AND trait_id = ?`,
      )
        .bind(PROFILE_ID, 'form-0001-standard', traitId)
        .first<{ count: number }>();
      expect(stored?.count).toBe(0);
    },
  );

  it('accepts normal and combined special offers, including costume, in bootstrap', async () => {
    const combinedTraits: TradeOfferTrait[] = ['shiny', 'xxl', 'xxs', 'costume'];
    const combinedResponse = await postTrade({
      formId: 'form-0001-standard',
      traits: combinedTraits,
      quantity: 2,
      notes: 'Event spare',
    });
    const combined = await responseJson<TradeSpecimen>(combinedResponse);

    expect(combinedResponse.status).toBe(201);
    expect(combined).toMatchObject({
      profileId: PROFILE_ID,
      formId: 'form-0001-standard',
      traits: combinedTraits,
      quantity: 2,
      notes: 'Event spare',
    });
    expect(combined.id).toMatch(/^trade:[0-9a-f-]{36}$/);

    const normalResponse = await postTrade({
      formId: 'form-0004-standard',
      traits: [],
      quantity: 1,
    });
    const normal = await responseJson<TradeSpecimen>(normalResponse);
    expect(normalResponse.status).toBe(201);
    expect(normal.traits).toEqual([]);

    const state = await bootstrap();
    expect(state.tradeSpecimens).toHaveLength(2);
    expect(state.tradeSpecimens.find((entry) => entry.id === combined.id)).toMatchObject({
      traits: combinedTraits,
      quantity: 2,
      notes: 'Event spare',
    });
    expect(state.tradeSpecimens.find((entry) => entry.id === normal.id)).toMatchObject({
      formId: 'form-0004-standard',
      traits: [],
      quantity: 1,
    });
  });

  it.each(['normal', 'hundo', 'lucky', 'shadow', 'purified', 'party'] as const)(
    'rejects forbidden or unsupported offer trait %s',
    async (trait) => {
      const response = await postTrade({
        formId: 'form-0001-standard',
        traits: [trait],
        quantity: 1,
      });
      const payload = await responseJson<ErrorResponse>(response);

      expect(response.status).toBe(400);
      expect(payload.error.code).toBe('INVALID_TRAITS');
      expect((await bootstrap()).tradeSpecimens).toEqual([]);
    },
  );

  it('rejects a malformed offer trait list', async () => {
    const response = await postTrade({
      formId: 'form-0001-standard',
      traits: ['shiny', 42],
      quantity: 1,
    });
    const payload = await responseJson<ErrorResponse>(response);

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('INVALID_TRAITS');
    expect((await bootstrap()).tradeSpecimens).toEqual([]);
  });
});

describe('authoritative CSV import', () => {
  it('allows cleanup removals when a formerly collected category is now ineligible', async () => {
    await env.DB.prepare(
      `INSERT INTO collection_entries (profile_id, form_id, category_id)
       VALUES (?, 'form-0151-standard', 'lucky')`,
    )
      .bind(PROFILE_ID)
      .run();

    const previewResponse = await localApi('/api/v1/imports/preview', {
      method: 'POST',
      body: JSON.stringify({
        csv: ['form_id,lucky', 'form-0151-standard,false'].join('\n'),
        sourceName: 'cleanup.csv',
        policy: 'update',
      }),
    });
    const preview = await responseJson<ImportPreviewResponse>(previewResponse);
    expect(previewResponse.status).toBe(200);
    expect(preview.preview.summary).toMatchObject({ removed: 1, rejected: 0 });
    if (!preview.jobId) throw new Error('Expected a cleanup import job');

    const applyResponse = await localApi(`/api/v1/imports/${preview.jobId}/apply`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const applied = await responseJson<ImportApplyResponse>(applyResponse);
    expect(applyResponse.status).toBe(200);
    expect(applied.removed).toBe(1);
    expect(
      (await bootstrap()).collectionEntries.some(
        (entry) => entry.formId === 'form-0151-standard' && entry.categoryId === 'lucky',
      ),
    ).toBe(false);
  });

  it('previews without collection writes, then atomically creates backup and mutation', async () => {
    const csv = [
      'dex_number,form_id,name,normal,shiny',
      '1,form-0001-standard,Bulbasaur,true,true',
      '4,form-0004-standard,Charmander,true,false',
    ].join('\n');

    const previewResponse = await localApi('/api/v1/imports/preview', {
      method: 'POST',
      body: JSON.stringify({
        csv,
        sourceName: 'collection.csv',
        policy: 'merge',
      }),
    });
    const preview = await responseJson<ImportPreviewResponse>(previewResponse);

    expect(previewResponse.status).toBe(200);
    expect(preview.jobId).toMatch(/^import:[0-9a-f-]{36}$/);
    expect(preview.expiresAt).toBeTruthy();
    expect(preview.preview.issues).toEqual([]);
    expect(preview.preview.summary).toMatchObject({
      sourceRows: 2,
      resolvedRows: 2,
      added: 3,
      removed: 0,
      rejected: 0,
    });

    const beforeApply = await bootstrap();
    expect(beforeApply.revision).toBe(0);
    expect(beforeApply.collectionEntries).toEqual([]);

    const stagedJob = await env.DB.prepare('SELECT status, backup_id FROM import_jobs WHERE id = ?')
      .bind(preview.jobId)
      .first<{ status: string; backup_id: string | null }>();
    expect(stagedJob).toEqual({ status: 'previewed', backup_id: null });

    const storedPlan = await env.DB.prepare('SELECT preview_json FROM import_jobs WHERE id = ?')
      .bind(preview.jobId)
      .first<{ preview_json: string }>();
    const storedPayload = JSON.parse(storedPlan?.preview_json ?? '{}') as Record<string, unknown>;
    expect(storedPayload).not.toHaveProperty('csv');
    expect(storedPayload).toHaveProperty('changes');

    if (!preview.jobId) throw new Error('Expected a valid import preview job');
    const applyResponse = await localApi(`/api/v1/imports/${preview.jobId}/apply`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const applied = await responseJson<ImportApplyResponse>(applyResponse);

    expect(applyResponse.status).toBe(200);
    expect(applied).toMatchObject({
      jobId: preview.jobId,
      revision: 1,
      added: 3,
      removed: 0,
    });
    expect(applied.backupId).toMatch(/^backup:[0-9a-f-]{36}$/);
    expect(applied.batchId).toMatch(/^mutation:[0-9a-f-]{36}$/);

    const afterApply = await bootstrap();
    expect(afterApply.revision).toBe(1);
    expect(
      afterApply.collectionEntries.map((entry) => `${entry.formId}:${entry.categoryId}`).sort(),
    ).toEqual(
      ['form-0001-standard:normal', 'form-0001-standard:shiny', 'form-0004-standard:normal'].sort(),
    );

    const backup = await env.DB.prepare(
      `SELECT reason, snapshot_json
       FROM backup_snapshots
       WHERE id = ? AND profile_id = ?`,
    )
      .bind(applied.backupId, PROFILE_ID)
      .first<{ reason: string; snapshot_json: string }>();
    expect(backup?.reason).toBe('Before CSV import: collection.csv');
    const snapshot = JSON.parse(backup?.snapshot_json ?? '{}') as {
      revision?: number;
      collectionEntries?: unknown[];
    };
    expect(snapshot.revision).toBe(0);
    expect(snapshot.collectionEntries).toEqual([]);

    if (!applied.batchId) throw new Error('Expected import changes to create a mutation');
    const mutation = await env.DB.prepare(
      `SELECT kind, base_revision, result_revision, metadata_json
       FROM mutation_batches
       WHERE id = ? AND profile_id = ?`,
    )
      .bind(applied.batchId, PROFILE_ID)
      .first<{
        kind: string;
        base_revision: number;
        result_revision: number;
        metadata_json: string;
      }>();
    expect(mutation).toMatchObject({ kind: 'import', base_revision: 0, result_revision: 1 });
    expect(JSON.parse(mutation?.metadata_json ?? '{}')).toEqual({ importJobId: preview.jobId });

    const mutationItemCount = await env.DB.prepare(
      'SELECT count(*) AS count FROM mutation_items WHERE batch_id = ?',
    )
      .bind(applied.batchId)
      .first<{ count: number }>();
    expect(mutationItemCount?.count).toBe(3);

    const appliedJob = await env.DB.prepare(
      'SELECT status, backup_id FROM import_jobs WHERE id = ?',
    )
      .bind(preview.jobId)
      .first<{ status: string; backup_id: string | null }>();
    expect(appliedJob).toEqual({ status: 'applied', backup_id: applied.backupId });
  });

  it('applies a 138-cell import with a bounded D1 query count', async () => {
    const state = await bootstrap();
    const importSlice = state.catalog.slice(0, 23);
    const csv = [
      'form_id,normal,shiny,lucky,hundo,xxl,xxs',
      ...importSlice.map((item) => `${item.id},true,true,true,true,true,true`),
    ].join('\n');

    const previewResponse = await localApi('/api/v1/imports/preview', {
      method: 'POST',
      body: JSON.stringify({ csv, sourceName: 'catalog-wide.csv', policy: 'merge' }),
    });
    const preview = await responseJson<ImportPreviewResponse>(previewResponse);
    expect(previewResponse.status).toBe(200);
    expect(preview.preview.summary.added).toBe(importSlice.length * 6);
    if (!preview.jobId) throw new Error('Expected a valid catalog-wide import job');

    const applyResponse = await localApi(`/api/v1/imports/${preview.jobId}/apply`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const applied = await responseJson<ImportApplyResponse>(applyResponse);
    expect(applyResponse.status).toBe(200);
    expect(applied.added).toBe(importSlice.length * 6);
    expect((await bootstrap()).collectionEntries).toHaveLength(importSlice.length * 6);
  });

  it('claims a no-change import exactly once under concurrent apply requests', async () => {
    const csv = ['form_id,normal', 'form-0001-standard,false'].join('\n');
    const previewResponse = await localApi('/api/v1/imports/preview', {
      method: 'POST',
      body: JSON.stringify({ csv, sourceName: 'no-change.csv', policy: 'merge' }),
    });
    const preview = await responseJson<ImportPreviewResponse>(previewResponse);
    expect(previewResponse.status).toBe(200);
    expect(preview.preview.summary.added).toBe(0);
    if (!preview.jobId) throw new Error('Expected a no-change import job');

    const responses = await Promise.all([
      localApi(`/api/v1/imports/${preview.jobId}/apply`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      localApi(`/api/v1/imports/${preview.jobId}/apply`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    const backupCount = await env.DB.prepare(
      'SELECT count(*) AS count FROM backup_snapshots WHERE reason = ?',
    )
      .bind('Before CSV import: no-change.csv')
      .first<{ count: number }>();
    expect(backupCount?.count).toBe(1);
    expect((await bootstrap()).revision).toBe(0);
  });
});
