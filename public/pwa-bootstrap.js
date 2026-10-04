(() => {
  if (!('serviceWorker' in navigator)) return;

  let refreshing = false;
  let applyRequested = false;
  let registration;

  const announceUpdate = () => {
    // A waiting worker is only an update when an older worker is still active. During a first
    // install, WebKit can briefly report the new worker as waiting before it activates.
    if (!registration?.waiting || !registration.active) return;
    window.dispatchEvent(
      new CustomEvent('catchgrid:update-ready', {
        detail: { registration },
      }),
    );
  };

  window.addEventListener('catchgrid:apply-update', () => {
    applyRequested = true;
    registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
  });

  navigator.serviceWorker.addEventListener?.('controllerchange', () => {
    if (!applyRequested || refreshing) return;
    refreshing = true;
    // A first install begins controlling the current page without a reload.
    // Reload only when the user explicitly accepts a waiting update.
    window.location.reload();
  });

  window.addEventListener('load', async () => {
    try {
      registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      if (!registration) return;
      announceUpdate();
      registration.addEventListener?.('updatefound', () => {
        const installing = registration.installing;
        installing?.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            announceUpdate();
          }
        });
      });
    } catch (error) {
      console.warn('CatchGrid offline support could not start.', error);
    }
  });
})();
