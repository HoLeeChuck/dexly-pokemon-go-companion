import type { AppPokemon } from './catalog.js';
import type { DatedEntry } from './insights.js';

export interface CategoryTotal {
  id: string;
  name: string;
  eligible: number;
  count: number;
}
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
