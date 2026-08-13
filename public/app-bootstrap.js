/* global CustomEvent, console, document, localStorage, matchMedia, navigator, window */

(() => {
  const root = document.documentElement;
  try {
    let profileSettings;
    const profileRaw = localStorage.getItem('catchgrid:local-profile:v2');
    if (profileRaw) {
      try {
        const parsed = JSON.parse(profileRaw);
        if (parsed?.version === 2 && parsed.settings && typeof parsed.settings === 'object') {
          profileSettings = parsed.settings;
        }
      } catch {
        // The application owns corrupt-profile recovery. Bootstrap must only avoid a flash.
      }
    }
    const profileTheme =
      profileSettings?.theme === 'light' || profileSettings?.theme === 'dark'
        ? profileSettings.theme
        : null;
    const allowedAccents = ['green', 'blue', 'purple', 'red', 'orange', 'pink'];
    const profileAccent = allowedAccents.includes(profileSettings?.accentTheme)
      ? profileSettings.accentTheme
      : null;
    const legacyTheme = localStorage.getItem('dexly:theme');
    const saved =
      profileTheme || (legacyTheme === 'light' || legacyTheme === 'dark' ? legacyTheme : null);
    const theme = saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const legacyAccent = localStorage.getItem('dexly:accent-theme');
    const accent =
      profileAccent || (allowedAccents.includes(legacyAccent) ? legacyAccent : null) || 'green';
    root.dataset.theme = theme;
    root.dataset.accent = accent;
  } catch {
    const fallbackTheme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    root.dataset.theme = fallbackTheme;
    root.dataset.accent = 'green';
  }

  if (!('serviceWorker' in navigator)) return;

  let refreshing = false;
  let applyRequested = false;
  let registration;

  const announceUpdate = () => {
    if (!registration?.waiting) return;
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
