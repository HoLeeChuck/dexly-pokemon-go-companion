import type { LocalProfile } from '../src/lib/localProfile';
import type { CategoryId } from '../shared/types';
export interface ImportReview {
  readonly kind: 'json' | 'csv' | 'sheet';
  readonly count: number;
  readonly description?: string;
}
export interface SheetImportReview extends ImportReview {
  readonly kind: 'sheet';
  readonly adds: readonly { formId: string; categoryId: string }[];
  readonly summary: import('./sheet.js').SheetSummary;
  readonly already: number;
}
export function reviewSheetImport(
  sheets: readonly import('./sheet.js').SheetData[],
): SheetImportReview;
export function currentProfile(): LocalProfile;
export function collectionKeys(): Set<string>;
export function toggleCollection(formId: string, categoryId: CategoryId): Set<string>;
export function exportBackup(): string;
export function exportCsv(): string;
export function reviewImport(text: string, kind: 'json' | 'csv'): ImportReview;
export function commitImport(review: ImportReview): Set<string>;
export interface CollectionChange {
  formId: string;
  categoryId: string;
  collected: boolean;
}
export function collectedEntries(): {
  formId: string;
  categoryId: string;
  collected: boolean;
  updatedAt?: string;
}[];
export function setMany(
  changes: readonly CollectionChange[],
  reason?: string,
): { owned: Set<string>; changed: number };
export function recoverySnapshots(): {
  id: string;
  summary: import('../src/lib/profileBackup').RestoreReviewSummary;
}[];
export function restoreSnapshot(id: string): Set<string>;
export function profileSettings(): Record<string, unknown>;
export function saveSettings(settings: Record<string, unknown>): void;
