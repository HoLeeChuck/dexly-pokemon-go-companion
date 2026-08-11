import { env, SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import type { BootstrapPayload, RuleState } from '../../shared/types';

const LOCAL_ORIGIN = 'http://localhost';
const PROFILE_ID = 'profile:local-development';

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM import_jobs'),
    env.DB.prepare('DELETE FROM backup_snapshots'),
    env.DB.prepare('DELETE FROM mutation_batches'),
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

describe('Worker bootstrap and authentication boundary', () => {
  it('serves the seeded catalog to the localhost development actor', async () => {
    const response = await localApi('/api/v1/bootstrap', {}, null);
    const payload = await responseJson<BootstrapResponse>(response);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(payload.authMode).toBe('local');
    expect(payload.profileId).toBe(PROFILE_ID);
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
  });

  it('fails closed on a production hostname when no access token is configured', async () => {
    const response = await SELF.fetch('https://dexly.example/api/v1/bootstrap');
    const payload = await responseJson<ErrorResponse>(response);

    expect(response.status).toBe(503);
    expect(payload.error.code).toBe('PRIVATE_API_NOT_CONFIGURED');
    expect(payload.error.requestId).toBeTruthy();
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

describe('authoritative CSV import', () => {
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

  it('applies a catalog-wide 138-cell import with a bounded D1 query count', async () => {
    const state = await bootstrap();
    const csv = [
      'form_id,normal,shiny,lucky,hundo,xxl,xxs',
      ...state.catalog.map((item) => `${item.id},true,true,true,true,true,true`),
    ].join('\n');

    const previewResponse = await localApi('/api/v1/imports/preview', {
      method: 'POST',
      body: JSON.stringify({ csv, sourceName: 'catalog-wide.csv', policy: 'merge' }),
    });
    const preview = await responseJson<ImportPreviewResponse>(previewResponse);
    expect(previewResponse.status).toBe(200);
    expect(preview.preview.summary.added).toBe(state.catalog.length * 6);
    if (!preview.jobId) throw new Error('Expected a valid catalog-wide import job');

    const applyResponse = await localApi(`/api/v1/imports/${preview.jobId}/apply`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const applied = await responseJson<ImportApplyResponse>(applyResponse);
    expect(applyResponse.status).toBe(200);
    expect(applied.added).toBe(state.catalog.length * 6);
    expect((await bootstrap()).collectionEntries).toHaveLength(state.catalog.length * 6);
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
