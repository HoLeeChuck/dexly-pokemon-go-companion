import type { LocalProfile } from '../../src/lib/localProfile';
import type { CategoryId } from '../../shared/types';
export interface ImportReview {
  readonly kind: 'json' | 'csv';
  readonly count: number;
  readonly description: string;
}
export function currentProfile(): LocalProfile;
export function collectionKeys(): Set<string>;
export function toggleCollection(formId: string, categoryId: CategoryId): Set<string>;
export function exportBackup(): string;
export function exportCsv(): string;
export function reviewImport(text: string, kind: 'json' | 'csv'): ImportReview;
export function commitImport(review: ImportReview): Set<string>;
