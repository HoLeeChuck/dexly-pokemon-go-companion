/* global document */
import samples from './sample.json';
const categories = ['Normal', 'Shiny', 'Lucky', '100%', 'XXL', 'XXS', 'Shadow', 'Purified'];
const progress = samples.map((_, i) => new Set(Array.from({ length: (i % 7) + 1 }, (_, n) => n)));
let selected = 2;
const $ = (selector) => document.querySelector(selector);
const descriptions = {
  archive: [
    'Field Archive',
    'Warm charcoal, catalog rules and editorial typography. Strong for reading and comparing. The same interaction underneath lets you judge the design rather than a different feature set.',
  ],
  orbital: [
    'Orbital Dex',
    'A circular composition makes the Pokémon feel like an exhibit. Notice the space it consumes and the eye travel between labels: atmosphere comes with a practical cost.',
  ],
  prism: [
    'Prism Atlas',
    'A dark gallery with a luminous collection strip. Toggle a category below; its segment changes here and in the atlas. Fill every segment to reveal the completed spectrum.',
  ],
};
$('#tiles').innerHTML = samples
  .map(
    (p, i) =>
      `<button data-pokemon="${i}" aria-label="Inspect ${p.name}"><small>${String(p.n).padStart(3, '0')}</small><img src="${p.art}" alt="" width="110" height="100"><strong>${p.name}</strong><span class="micro-spectrum" aria-hidden="true">${categories.map(() => '<i></i>').join('')}</span></button>`,
  )
  .join('');
$('#registers').innerHTML = categories
  .map(
    (name, i) =>
      `<button data-category="${i}" aria-pressed="false"><span class="track" aria-hidden="true"></span><span>${name}</span></button>`,
  )
  .join('');

function render() {
  const p = samples[selected],
    owned = progress[selected];
  $('#number').textContent = `KANTO / ${String(p.n).padStart(3, '0')}`;
  $('#name').textContent = p.name;
  // Never reassign an unchanged image URL on a collection update.
  if ($('#art').getAttribute('src') !== p.art) $('#art').setAttribute('src', p.art);
  $('#art').alt = p.name;
  $('#fraction').textContent = `${owned.size} / 8`;
  $('.focus').classList.toggle('complete', owned.size === 8);
  $('#completion').textContent =
    owned.size === 8 ? 'Every facet collected.' : `${8 - owned.size} facets still open.`;
  $('#sample-count').textContent = `${progress.filter((set) => set.size === 8).length} complete`;
  document
    .querySelectorAll('[data-category]')
    .forEach((button, i) => button.setAttribute('aria-pressed', String(owned.has(i))));

  document.querySelectorAll('[data-pokemon]').forEach((button, i) => {
    button.setAttribute('aria-pressed', String(i === selected));
    button.classList.toggle('complete', progress[i].size === 8);
    button
      .querySelectorAll('i')
      .forEach((segment, n) => segment.classList.toggle('lit', progress[i].has(n)));
  });
}
document.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.category !== undefined) {
    const category = Number(button.dataset.category),
      owned = progress[selected];
    if (owned.has(category)) owned.delete(category);
    else owned.add(category);
    render();
  }
  if (button.dataset.pokemon !== undefined) {
    selected = Number(button.dataset.pokemon);
    render();
  }
  if (button.dataset.direction) {
    const direction = button.dataset.direction;
    $('.prototype').dataset.look = direction;
    $('#direction-title').textContent = descriptions[direction][0];
    $('#direction-copy').textContent = descriptions[direction][1];
    document
      .querySelectorAll('[data-direction]')
      .forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
  }
});
render();
