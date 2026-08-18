import type { CategoryId } from '../../../shared/types';
import { requestJson } from './request';
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
export function setCloudCollection(input: {
  formId: string;
  categoryId: CategoryId;
  collected: boolean;
  operationId: string;
  expectedRevision: number;
}): Promise<CollectionMutationResponse> {
  return requestJson('/api/v1/collection', { method: 'PUT', body: JSON.stringify(input) });
}
export function undoCloudMutation(batchId: string): Promise<UndoResponse> {
  return requestJson(`/api/v1/mutations/${encodeURIComponent(batchId)}/undo`, { method: 'POST' });
}
