import type { AppPokemon } from './catalog.js';
export interface ParsedShare {
  category: string;
  name: string;
  registered: Set<number>;
}
export const SHARE_CATEGORIES: readonly string[];
export function encodeCollection(
  catalog: readonly AppPokemon[],
  owned: ReadonlySet<string>,
  category: string,
): string;
export function decodeCollection(data: string): Set<number>;
export function shareLink(
  origin: string,
  catalog: readonly AppPokemon[],
  owned: ReadonlySet<string>,
  category: string,
  name?: string,
): string;
export function parseShare(hash: string): ParsedShare | null;
export function compare(
  catalog: readonly AppPokemon[],
  owned: ReadonlySet<string>,
  share: ParsedShare,
): {
  youCanHelp: AppPokemon[];
  theyCanHelp: AppPokemon[];
  bothMissing: AppPokemon[];
  theirCount: number;
  total: number;
};
export function helpSearch(list: readonly AppPokemon[], category: string): string;
