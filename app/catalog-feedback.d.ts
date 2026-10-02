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
export function skippedEntryReport(
  skipped: Array<{
    n: number;
    name: string;
    categoryId: string;
    reason: string;
  }>,
  categories: ReadonlyArray<readonly [string, string]>,
): string;
