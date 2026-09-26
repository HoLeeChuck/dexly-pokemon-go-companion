export interface Device {
  region: string;
  slug: string;
  name: string;
  gen: string;
  hue: string;
  showcase: readonly number[];
}
export const DEVICES: readonly Device[];
export function deviceFor(region: string): Device;
export function deviceFromSlug(slug: string): Device | null;
export function officialDexUrl(speciesName: string): string;
export function evolutionFamily(n: number, families: Record<string, readonly number[]>): number[];
export function dialWindow<T>(
  items: readonly T[],
  i: number,
  radius: number,
): { item: T; offset: number }[];
export function pagesOf<T>(items: readonly T[], size?: number, wholeUpTo?: number): T[][];
export function sourceGroups(
  sources: readonly { kind: string; url: string }[],
): Record<'official' | 'secondary' | 'asset', { url: string; host: string }[]>;
