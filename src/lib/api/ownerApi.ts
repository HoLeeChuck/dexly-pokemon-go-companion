import type { BootstrapPayload } from '../../../shared/types';
import type { CsvImportPolicy, CsvImportPreview } from '../../../shared/csv';
import { requestJson, storedAccessToken } from './request';
export interface BootstrapResponse extends BootstrapPayload {
  revision: number;
  authMode: 'local' | 'token' | 'browser';
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
export function fetchOwnerBootstrap(token = storedAccessToken()): Promise<BootstrapResponse> {
  return requestJson('/api/v1/bootstrap', {}, token);
}
export function previewCloudImport(input: {
  csv: string;
  sourceName: string;
  policy: CsvImportPolicy;
}): Promise<ImportPreviewResponse> {
  return requestJson('/api/v1/imports/preview', { method: 'POST', body: JSON.stringify(input) });
}
export function applyCloudImport(jobId: string): Promise<ImportApplyResponse> {
  return requestJson(`/api/v1/imports/${encodeURIComponent(jobId)}/apply`, { method: 'POST' });
}
