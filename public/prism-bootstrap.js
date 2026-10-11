(() => {
  // Follow the device's light/dark setting until the person picks one in CatchGrid.
  const system = () =>
    window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  try {
    const saved = localStorage.getItem('catchgrid:prism:appearance');
    document.documentElement.dataset.theme =
      saved === 'light' || saved === 'dark' ? saved : system();
    const accent = localStorage.getItem('catchgrid:prism:accent');
    if (accent && accent !== 'slate') document.documentElement.dataset.accent = accent;
  } catch {
    document.documentElement.dataset.theme = system();
  }
})();
