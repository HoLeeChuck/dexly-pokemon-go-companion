import type { IconName } from '../components/Icon';
export type PublicRouteId = 'home' | 'dex' | 'search' | 'profile';
export type RouteId = PublicRouteId | 'owner';
export const PUBLIC_ROUTES: readonly { id: PublicRouteId; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'dex', label: 'Dex', icon: 'grid' },
  { id: 'search', label: 'Search Lab', icon: 'flask' },
  { id: 'profile', label: 'Profile', icon: 'user' },
];
export function routeFromLocation(
  location: Pick<Location, 'pathname' | 'hash'> = window.location,
): RouteId {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/cody') return 'owner';
  const value = location.hash.replace(/^#\/?/, '');
  return PUBLIC_ROUTES.some((route) => route.id === value) ? (value as PublicRouteId) : 'home';
}
export function urlForRoute(route: RouteId): string {
  return route === 'owner' ? '/cody' : `/#/${route}`;
}
