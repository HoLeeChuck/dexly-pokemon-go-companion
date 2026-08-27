import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { routeFromLocation, urlForRoute, type RouteId } from './routing';
export function useAppNavigation() {
  const [route, setRoute] = useState<RouteId>(routeFromLocation);
  const scrollPositions = useRef<Record<RouteId, number>>({
    home: 0,
    dex: 0,
    progress: 0,
    search: 0,
    settings: 0,
    owner: 0,
  });
  useEffect(() => {
    const sync = () => setRoute(routeFromLocation());
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);
  useLayoutEffect(() => {
    const frame = window.requestAnimationFrame(() =>
      window.scrollTo({ top: scrollPositions.current[route], behavior: 'auto' }),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [route]);
  function navigate(next: RouteId, section?: string) {
    scrollPositions.current[route] = window.scrollY;
    setRoute(next);
    window.history.pushState(null, '', urlForRoute(next, section));
  }
  return { route, navigate } as const;
}
