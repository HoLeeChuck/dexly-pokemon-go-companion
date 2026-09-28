import type { AppPokemon } from './catalog.js';
import type { DatedEntry } from './insights.js';

export function showFirstRunHome(
  ownedCount: number,
  activity: readonly { count: number }[],
  storageUnavailable?: boolean,
): boolean;

export interface CategoryTotal {
  id: string;
  name: string;
  eligible: number;
  count: number;
}
export function mostProgressCategory(totals: readonly CategoryTotal[]): string | undefined;
export function recentlyMarked(
  entries: readonly DatedEntry[],
  catalog: readonly AppPokemon[],
  now?: Date,
  limit?: number,
): { entry: DatedEntry; p: AppPokemon }[];
export function categoryTotals(
  items: readonly AppPokemon[],
  owned: ReadonlySet<string>,
  categories: readonly (readonly string[])[],
): CategoryTotal[];
export function regionHeat(
  items: readonly AppPokemon[],
  owned: ReadonlySet<string>,
  categories: readonly (readonly string[])[],
  regions: readonly string[],
): { region: string; cells: CategoryTotal[] }[];
export function dailyActivity(
  entries: readonly DatedEntry[],
  days: number,
  now?: Date,
): { day: string; count: number }[];
export function activeStreak(activity: readonly { count: number }[]): number;
