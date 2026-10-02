export const DISCORD_PROFILE_URL: string;
export function catalogFreshness(
  catalogDate: string,
  ledgerDate: string | null,
  now?: Date,
): { date: string; stale: boolean };
export function entryReport(
  pokemon?: { n: number; speciesName: string; isDefault: boolean; name: string },
  category?: string,
): string;
