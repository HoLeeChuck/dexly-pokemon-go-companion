/* global location, document, navigator, window, innerWidth, scrollY, scrollTo, getSelection, localStorage, URL, Blob, setTimeout, Event, getComputedStyle */
import { revealArtwork } from './motion.js';
import { updateMarkup } from './dom.js';
import { routeFromLocation } from '../../src/app/routing';
import { catalog, catalogDate } from './catalog.js';
import {
  collectionKeys,
  toggleCollection,
  exportBackup,
  exportCsv,
  reviewImport,
  commitImport,
} from './data.js';
import evolutions from '../../catalog/evolution-families.v1.json';
import { missingSearch } from './search';

const categories = [
  ['normal', 'Normal', '◒'],
  ['shiny', 'Shiny', '✦'],
  ['lucky', 'Lucky', '◇'],
  ['hundo', '100%', 'IV'],
  ['xxl', 'XXL', 'XXL'],
  ['xxs', 'XXS', 'XXS'],
  ['shadow', 'Shadow', '◐'],
  ['purified', 'Purified', '○'],
];
// Base colors verified from Pokémon's official Pokédex main.css, 2026-09-24.
const typeClasses = (p) => `type-a-${p.types[0]} type-b-${p.types[1] || p.types[0]}`;
const complete = (p) => {
  const eligible = categories.filter(([c]) => p.rules[c] === 'released');
  return eligible.length > 0 && eligible.every(([c]) => isOwned(p, c));
};
let owned = new Set();
let storageError = '';
try {
  owned = collectionKeys();
} catch (error) {
  storageError = error.message;
}
let pendingImport = null;
const main = document.querySelector('main');
const dialog = document.querySelector('dialog');
const state = {
  route: routeFromLocation(),
  category: 'normal',
  selected: 'form-0006-standard',
  region: 'All regions',
  form: 'species',
  evolve: false,
  query: '',
  draft: '',
  filter: 'all',
  terms: new Set(['age0', '!#']),
  custom: [],
  gapIds: null,
  mode: 'none',
  preset: location.hash.includes('section=missing-searches') ? 'missing' : 'custom',
};
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const label = () => categories.find((c) => c[0] === state.category)[1];
const isOwned = (p, c = state.category) => owned.has(`${p.id}:${c}`);
const scoped = () =>
  catalog.filter(
    (p) =>
      (state.region === 'All regions' || p.region === state.region) &&
      (state.form === 'species'
        ? p.isDefault
        : state.form === 'all'
          ? true
          : state.form === 'mega'
            ? ['mega', 'primal'].includes(p.variantKind)
            : p.variantKind === state.form),
  );
const eligible = (c = state.category) => scoped().filter((p) => p.rules[c] === 'released');
const gaps = () => eligible().filter((p) => !isOwned(p));
const art = (p) => (state.category === 'shiny' ? p.shiny : p.art);
function announce(message, silent = false) {
  const t = document.querySelector('.toast');
  t.hidden = false;
  t.classList.toggle('sr-only', silent);
  t.querySelector('span').textContent = message;
}
function navigate(route) {
  location.hash = route;
  if (state.route === route) render();
}
function heading() {
  return '';
}
const formOnly = () => ['mega', 'gigantamax', 'regional', 'alternate'].includes(state.form);
function lenses() {
  return `<label class="category-select">Collection category<select data-category-select>${(formOnly() ? categories.slice(0, 2) : categories).map(([id, name]) => `<option value="${id}" ${state.category === id ? 'selected' : ''}>${name}</option>`).join('')}</select></label>`;
}
function scopeControls() {
  const regions = [
    'All regions',
    'Kanto',
    'Johto',
    'Hoenn',
    'Sinnoh',
    'Unova',
    'Kalos',
    'Alola',
    'Galar',
    'Hisui',
    'Paldea',
    'Unknown',
  ];
  return `<div class="scope-controls"><label class="category-select">Region<select data-region>${regions.map((r) => `<option ${state.region === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label><label class="category-select">Forms<select data-form>${[
    ['species', 'National Dex'],
    ['all', 'All supported forms'],
    ['mega', 'Mega / Primal'],
    ['gigantamax', 'Gigantamax'],
    ['regional', 'Regional'],
    ['alternate', 'Other forms'],
  ]
    .map(
      ([id, name]) =>
        `<option value="${id}" ${state.form === id ? 'selected' : ''}>${name}</option>`,
    )
    .join('')}<option disabled>Costumes · coming later</option></select></label></div>`;
}
function ruleLabel(p, c = state.category) {
  return (
    { unreleased: 'Not released', ineligible: 'Not eligible', unknown: 'Not verified' }[
      p.rules[c]
    ] || 'Not verified'
  );
}
function target(p) {
  const available = p.rules[state.category] === 'released';
  return `<div data-key="${p.id}" class="target-wrap ${isOwned(p) ? 'owned' : ''} ${complete(p) ? 'complete' : ''}"><button class="target" data-quick="${p.id}" ${available ? '' : 'disabled'} aria-pressed="${isOwned(p)}" aria-label="Toggle ${escape(p.name)} ${label()}, ${available ? (isOwned(p) ? 'collected' : 'missing') : ruleLabel(p)}${complete(p) ? ', all eligible categories complete' : ''}"><small>#${String(p.n).padStart(4, '0')}</small><img src="${escape(art(p))}" alt="" loading="lazy" width="128" height="112"><strong>${escape(p.name)}</strong>${available ? '' : `<span class="status">${ruleLabel(p)}</span>`}</button><button class="inspect-link" data-pokemon="${p.id}" aria-label="View details for ${escape(p.name)}">View details ↗</button></div>`;
}
function transformationSection(p) {
  if (!p.isDefault) return '';
  const forms = catalog.filter(
    (form) =>
      form.speciesId === p.speciesId && ['mega', 'primal', 'gigantamax'].includes(form.variantKind),
  );
  if (!forms.length) return '';
  return `<section class="related-forms" aria-label="Mega and G-Max forms"><h3>Mega & G-Max</h3><p>Track forms here. Size, Lucky and 100% stay with ${escape(p.name)}.</p>${forms
    .map(
      (form) =>
        `<div class="related-form ${complete(form) ? 'complete' : ''}" data-key="related-${form.id}"><strong>${escape(form.name)}</strong><div class="specimen-categories" role="group" aria-label="${escape(form.name)} collection" data-complete="${complete(form)}">${categories
          .slice(0, 2)
          .map(
            ([id, name]) =>
              `<button data-form-toggle="${form.id}" data-category-toggle="${id}" aria-pressed="${isOwned(form, id)}" ${form.rules[id] !== 'released' ? 'disabled' : ''} aria-label="${escape(form.name)} ${name}: ${form.rules[id] !== 'released' ? ruleLabel(form, id) : isOwned(form, id) ? 'collected' : 'missing'}"><span class="register-track" aria-hidden="true"></span>${name}${form.rules[id] !== 'released' ? `<small>${ruleLabel(form, id)}</small>` : ''}</button>`,
          )
          .join('')}</div></div>`,
    )
    .join('')}</section>`;
}
function specimen() {
  const p = catalog.find((p) => p.id === state.selected);
  return `<aside data-key="inspector" class="specimen ${typeClasses(p)} ${complete(p) ? 'complete' : ''}" aria-label="${escape(p.name)} collection inspector"><div class="specimen-top"><span></span><span>${label().toUpperCase()}</span></div><div class="specimen-stage"><span class="specimen-index">${p.region.toUpperCase()} · #${String(p.n).padStart(4, '0')}</span><img src="${escape(art(p))}" alt="${escape(p.name)}${state.category === 'shiny' ? ' shiny appearance' : ''}" width="270" height="255"></div><div class="specimen-info"><h2>${escape(p.name)}</h2><div class="species-meta">${p.types.join(' / ')} · ${p.variantKind}${p.artworkIsFallback ? ' · Representative artwork' : ''}</div><div class="specimen-categories" role="group" aria-label="Quick collection selection" data-complete="${complete(p)}">${(p.isDefault ? categories : categories.slice(0, 2)).map(([id, name]) => `<button data-category-toggle="${id}" ${p.rules[id] !== 'released' ? 'disabled' : ''} aria-pressed="${isOwned(p, id)}" data-key="${id}" aria-label="Toggle ${name}: ${p.rules[id] !== 'released' ? ruleLabel(p, id) : isOwned(p, id) ? 'collected' : 'missing'}"><span class="register-track" aria-hidden="true"></span>${name}</button>`).join('')}</div>${transformationSection(p)}</div><div class="specimen-controls"><button data-prev aria-label="Inspect previous Pokémon">←</button><span>Browse this selection</span><button data-next aria-label="Inspect next Pokémon">→</button></div></aside>`;
}
function atlas() {
  const total = eligible().length,
    count = eligible().filter((p) => isOwned(p)).length;
  return `<section class="atlas" aria-labelledby="map-title"><div class="atlas-top"><div><div class="eyebrow">YOUR COLLECTION MAP</div><h2 id="map-title">${state.region} / ${label()}</h2><p class="atlas-note">Tap a slot to inspect. Choose a region for a closer view.</p></div><div class="atlas-total">${count}<span> / ${total}</span></div></div><div class="collection-map" role="group" aria-label="${state.region} ${label()}: ${count} of ${total} eligible species collected, ${total - count} missing. Map is ordered by National Dex number. Arrow keys move between slots; Enter opens details.">${scoped()
    .map(
      (p) =>
        `<button tabindex="${p.id === state.selected ? 0 : -1}" data-key="${p.id}" data-pokemon="${p.id}" title="${escape(p.name)}" aria-label="Inspect ${escape(p.name)}, ${p.rules[state.category] !== 'released' ? ruleLabel(p) : isOwned(p) ? 'collected' : 'missing'} ${label()}${complete(p) ? ', complete' : ''}" class="map-cell ${p.rules[state.category] !== 'released' ? 'unavailable' : isOwned(p) ? 'owned' : 'missing'} ${p.id === state.selected ? 'selected' : ''} ${complete(p) ? 'complete' : ''}"><span class="map-number">${p.n}</span><span class="map-symbol" aria-hidden="true">${p.rules[state.category] !== 'released' ? '—' : ''}</span></button>`,
    )
    .join(
      '',
    )}</div><div class="map-legend"><span><i class="collection-status missing"></i>Missing</span><span><i class="collection-status owned"></i>Collected</span><span><i class="collection-status complete"></i>All categories complete</span><span><i class="collection-status unavailable">—</i>Not eligible</span></div><p class="map-caption">National Dex order · positions stay fixed across categories</p><div class="atlas-bottom"><div><strong>${total - count} ${label().toLowerCase()} gaps to explore.</strong><small>Collection status, not current catch availability.</small></div><button class="primary" data-compose ${total === count ? 'disabled' : ''}>Build a search for these gaps <span aria-hidden="true">↗</span></button></div></section>`;
}
function progress() {
  return (
    heading(
      'YOUR COLLECTION / IN FOCUS',
      'Your collection.<br><em>In full spectrum.</em>',
      'See the shape of what you have. Follow the spaces you want to fill.',
    ) +
    `<div class="workspace"><div class="collection-column"><div class="context-row"><h2>Collection</h2><small>${scoped().length} ${state.form === 'species' ? 'species' : 'forms'}</small></div><div class="collection-controls">${scopeControls()}${lenses()}</div>${atlas()}<div class="section-title"><h2>Meet the missing.</h2><a href="#dex" data-show-missing>View all ${gaps().length} gaps ↗</a></div><div class="target-list">${gaps().slice(0, 4).map(target).join('') || '<p>Every eligible species in this category is collected.</p>'}</div><div class="trust-strip"><span>SAVED ON THIS BROWSER</span><span>CATALOG SNAPSHOT · ${catalogDate}</span></div></div>${specimen()}</div>`
  );
}
function matching() {
  return scoped().filter(
    (p) =>
      (!state.query ||
        `${p.n} ${String(p.n).padStart(4, '0')} ${p.name} ${p.types.join(' ')}`
          .toLowerCase()
          .includes(state.query.toLowerCase())) &&
      (state.filter === 'all' ||
        (state.filter === 'missing' && p.rules[state.category] === 'released' && !isOwned(p)) ||
        (state.filter === 'collected' && isOwned(p))),
  );
}
function dex() {
  return (
    heading(
      'POKÉDEX / KANTO',
      'Find your <em>next one.</em>',
      'Tap a Pokémon to toggle the selected category. Use View details to open the Pokémon.',
    ) +
    `<div class="workspace"><div class="collection-column"><div class="collection-controls">${scopeControls()}${lenses()}</div><div class="toolbar"><label class="sr-only" for="dex-search">Search Pokémon</label><input class="search-input" id="dex-search" type="search" placeholder="Name, number, or type…" value="${escape(state.query)}"><div class="filter-group" role="group" aria-label="Collection status">${['all', 'missing', 'collected'].map((s) => `<button data-filter="${s}" aria-pressed="${state.filter === s}">${s[0].toUpperCase() + s.slice(1)}</button>`).join('')}</div></div><div class="context-row"><small id="results-count" aria-live="polite">${matching().length} ${state.form === 'species' ? 'species' : 'forms'} · ${label()}</small><button class="quiet" data-compose>Search missing ${label()} ↗</button></div><div class="dex-legend" aria-label="Collection indicators"><span><i class="legend-outline"></i>Missing</span><span><i class="legend-outline owned"></i>${label()} collected</span><span><i class="legend-outline complete"></i>All categories complete</span></div><div class="target-list dex-grid" id="dex-results">${matching().map(target).join('') || empty()}</div></div>${specimen()}</div>`
  );
}
function empty() {
  return '<div class="empty"><h2>No matching Pokémon</h2><p>Try another name, region, form, or category.</p><button class="secondary" data-clear>Clear search and status</button></div>';
}
function query() {
  if (state.preset === 'missing')
    return missingSearch({
      items: scoped(),
      universe: catalog,
      owned,
      category: state.category,
      evolution: state.evolve && state.form === 'species',
      mode: state.mode,
      families: evolutions.families,
    });
  const bits = [...state.terms, ...state.custom];
  if (state.mode === 'personal') bits.unshift('!#');
  if (state.mode === 'tradeable') bits.unshift('!traded');
  return [...new Set(bits)].filter(Boolean).join('&');
}
function search() {
  const missing = state.preset === 'missing';
  const tokens = [
    ['age0', 'Caught today'],
    ['!#', 'Untagged'],
    ['!traded', 'Not traded'],
    ['shiny', 'Shiny'],
    ['shadow', 'Shadow'],
    ['lucky', 'Lucky'],
    ['xxl', 'XXL'],
    ['xxs', 'XXS'],
    ['4*', 'Perfect appraisal'],
    ['evolve', 'Can evolve'],
  ];
  return `<div class="subnav" role="group" aria-label="Search starting point"><button data-preset="custom" aria-pressed="${state.preset === 'custom'}">Build my own</button><button data-preset="missing" aria-pressed="${missing}">My missing</button><button data-preset="legacy" aria-pressed="${state.preset === 'legacy'}">Legacy moves</button></div>${
    state.preset === 'legacy'
      ? legacyPanel()
      : `<div class="search-layout"><div class="search-main">${missing ? `<div class="collection-controls">${scopeControls()}${lenses()}</div><p>${gaps().length} missing ${label()} entries in ${state.region.toLowerCase()}.</p><label class="evolve-option"><input type="checkbox" data-evolution ${state.evolve ? 'checked' : ''} ${state.form !== 'species' ? 'disabled' : ''}> Can evolve into my missing Pokémon</label><p class="annotation">${state.form !== 'species' ? 'Evolution candidates are supported for National Dex species only.' : 'Finds earlier species, even those already checked off, and adds the game’s evolve filter. For missing XXL Charmeleon or Charizard, XXL Charmander is included. Candy, items, regional branches and evolution conditions still need checking in-game.'}</p>` : `<section class="term-section"><h2>Build your search</h2><div class="term-buttons" role="group" aria-label="Search terms">${tokens.map(([v, n]) => `<button data-term="${v}" aria-pressed="${state.terms.has(v)}">${n}</button>`).join('')}</div></section><section class="term-section"><label for="custom-term">Add a Pokémon GO keyword</label><form id="custom-form"><input class="search-input" id="custom-term" value="${escape(state.draft)}" placeholder="For example: buddy3-5"><button class="secondary">Add</button></form><div class="custom-terms">${state.custom.map((v) => `<button data-remove-term="${escape(v)}" aria-label="Remove ${escape(v)}">${escape(v)} ×</button>`).join('')}</div></section>`}<details class="term-section"><summary>Storage filters</summary><div class="term-buttons" role="group" aria-label="Missing search mode">${[
          ['none', 'None'],
          ['personal', 'Personal · !#'],
          ['tradeable', 'Tradeable · !traded'],
        ]
          .map(
            ([v, n]) => `<button data-mode="${v}" aria-pressed="${state.mode === v}">${n}</button>`,
          )
          .join(
            '',
          )}</div></details><p class="annotation"><a href="/advanced/#/search">Cody’s recommendations and Discord output ↗</a></p></div><aside class="query-board" aria-label="Generated query"><h2>${missing ? `Missing ${label()}` : 'Your search'}</h2><code id="query-text" aria-live="polite">${escape(query()) || (missing ? 'No matching missing entries or evolution candidates.' : 'Choose a filter to begin.')}</code><button class="primary" data-copy ${query() ? '' : 'disabled'}>Copy search string ↗</button><p>Paste into Pokémon GO’s storage search.</p>${missing ? '<p>Species numbers may also match alternate forms. This finds candidates; it does not read your in-game collection.</p>' : ''}</aside></div>`
  }`;
}
function legacyPanel() {
  const windows = [
    {
      name: 'Zoroark',
      move: 'Sucker Punch · Fast Attack',
      start: '2026-10-10T14:00:00',
      end: '2026-10-10T21:00:00',
      method: 'Evolve Zorua',
      url: 'https://pokemongo.com/news/communityday-october-2026-zorua',
    },
    {
      name: 'Garchomp',
      move: 'Earth Power · Charged Attack',
      start: '2026-09-12T14:00:00',
      end: '2026-09-12T21:00:00',
      method: 'Evolve Gabite',
      url: 'https://pokemongo.com/news/communitydayclassic-gible-september-2026',
    },
  ];
  const now = new Date();
  const status = (w) =>
    now < new Date(w.start)
      ? 'Upcoming'
      : now <= new Date(w.end)
        ? 'Active in your device time zone'
        : 'Ended';
  return `<section class="legacy-panel"><h2>Legacy move windows</h2><p>Reviewed September 24, 2026. ${windows.some((w) => status(w).startsWith('Active')) ? 'An entry below is within its announced window.' : 'No active featured-attack window is confirmed in this reviewed list.'} This is a dated selection, not a live or exhaustive event feed.</p>${windows.map((w) => `<article><span class="page-count">${status(w)}</span><h3>${w.name} · ${w.move}</h3><p>${w.method} between ${new Date(w.start).toLocaleString()} and ${new Date(w.end).toLocaleString()} local time. ${status(w) === 'Ended' ? 'This window has ended; evolving now does not grant this event attack.' : ''}</p><a href="${w.url}" target="_blank" rel="noopener">Official announcement ↗</a></article>`).join('')}<p>Event acquisition and Elite TM eligibility are different. Confirm the move in the game’s Elite TM preview before spending an item. Event windows use your device’s local time zone; verify it matches your location.</p><a class="secondary" href="https://pokemongo.com/news" target="_blank" rel="noopener">Check latest official announcements ↗</a></section>`;
}
function home() {
  const species = catalog.filter((p) => p.isDefault && p.rules.normal === 'released');
  const registered = species.filter((p) => isOwned(p, 'normal')).length;
  const mastered = species.filter(complete).length;
  return `<div class="settings-layout"><section><h2>Your collection</h2><p>${registered} of ${species.length} released species registered in Normal. ${mastered} complete across all eligible categories.</p><a class="primary" href="#dex">Open Dex ↗</a></section><section><h2>Find what’s missing</h2><p>Choose a region and category, then take your search into Pokémon GO.</p><button class="primary" data-compose>My missing ↗</button></section><section><h2>Keep a copy</h2><p>Export a backup or a spreadsheet-friendly CSV.</p><a class="secondary" href="#settings">Import and export ↗</a></section></div>`;
}
function settings() {
  return `<div class="settings-layout"><section><h2>Appearance</h2><p>Dark by default. Your choice is remembered on this browser.</p><button class="secondary" data-theme>Switch appearance ◐</button></section><section><h2>Export collection</h2><p>JSON includes your complete CatchGrid profile. CSV opens in Excel and includes stable form IDs and category columns.</p><button class="secondary" data-export="json">Download JSON backup</button><button class="secondary" data-export="csv">Download CSV for Excel</button></section><section><h2>Import collection</h2><p>Choose a CatchGrid JSON backup or canonical collection CSV. You will review the import before it changes anything.</p><label class="secondary">Choose backup or CSV<input id="import-file" type="file" accept=".json,.csv" /></label><div id="import-review" role="status">${pendingImport ? `<p>${pendingImport.count} collected entries to import. ${escape(pendingImport.description)}</p><button class="primary" data-import-apply>Apply reviewed import</button><button class="quiet" data-import-cancel>Cancel</button>` : ''}</div></section><section><h2>Catalog and storage</h2><p>All regions and supported forms. Costumes are pending. Catalog base reviewed ${catalogDate}; availability changes require dated sources. Unreleased and ineligible categories cannot be selected.</p><p>Data is stored on this browser, using the existing CatchGrid profile and recovery snapshots. No Pokémon GO account connection.</p><a href="/advanced/#/settings">Advanced data recovery and existing settings ↗</a></section></div>`;
}
function render() {
  main.dataset.route = state.route;
  if (!['home', 'dex', 'progress', 'search', 'settings'].includes(state.route))
    state.route = 'progress';
  document.querySelectorAll('nav a').forEach((a) => {
    if (a.hash === '#' + state.route) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  updateMarkup(
    main,
    `<h1 class="sr-only">${{ home: 'Home', dex: 'Pokédex', progress: 'Progress', search: 'Search Lab', settings: 'Settings' }[state.route]}</h1>` +
      (storageError
        ? `<p role="alert">${escape(storageError)} Collection editing is unavailable.</p>`
        : '') +
      { home, dex, progress, search, settings }[state.route](),
  );
  if (dialog.open) updateMarkup(document.querySelector('#dialog-content'), specimen());
}
function compose() {
  state.gapIds = gaps().map((p) => p.n);
  state.mode = 'none';
  state.preset = 'missing';
  navigate('search');
}
function toggleTheme() {
  const dark = document.documentElement.dataset.theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'light' : 'dark';
  try {
    localStorage.setItem('catchgrid:prism:appearance', dark ? 'light' : 'dark');
  } catch {
    /* Appearance still applies for this visit. */
  }
  document
    .querySelector('.theme-toggle')
    .setAttribute('aria-label', `Switch to ${dark ? 'dark' : 'light'} appearance`);
}
function select(n) {
  const source = document.querySelector(`[data-quick="${n}"] img`);
  const origin = source?.getBoundingClientRect();
  state.selected = n;
  if (innerWidth <= 800) {
    updateMarkup(document.querySelector('#dialog-content'), specimen());
    if (!dialog.open) dialog.showModal();
  } else {
    const previousScroll = scrollY;
    render();
    scrollTo({ top: previousScroll, behavior: 'instant' });
    document.querySelector(`[data-pokemon="${n}"]`)?.focus({ preventScroll: true });
  }
  revealArtwork(origin, (dialog.open ? dialog : main).querySelector('.specimen-stage img'));
}
document.addEventListener('click', async (event) => {
  const b = event.target.closest('button,a');
  if (!b) return;
  if (b.matches('.menu-toggle')) {
    const open = document.querySelector('nav').classList.toggle('open');
    b.setAttribute('aria-expanded', String(open));
  }
  if (b.matches('nav a')) {
    document.querySelector('nav').classList.remove('open');
    document.querySelector('.menu-toggle').setAttribute('aria-expanded', 'false');
  }
  if (b.matches('.theme-toggle,[data-theme]')) toggleTheme();
  if (b.matches('[data-lens]')) {
    state.category = b.dataset.lens;
    const inDialog = dialog.open;
    render();
    const scope = inDialog ? dialog : main;
    scope.querySelector(`[data-lens="${state.category}"]`)?.focus({ preventScroll: true });
  }
  if (b.matches('[data-pokemon]')) select(b.dataset.pokemon);
  if (b.matches('[data-prev],[data-next]')) {
    const sequence = state.route === 'dex' ? matching() : scoped();
    if (!sequence.length) return;
    const i = sequence.findIndex((p) => p.id === state.selected);
    state.selected =
      sequence[
        i < 0
          ? b.matches('[data-next]')
            ? 0
            : sequence.length - 1
          : (i + (b.matches('[data-next]') ? 1 : sequence.length - 1)) % sequence.length
      ].id;
    render();
    (dialog.open ? dialog : main)
      .querySelector(b.matches('[data-next]') ? '[data-next]' : '[data-prev]')
      ?.focus({ preventScroll: true });
  }
  if (b.matches('[data-quick],[data-category-toggle]')) {
    const p = catalog.find(
      (p) => p.id === (b.dataset.quick || b.dataset.formToggle || state.selected),
    );
    const category = b.dataset.categoryToggle || state.category;
    if (p.rules[category] !== 'released') return;
    const had = owned.has(`${p.id}:${category}`);
    const focus = b.dataset.quick
      ? `[data-quick="${p.id}"]`
      : b.dataset.formToggle
        ? `[data-form-toggle="${p.id}"][data-category-toggle="${category}"]`
        : `[data-category-toggle="${category}"]:not([data-form-toggle])`;
    try {
      owned = toggleCollection(p.id, category);
    } catch (error) {
      announce(error.message);
      return;
    }
    const before = [...main.querySelectorAll('[data-quick]')];
    const position = before.indexOf(b);
    render();
    const scope = dialog.open ? dialog : main;
    const fallback =
      [...main.querySelectorAll('[data-quick]')][Math.max(0, position)] ||
      main.querySelector('[data-quick]') ||
      main.querySelector('[data-clear]') ||
      main;
    (scope.querySelector(focus) || fallback).focus({ preventScroll: true });
    announce(
      `${p.name} ${categories.find((c) => c[0] === category)[1]} ${had ? 'removed' : 'collected'}.${complete(p) ? ' All eligible categories complete!' : ''}`,
      true,
    );
  }
  if (b.matches('[data-filter]')) {
    state.filter = b.dataset.filter;
    render();
    document.querySelector(`[data-filter="${state.filter}"]`).focus();
  }
  if (b.matches('[data-show-missing]')) state.filter = 'missing';
  if (b.matches('[data-clear]')) {
    state.query = '';
    state.filter = 'all';
    render();
    document.querySelector('#dex-search')?.focus();
  }
  if (b.matches('[data-compose]')) compose();
  if (b.matches('[data-term]')) {
    const v = b.dataset.term;
    if (state.terms.has(v)) state.terms.delete(v);
    else state.terms.add(v);
    render();
    [...document.querySelectorAll('[data-term]')].find((x) => x.dataset.term === v)?.focus();
  }
  if (b.matches('[data-mode]')) {
    state.mode = b.dataset.mode;
    render();
    document.querySelector(`[data-mode="${state.mode}"]`).focus();
  }
  if (b.matches('[data-remove-term]')) {
    state.custom = state.custom.filter((x) => x !== b.dataset.removeTerm);
    render();
    document.querySelector('#custom-term').focus();
  }
  if (b.matches('[data-remove-context]')) {
    state.gapIds = null;
    state.preset = 'custom';
    render();
    document.querySelector('[data-preset="custom"]').focus();
  }
  if (b.matches('[data-preset]')) {
    state.preset = b.dataset.preset;
    render();
    document.querySelector(`[data-preset="${state.preset}"]`)?.focus();
  }
  if (b.matches('[data-copy]')) {
    try {
      await navigator.clipboard.writeText(query());
      announce('Exact search copied. Paste it into Pokémon GO.');
    } catch {
      const range = document.createRange();
      range.selectNodeContents(document.querySelector('#query-text'));
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      announce('Copy unavailable. Query selected; use your device’s Copy command.');
    }
  }
  if (b.matches('.dialog-close')) dialog.close();
});
document.addEventListener('input', (event) => {
  if (event.target.id === 'custom-term') state.draft = event.target.value;
  if (event.target.id === 'dex-search') {
    state.query = event.target.value;
    updateMarkup(
      document.querySelector('#dex-results'),
      matching().map(target).join('') || empty(),
    );
    document.querySelector('#results-count').textContent =
      `${matching().length} ${state.form === 'species' ? 'species' : 'forms'} · ${label()}`;
  }
});
document.addEventListener('submit', (event) => {
  if (event.target.id !== 'custom-form') return;
  event.preventDefault();
  const value = document
    .querySelector('#custom-term')
    .value.trim()
    .replace(/^&+|&+$/g, '');
  if (!value) return;
  if (!state.custom.includes(value)) state.custom.push(value);
  state.draft = '';
  document.querySelector('#custom-term').value = '';
  render();
  document.querySelector('#custom-term').focus();
});
window.addEventListener('hashchange', () => {
  if (location.hash === '#main') {
    main.focus();
    return;
  }
  state.route = routeFromLocation();
  document.querySelector('.toast').hidden = true;
  if (dialog.open) dialog.close();
  render();
  scrollTo({ top: 0, behavior: 'instant' });
  main.focus({ preventScroll: true });
});
document.addEventListener('keydown', (e) => {
  const cell = e.target.closest('.map-cell');
  if (cell && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
    e.preventDefault();
    const grid = cell.closest('.collection-map');
    const cells = [...grid.querySelectorAll('.map-cell')];
    const index = cells.indexOf(cell);
    const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
    const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns };
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? cells.length - 1
          : Math.min(cells.length - 1, Math.max(0, index + offsets[e.key]));
    cells.forEach((item, i) => {
      item.tabIndex = i === next ? 0 : -1;
    });
    cells[next].focus();
  }
  if (e.key === 'Escape') {
    document.querySelector('nav').classList.remove('open');
    document.querySelector('.menu-toggle').setAttribute('aria-expanded', 'false');
  }
});
dialog.addEventListener('close', () => {
  const target =
    main.querySelector(`[data-pokemon="${state.selected}"]`) || main.querySelector('#dex-search');
  target?.focus({ preventScroll: true });
});
render();

document.addEventListener('change', (event) => {
  if (event.target.matches('[data-category-select]')) {
    state.category = event.target.value;
    if (state.preset === 'missing') state.gapIds = gaps().map((p) => p.n);
    render();
  }
});

document.addEventListener('change', (event) => {
  if (event.target.matches('[data-region],[data-form]')) {
    if (event.target.matches('[data-region]')) state.region = event.target.value;
    else {
      state.form = event.target.value;
      if (formOnly() && !['normal', 'shiny'].includes(state.category)) state.category = 'normal';
      state.evolve = false;
    }
    if (state.preset === 'missing') state.gapIds = gaps().map((p) => p.n);
    if (!scoped().some((p) => p.id === state.selected) && scoped().length)
      state.selected = scoped()[0].id;
    render();
  }
});

function download(content, extension) {
  const url = URL.createObjectURL(
    new Blob([content], {
      type: extension === 'csv' ? 'text/csv;charset=utf-8' : 'application/json',
    }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = `CatchGrid-${new Date().toISOString().slice(0, 10)}.${extension}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
document.addEventListener('click', (event) => {
  const b = event.target.closest('button');
  if (!b) return;
  try {
    if (b.matches('[data-export]'))
      download(b.dataset.export === 'csv' ? exportCsv() : exportBackup(), b.dataset.export);
    if (b.matches('[data-import-cancel]')) {
      pendingImport = null;
      render();
    }
    if (b.matches('[data-import-apply]') && pendingImport) {
      owned = commitImport(pendingImport);
      pendingImport = null;
      storageError = '';
      render();
      announce('Import saved on this browser.');
    }
  } catch (error) {
    announce(error.message);
  }
});
document.addEventListener('change', async (event) => {
  if (event.target.matches('[data-evolution]')) {
    state.evolve = event.target.checked;
    render();
  }
  if (event.target.id === 'import-file') {
    pendingImport = null;
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > 5000000) throw new Error('Choose a file smaller than 5 MB.');
      pendingImport = reviewImport(
        await file.text(),
        file.name.toLowerCase().endsWith('.json') ? 'json' : 'csv',
      );
      render();
    } catch (error) {
      document.querySelector('#import-review').textContent = error.message;
    }
  }
});
window.addEventListener('storage', () => {
  try {
    owned = collectionKeys();
    storageError = '';
    render();
  } catch (error) {
    storageError = error.message;
    render();
  }
});

window.addEventListener('catchgrid:update-ready', () => {
  document.querySelector('#app-update').hidden = false;
});
document.querySelector('[data-apply-update]').addEventListener('click', () => {
  window.dispatchEvent(new Event('catchgrid:apply-update'));
});
document.querySelector('[data-dismiss-update]').addEventListener('click', () => {
  document.querySelector('#app-update').hidden = true;
});
