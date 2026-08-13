import type { Page, Route } from '@playwright/test';
import type {
  CategoryId,
  CollectionEntry,
  TradeRequestTrait,
  WantedEntry,
} from '../../../shared/types';
import { createBootstrapFixture } from '../../fixtures/bootstrap';

interface CollectionMutationInput {
  formId: string;
  categoryId: CategoryId;
  collected: boolean;
  expectedRevision: number;
}

interface MutationBatch {
  formId: string;
  categoryId: CategoryId;
  previous: boolean;
}

interface WantedMutationInput {
  formId: string;
  traitId: TradeRequestTrait;
  wanted: boolean;
}

export interface ApiHarness {
  readonly collectionMutationCount: number;
  readonly wantedMutationCount: number;
  readonly undoCount: number;
  readonly unexpectedWriteCount: number;
  isCollected(formId: string, categoryId: CategoryId): boolean;
  isWanted(formId: string, traitId: TradeRequestTrait): boolean;
}

async function fulfillJson(route: Route, value: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(value),
  });
}

/**
 * Installs an in-memory API before navigation. E2E runs never reach D1, so a
 * failed test cannot leave collection state or mutation audit rows behind.
 */
export async function installFakeApi(
  page: Page,
  options: { catalogCopies?: number; catalogFailureCount?: number } = {},
): Promise<ApiHarness> {
  let state = createBootstrapFixture();
  if ((options.catalogCopies ?? 1) > 1) {
    const original = [...state.catalog];
    state = {
      ...state,
      catalog: Array.from({ length: options.catalogCopies ?? 1 }, (_, copyIndex) =>
        original.map((item) =>
          copyIndex === 0
            ? item
            : {
                ...item,
                id: `${item.id}-copy-${copyIndex}`,
                speciesId: `${item.speciesId}-copy-${copyIndex}`,
                dexNumber: item.dexNumber + copyIndex * 2_000,
              },
        ),
      ).flat(),
    };
  }
  const batches = new Map<string, MutationBatch>();
  let revision = state.revision;
  let collectionMutationCount = 0;
  let wantedMutationCount = 0;
  let undoCount = 0;
  let unexpectedWriteCount = 0;
  let catalogFailureCount = options.catalogFailureCount ?? 0;

  const isCollected = (formId: string, categoryId: CategoryId): boolean =>
    state.collectionEntries.some(
      (entry) =>
        entry.formId === formId && entry.categoryId === categoryId && entry.collected === true,
    );

  const setCollected = (formId: string, categoryId: CategoryId, collected: boolean): void => {
    const entries = state.collectionEntries.filter(
      (entry) => !(entry.formId === formId && entry.categoryId === categoryId),
    );
    state.collectionEntries = collected
      ? [
          ...entries,
          {
            profileId: state.profileId,
            formId,
            categoryId,
            collected: true,
          } satisfies CollectionEntry,
        ]
      : entries;
    if (collected && (categoryId === 'xxl' || categoryId === 'xxs')) {
      state.wantedEntries = state.wantedEntries.filter(
        (entry) => !(entry.formId === formId && entry.categoryId === categoryId),
      );
    }
  };

  const isWanted = (formId: string, traitId: TradeRequestTrait): boolean =>
    state.wantedEntries.some(
      (entry) => entry.formId === formId && entry.categoryId === traitId && entry.wanted === true,
    );

  const setWanted = (formId: string, traitId: TradeRequestTrait, wanted: boolean): WantedEntry => {
    const entries = state.wantedEntries.filter(
      (entry) => !(entry.formId === formId && entry.categoryId === traitId),
    );
    const entry: WantedEntry = {
      id: `wanted:e2e-${formId}-${traitId}`,
      profileId: state.profileId,
      formId,
      categoryId: traitId,
      wanted,
    };
    state.wantedEntries = wanted ? [...entries, entry] : entries;
    return entry;
  };

  await page.addInitScript(
    (profile) => {
      globalThis.localStorage.setItem('dexly:active-category', 'normal');
      globalThis.localStorage.setItem('dexly:local-profile:v1', JSON.stringify(profile));
      globalThis.sessionStorage.clear();
    },
    {
      version: 1,
      revision,
      collectionEntries: state.collectionEntries,
      wantedEntries: state.wantedEntries,
      tradeSpecimens: state.tradeSpecimens,
    },
  );

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (
      (path === '/api/v1/bootstrap' || path === '/api/v1/catalog') &&
      request.method() === 'GET'
    ) {
      if (path === '/api/v1/catalog' && catalogFailureCount > 0) {
        catalogFailureCount -= 1;
        await fulfillJson(
          route,
          { error: { code: 'CATALOG_UNAVAILABLE', message: 'Catalog temporarily unavailable.' } },
          503,
        );
        return;
      }
      await fulfillJson(route, { ...structuredClone(state), revision });
      return;
    }

    if (path === '/api/v1/collection' && request.method() === 'PUT') {
      collectionMutationCount += 1;
      const input = request.postDataJSON() as CollectionMutationInput;

      if (input.expectedRevision !== revision) {
        await fulfillJson(
          route,
          { error: { code: 'REVISION_CONFLICT', message: 'E2E fixture revision mismatch.' } },
          409,
        );
        return;
      }

      const previous = isCollected(input.formId, input.categoryId);
      const changed = previous !== input.collected;
      const batchId = changed ? `e2e-batch-${collectionMutationCount}` : null;
      if (batchId) batches.set(batchId, { ...input, previous });
      if (changed) {
        setCollected(input.formId, input.categoryId, input.collected);
        revision += 1;
      }

      await fulfillJson(route, {
        formId: input.formId,
        categoryId: input.categoryId,
        collected: input.collected,
        previous,
        batchId,
        revision,
      });
      return;
    }

    if (path === '/api/v1/wanted' && request.method() === 'PUT') {
      wantedMutationCount += 1;
      const input = request.postDataJSON() as WantedMutationInput;
      await fulfillJson(route, setWanted(input.formId, input.traitId, input.wanted));
      return;
    }

    const undoMatch = path.match(/^\/api\/v1\/mutations\/([^/]+)\/undo$/);
    if (undoMatch && request.method() === 'POST') {
      undoCount += 1;
      const batchId = decodeURIComponent(undoMatch[1] ?? '');
      const batch = batches.get(batchId);
      if (!batch) {
        await fulfillJson(
          route,
          { error: { code: 'UNDO_NOT_FOUND', message: 'E2E fixture batch was not found.' } },
          404,
        );
        return;
      }

      setCollected(batch.formId, batch.categoryId, batch.previous);
      batches.delete(batchId);
      revision += 1;
      await fulfillJson(route, {
        batchId,
        revision,
        changes: [
          {
            formId: batch.formId,
            categoryId: batch.categoryId,
            collected: batch.previous,
          },
        ],
      });
      return;
    }

    if (request.method() !== 'GET') unexpectedWriteCount += 1;
    await fulfillJson(
      route,
      { error: { code: 'UNEXPECTED_E2E_REQUEST', message: `${request.method()} ${path}` } },
      501,
    );
  });

  return {
    get collectionMutationCount() {
      return collectionMutationCount;
    },
    get wantedMutationCount() {
      return wantedMutationCount;
    },
    get undoCount() {
      return undoCount;
    },
    get unexpectedWriteCount() {
      return unexpectedWriteCount;
    },
    isCollected,
    isWanted,
  };
}
