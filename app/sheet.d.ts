import type { AppPokemon } from './catalog.js';

export interface SheetData {
  name: string;
  rows: string[][];
  merged: Set<string>;
}
export interface SheetSummary {
  rows: number;
  pokemon: number;
  entries: number;
  unmatched: string[];
  notTracked: number;
  notEligible: number;
  skipped: {
    formId: string;
    name: string;
    n: number;
    categoryId: string;
    reason: 'notEligible' | 'notTracked';
  }[];
}
export const SHEET_REGIONS: readonly (readonly [string, string])[];
export function readWorkbook(buffer: ArrayBuffer | Uint8Array): Promise<SheetData[]>;
export function readText(text: string): SheetData[];
export function interpretSheets(
  sheets: readonly SheetData[],
  catalog: readonly AppPokemon[],
): { entries: { formId: string; categoryId: string }[]; summary: SheetSummary };
export function writeWorkbook(
  sheets: readonly {
    name: string;
    rows: (string | { v: string; s?: number } | null | undefined)[][];
    merges?: string[];
    widths?: number[];
    freeze?: number;
  }[],
): Uint8Array;
export function collectionWorkbook(
  catalog: readonly AppPokemon[],
  owned: ReadonlySet<string>,
  searchFor: (categoryId: string) => { value: string; missing: number },
  labels: Record<string, string>,
): Uint8Array;
