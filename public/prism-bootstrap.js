(() => {
  try {
    document.documentElement.dataset.theme =
      localStorage.getItem('catchgrid:prism:appearance') === 'light' ? 'light' : 'dark';
    const accent = localStorage.getItem('catchgrid:prism:accent');
    if (accent && accent !== 'slate') document.documentElement.dataset.accent = accent;
  } catch {
    document.documentElement.dataset.theme = 'dark';
  }
})();
