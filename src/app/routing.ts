import type { IconName } from '../components/Icon';
export type CanonicalPublicRouteId = 'home' | 'dex' | 'progress' | 'search' | 'settings';
export type RouteId = CanonicalPublicRouteId | 'owner';
export const PRIMARY_ROUTES: readonly {
  id: Exclude<CanonicalPublicRouteId, 'settings'>;
  label: string;
  icon: IconName;
}[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'dex', label: 'Dex', icon: 'grid' },
  { id: 'progress', label: 'Progress', icon: 'chart' },
  { id: 'search', label: 'Search Lab', icon: 'flask' },
];
export const SETTINGS_ROUTE = { id: 'settings', label: 'Settings', icon: 'settings' } as const;
export function routeFromLocation(
  location: Pick<Location, 'pathname' | 'hash'> = window.location,
): RouteId {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/cody') return 'owner';
  const value = location.hash.replace(/^#\/?/, '').split('?')[0];
  if (value === 'profile') return 'settings';
  return [...PRIMARY_ROUTES, SETTINGS_ROUTE].some((route) => route.id === value)
    ? (value as CanonicalPublicRouteId)
    : 'home';
}
export function urlForRoute(route: RouteId): string {
  return route === 'owner' ? '/cody' : `/#/${route}`;
}
