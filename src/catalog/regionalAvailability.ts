import type { CatalogItem } from '../../shared/types';

export const REGION_PREFERENCES = [
  { id: 'no-preference', label: 'No preference' },
  { id: 'united-states', label: 'United States' },
  { id: 'americas', label: 'Americas' },
  { id: 'europe', label: 'Europe' },
  { id: 'africa-middle-east', label: 'Africa & Middle East' },
  { id: 'japan', label: 'Japan' },
  { id: 'asia-pacific', label: 'Asia-Pacific' },
] as const;

export type RegionPreference = (typeof REGION_PREFERENCES)[number]['id'];

const REGION_ZONE_MAP: Readonly<Record<RegionPreference, readonly string[]>> = {
  'no-preference': [],
  'united-states': ['global', 'americas', 'united-states'],
  americas: ['global', 'americas'],
  europe: ['global', 'emea', 'europe'],
  'africa-middle-east': ['global', 'emea', 'africa-middle-east'],
  japan: ['global', 'asia-pacific', 'japan'],
  'asia-pacific': ['global', 'asia-pacific'],
};

export function isRegionPreference(value: string): value is RegionPreference {
  return REGION_PREFERENCES.some((option) => option.id === value);
}

export function recommendedForRegion(item: CatalogItem, preference: RegionPreference): boolean {
  if (preference === 'no-preference' || item.availability?.mode !== 'regional') return false;
  const userZones = REGION_ZONE_MAP[preference];
  return item.availability.zones.some((zone) => userZones.includes(zone));
}

/**
 * Converts a one-time browser position into a broad region without sending it anywhere.
 * The caller must immediately discard the coordinates and persist only the returned label.
 */
export function coarseRegionFromCoordinates(latitude: number, longitude: number): RegionPreference {
  if (latitude >= 18 && latitude <= 72 && longitude >= -171 && longitude <= -52) {
    return 'united-states';
  }
  if (latitude >= 24 && latitude <= 46 && longitude >= 123 && longitude <= 146) return 'japan';
  if (latitude >= 35 && latitude <= 72 && longitude >= -25 && longitude <= 45) return 'europe';
  if (latitude >= -38 && latitude <= 38 && longitude >= -20 && longitude <= 65) {
    return 'africa-middle-east';
  }
  if (longitude < -25) return 'americas';
  return 'asia-pacific';
}
