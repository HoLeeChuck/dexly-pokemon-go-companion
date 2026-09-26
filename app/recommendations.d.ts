import type { AppPokemon } from './catalog.js';
import type { DatedEntry } from './insights.js';
export interface Recommendation {
  id: string;
  name: string;
  description: string;
  help?: string;
  values: string[];
  emptyMessage?: string;
}
export const DISCORD_CATEGORIES: readonly (readonly [string, string])[];
export function recommendations(
  species: readonly AppPokemon[],
  entries: readonly DatedEntry[],
): Recommendation[];
export function discordMessages(
  species: readonly AppPokemon[],
  entries: readonly DatedEntry[],
  options: { nitro?: boolean; categories: ReadonlySet<string>; evolveSizes?: boolean },
): string[];
