export interface LedgerEntry {
  date: string;
  dex?: number;
  formId?: string;
  categories: string[];
  status?: 'released' | 'unreleased' | 'ineligible';
  source: string;
  note?: string;
}
export interface LedgerForm {
  date: string;
  formId: string;
  dex: number;
  formName: string;
  variantKind: 'mega' | 'primal' | 'gigantamax' | 'regional' | 'alternate';
  types: string[];
  categories: ('normal' | 'shiny')[];
  source: string;
  artwork?: { normal: string; shiny?: string };
  note?: string;
}
export interface Ledger {
  schemaVersion: number;
  note?: string;
  forms?: LedgerForm[];
  entries: LedgerEntry[];
}
interface CatalogForm {
  formId: string;
  dex: number;
  isDefault: boolean;
  rules: Record<string, string>;
}
export const LEDGER_CATEGORIES: readonly string[];
export const LEDGER_STATUSES: readonly string[];
export const OFFICIAL_HOSTS: readonly string[];
export const LEDGER_FORM_KINDS: readonly string[];
export function validateLedger(
  ledger: unknown,
  forms: readonly CatalogForm[],
  today?: Date,
): string[];
export function applyLedger<T extends CatalogForm>(forms: readonly T[], ledger: Ledger): T[];
export function ledgerSources(ledger: Ledger): { key: string; kind: string; url: string }[];
export function ledgerUpdatedAt(ledger: Ledger): string | null;
