import type { AppPokemon } from './catalog.js';
export type Tier = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum';
export interface Medal {
  region: string;
  mark: string;
  collected: number;
  tier: Tier;
  nextTier?: Exclude<Tier, 'none'>;
  nextTarget: number | null;
  platinum: number;
}
export interface DatedEntry {
  formId: string;
  categoryId: string;
  collected: boolean;
  updatedAt?: string;
}
export const TIERS: readonly Exclude<Tier, 'none'>[];
export function medalShelf(
  catalog: readonly AppPokemon[],
  owned: ReadonlySet<string>,
  category: string,
): Medal[];
export function nearlyComplete(
  catalog: readonly AppPokemon[],
  owned: ReadonlySet<string>,
  categories: readonly (readonly string[])[],
  limit?: number,
): { p: AppPokemon; eligible: number; missing: (readonly string[])[] }[];
export function evolutionHint(
  p: AppPokemon,
  owned: ReadonlySet<string>,
  category: string,
  catalog: readonly AppPokemon[],
  families: Record<string, readonly number[]>,
): AppPokemon[];
export function recap(
  entries: readonly DatedEntry[],
  catalog: readonly AppPokemon[],
  since: Date,
): {
  total: number;
  byCategory: Record<string, number>;
  highlights: { entry: DatedEntry; p: AppPokemon }[];
  activeDays: number;
  dated: boolean;
};
