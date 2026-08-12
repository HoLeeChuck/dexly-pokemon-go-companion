import type {
  BootstrapPayload,
  CategoryId,
  TradeOfferTrait,
  TradeRequestTrait,
  TradeSpecimen,
  WantedEntry,
} from '../../shared/types';
import type { CsvImportPolicy, CsvImportPreview } from '../../shared/csv';

export interface BootstrapResponse extends BootstrapPayload {
  revision: number;
  authMode: 'local' | 'token' | 'browser';
}

export interface CollectionMutationResponse {
  formId: string;
  categoryId: CategoryId;
  collected: boolean;
  previous: boolean;
  batchId: string | null;
  revision: number;
}

export interface UndoResponse {
  batchId: string;
  revision: number;
  changes: Array<{ formId: string; categoryId: CategoryId; collected: boolean }>;
}

export interface ImportPreviewResponse {
  jobId: string | null;
  preview: CsvImportPreview;
  expiresAt: string | null;
}

export interface ImportApplyResponse {
  jobId: string;
  backupId: string;
  batchId: string | null;
  revision: number;
  added: number;
  removed: number;
}

interface ErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
    requestId?: string;
  };
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
  return sessionStorage.getItem(ACCESS_TOKEN_KEY) ?? '';
}

export function saveAccessToken(value: string): void {
  if (value) sessionStorage.setItem(ACCESS_TOKEN_KEY, value);
  else sessionStorage.removeItem(ACCESS_TOKEN_KEY);
}

async function requestJson<T>(
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
      'Dexly could not reach the local collection service. Your collection was not changed.',
    );
  }

  if (!response.ok) {
    let envelope: ErrorEnvelope = {};
    try {
      envelope = (await response.json()) as ErrorEnvelope;
    } catch {
      // Keep a stable client message when an intermediary returns HTML or an empty body.
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

export const api = {
  catalog(): Promise<BootstrapResponse> {
    return requestJson('/api/v1/catalog');
  },

  bootstrap(token = storedAccessToken()): Promise<BootstrapResponse> {
    return requestJson('/api/v1/bootstrap', {}, token);
  },

  setCollection(input: {
    formId: string;
    categoryId: CategoryId;
    collected: boolean;
    operationId: string;
    expectedRevision: number;
  }): Promise<CollectionMutationResponse> {
    return requestJson('/api/v1/collection', {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  undo(batchId: string): Promise<UndoResponse> {
    return requestJson(`/api/v1/mutations/${encodeURIComponent(batchId)}/undo`, { method: 'POST' });
  },

  setWanted(input: {
    formId: string;
    traitId: TradeRequestTrait;
    wanted: boolean;
  }): Promise<WantedEntry> {
    return requestJson('/api/v1/wanted', { method: 'PUT', body: JSON.stringify(input) });
  },

  addTrade(input: {
    formId: string;
    traits: TradeOfferTrait[];
    quantity: number;
    notes: string;
  }): Promise<TradeSpecimen> {
    return requestJson('/api/v1/trades', { method: 'POST', body: JSON.stringify(input) });
  },

  deleteTrade(id: string): Promise<void> {
    return requestJson(`/api/v1/trades/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  previewImport(input: {
    csv: string;
    sourceName: string;
    policy: CsvImportPolicy;
  }): Promise<ImportPreviewResponse> {
    return requestJson('/api/v1/imports/preview', { method: 'POST', body: JSON.stringify(input) });
  },

  applyImport(jobId: string): Promise<ImportApplyResponse> {
    return requestJson(`/api/v1/imports/${encodeURIComponent(jobId)}/apply`, { method: 'POST' });
  },
};
