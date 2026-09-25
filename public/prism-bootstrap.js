/* global document, localStorage */
(() => {
  try {
    document.documentElement.dataset.theme =
      localStorage.getItem('catchgrid:prism:appearance') === 'light' ? 'light' : 'dark';
  } catch {
    document.documentElement.dataset.theme = 'dark';
  }
})();
