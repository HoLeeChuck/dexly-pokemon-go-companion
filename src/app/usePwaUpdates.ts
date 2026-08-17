import { useEffect, useState } from 'react';
export function usePwaUpdates() {
  const [updateReady, setUpdateReady] = useState(false);
  useEffect(() => {
    const ready = () => setUpdateReady(true);
    window.addEventListener('catchgrid:update-ready', ready);
    return () => window.removeEventListener('catchgrid:update-ready', ready);
  }, []);
  return {
    updateReady,
    dismissUpdate: () => setUpdateReady(false),
    applyUpdate: () => window.dispatchEvent(new Event('catchgrid:apply-update')),
  } as const;
}
