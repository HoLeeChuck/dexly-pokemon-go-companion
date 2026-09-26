import { revealArtwork } from './motion.js';
import { updateMarkup } from './dom.js';
import { catalog, catalogDate, catalogSources, ledgerDate } from './catalog.js';
import {
  DEVICES,
  deviceFor,
  deviceFromSlug,
  officialDexUrl,
  evolutionFamily,
  dialWindow,
  pagesOf,
  sourceGroups,
} from './pokedex.js';
import {
  collectionKeys,
  collectedEntries,
  toggleCollection,
  setMany,
  exportBackup,
  exportCsv,
  reviewImport,
  reviewSheetImport,
  commitImport,
  recoverySnapshots,
  restoreSnapshot,
} from './data.js';
import evolutions from '../catalog/evolution-families.v1.json';
import { reviewedAt as gendersReviewedAt } from '../catalog/genders.v1.json';
import { missingSearch } from './search';
import { recommendations, discordMessages, DISCORD_CATEGORIES } from './recommendations.js';
import { medalShelf, nearlyComplete, evolutionHint, recap } from './insights.js';
import { categoryTotals, regionHeat, dailyActivity, activeStreak } from './dashboard.js';
import { readWorkbook, readText, collectionWorkbook } from './sheet.js';
import { SHARE_CATEGORIES, shareLink, parseShare, compare, helpSearch } from './share.js';
import { drawCollectionPoster, drawRecapCard, shareCanvas } from './poster.js';
import {
  legacyWindows,
  windowStatus,
  icsFor,
  reviewedAt as legacyReviewedAt,
} from './legacy-moves.js';

const categories = [
  ['normal', 'Normal', '◒'],
  ['male', 'Male', '♂'],
  ['female', 'Female', '♀'],
  ['shiny', 'Shiny', '✦'],
  ['lucky', 'Lucky', '◇'],
  ['hundo', '100%', 'IV'],
  ['xxl', 'XXL', 'XXL'],
  ['xxs', 'XXS', 'XXS'],
  ['shadow', 'Shadow', '◐'],
  ['purified', 'Purified', '○'],
];
const categoryLabels = Object.fromEntries(categories.map(([id, name]) => [id, name]));
// Alternate forms (Megas, regional forms, …) track Normal and Shiny only.
const formCategories = categories.filter(([id]) => ['normal', 'shiny'].includes(id));
const ROUTES = ['home', 'dex', 'progress', 'search', 'settings', 'compare', 'about'];
const ACCENTS = [
  ['slate', 'Slate'],
  ['green', 'Green'],
  ['blue', 'Blue'],
  ['purple', 'Purple'],
  ['red', 'Red'],
  ['orange', 'Orange'],
  ['pink', 'Pink'],
];
const REGIONS = [
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
// Base colors verified from Pokémon's official Pokédex main.css, 2026-09-24.
const typeClasses = (p) => `type-a-${p.types[0]} type-b-${p.types[1] || p.types[0]}`;
const complete = (p) => {
  const eligible = categories.filter(([c]) => p.rules[c] === 'released');
  return eligible.length > 0 && eligible.every(([c]) => isOwned(p, c));
};
const species = catalog.filter((p) => p.isDefault);

function pref(key, fallback) {
  try {
    return localStorage.getItem(`catchgrid:prism:${key}`) ?? fallback;
  } catch {
    return fallback;
  }
}
function setPref(key, value) {
  try {
    localStorage.setItem(`catchgrid:prism:${key}`, value);
  } catch {
    /* Preferences still apply for this visit. */
  }
}

function routeFromHash() {
  const value = location.hash.replace(/^#\/?/, '').split('?')[0];
  if (value === 'profile') return 'settings';
  return ROUTES.includes(value) ? value : 'home';
}
function presetFromHash() {
  const section = new URLSearchParams(location.hash.split('?')[1] || '').get('section');
  return (
    {
      'missing-searches': 'missing',
      'recommended-searches': 'cody',
      discord: 'discord',
      'legacy-moves': 'legacy',
    }[section] || 'custom'
  );
}

let owned = new Set();
let storageError = '';
try {
  owned = collectionKeys();
} catch (error) {
  storageError = error.message;
}
let pendingImport = null;
let lastBatch = null;
const main = document.querySelector('main');
const dialog = document.querySelector('#inspect-dialog');
const jumpDialog = document.querySelector('#jump-dialog');
const state = {
  route: routeFromHash(),
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
  mode: 'none',
  preset: presetFromHash(),
  // Progress grid: current page and the cell that keeps keyboard focus.
  gridPage: 0,
  gridCursor: null,
  nitro: false,
  discordCategories: new Set(DISCORD_CATEGORIES.map(([id]) => id)),
  evolveSizes: false,
  recapDays: 7,
  pendingBulk: null,
  reviewSnapshot: null,
  openAfterRoute: false,
  // Pokédex: the shelf of devices, or one device open in the scanner or grid view.
  dexOpen: false,
  dexView: 'hud',
  dexPage: 0,
};
// #dex shows the shelf; #dex?r=kanto opens that region's device.
function dexFromHash() {
  const slug = new URLSearchParams(location.hash.split('?')[1] || '').get('r');
  const device = slug && deviceFromSlug(slug);
  state.dexOpen = Boolean(device);
  if (device) state.region = device.region;
}
if (state.route === 'dex') dexFromHash();
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const label = () => categoryLabels[state.category];
const isOwned = (p, c = state.category) => owned.has(`${p.id}:${c}`);
const dex = (n) => `#${String(n).padStart(4, '0')}`;
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
const trainer = () => pref('trainer', '');
const accentColor = () =>
  getComputedStyle(document.documentElement).getPropertyValue('--violet').trim() || '#c4deec';

function announce(message, { silent = false, undo = false } = {}) {
  const t = document.querySelector('.toast');
  t.hidden = false;
  t.classList.toggle('sr-only', silent);
  t.querySelector('span').textContent = message;
  t.querySelector('[data-undo]').hidden = !undo;
  t.querySelector('.toast-copy').hidden = true;
}
function navigate(route) {
  location.hash = route;
  if (state.route === route) render();
}
const formOnly = () => ['mega', 'gigantamax', 'regional', 'alternate'].includes(state.form);
function lenses() {
  return `<label class="category-select">Collection category<select data-category-select>${(formOnly() ? formCategories : categories).map(([id, name]) => `<option value="${id}" ${state.category === id ? 'selected' : ''}>${name}</option>`).join('')}</select></label>`;
}
function scopeControls() {
  return `<div class="scope-controls"><label class="category-select">Region<select data-region>${REGIONS.map((r) => `<option ${state.region === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>${formSelect()}</div>`;
}
function formSelect() {
  return `<label class="category-select">Forms<select data-form>${[
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
    .join('')}<option disabled>Costumes · coming later</option></select></label>`;
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
  const silhouette = available && !isOwned(p) && pref('silhouettes', 'on') === 'on';
  return `<div data-key="${p.id}" class="target-wrap ${isOwned(p) ? 'owned' : ''} ${complete(p) ? 'complete' : ''} ${silhouette ? 'silhouette' : ''}"><button class="target" data-quick="${p.id}" ${available ? '' : 'disabled'} aria-pressed="${isOwned(p)}" aria-label="Toggle ${escape(p.name)} ${label()}, ${available ? (isOwned(p) ? 'collected' : 'missing') : ruleLabel(p)}${complete(p) ? ', all eligible categories complete' : ''}"><small>${dex(p.n)}</small><img src="${escape(art(p))}" alt="" loading="lazy" width="128" height="112"><strong>${escape(p.name)}</strong>${available ? '' : `<span class="status">${ruleLabel(p)}</span>`}</button><button class="inspect-link" data-pokemon="${p.id}" aria-label="View details for ${escape(p.name)}">View details ↗</button></div>`;
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
        `<div class="related-form ${complete(form) ? 'complete' : ''}" data-key="related-${form.id}"><strong>${escape(form.name)}</strong><div class="specimen-categories" role="group" aria-label="${escape(form.name)} collection" data-complete="${complete(form)}">${formCategories
          .map(
            ([id, name]) =>
              `<button data-form-toggle="${form.id}" data-category-toggle="${id}" aria-pressed="${isOwned(form, id)}" ${form.rules[id] !== 'released' ? 'disabled' : ''} aria-label="${escape(form.name)} ${name}: ${form.rules[id] !== 'released' ? ruleLabel(form, id) : isOwned(form, id) ? 'collected' : 'missing'}"><span class="register-track" aria-hidden="true"></span>${name}${form.rules[id] !== 'released' ? `<small>${ruleLabel(form, id)}</small>` : ''}</button>`,
          )
          .join('')}</div></div>`,
    )
    .join('')}</section>`;
}
function hintSection(p) {
  const hints = evolutionHint(p, owned, state.category, catalog, evolutions.families);
  if (!hints.length) return '';
  const names = hints.map((q) => escape(q.name)).join(' or ');
  return `<p class="evolve-hint" data-key="hint"><span aria-hidden="true">↗</span> You’ve registered ${names} in ${label()}. Evolving one could fill ${escape(p.name)} ${label()}.</p>`;
}
function categoryButtons(p) {
  return `<div class="specimen-categories" role="group" aria-label="Quick collection selection" data-complete="${complete(p)}">${(p.isDefault ? categories : formCategories).map(([id, name]) => `<button data-category-toggle="${id}" ${p.rules[id] !== 'released' ? 'disabled' : ''} aria-pressed="${isOwned(p, id)}" data-key="${id}" aria-label="Toggle ${name}: ${p.rules[id] !== 'released' ? ruleLabel(p, id) : isOwned(p, id) ? 'collected' : 'missing'}"><span class="register-track" aria-hidden="true"></span>${name}</button>`).join('')}</div>`;
}
function specimen() {
  const p = catalog.find((q) => q.id === state.selected);
  return `<aside data-key="inspector" class="specimen ${typeClasses(p)} ${complete(p) ? 'complete' : ''}" aria-label="${escape(p.name)} collection inspector"><div class="specimen-top"><span></span><span>${label().toUpperCase()}</span></div><div class="specimen-stage"><span class="specimen-index">${p.region.toUpperCase()} · ${dex(p.n)}</span><img src="${escape(art(p))}" alt="${escape(p.name)}${state.category === 'shiny' ? ' shiny appearance' : ''}" width="270" height="255"></div><div class="specimen-info"><h2>${escape(p.name)}</h2><div class="species-meta">${p.types.join(' / ')} · ${p.variantKind}${p.artworkIsFallback ? ' · Representative artwork' : ''}</div>${categoryButtons(p)}${hintSection(p)}${transformationSection(p)}</div><div class="specimen-controls"><button data-prev aria-label="Inspect previous Pokémon">←</button><span>Browse this selection</span><button data-next aria-label="Inspect next Pokémon">→</button></div></aside>`;
}
function medals() {
  const shelf = medalShelf(catalog, owned, state.category);
  return `<section class="medal-shelf" aria-labelledby="medal-title"><div class="section-title"><h2 id="medal-title">${label()} medals</h2><small>Regional species milestones · default forms only</small></div><div class="medal-row">${shelf
    .map(
      (m) =>
        `<div class="medal ${m.tier}" data-key="medal-${m.region}"><span class="medal-mark" aria-hidden="true">${m.mark}</span><strong>${m.region}</strong><small>${m.tier === 'none' ? 'No medal yet' : m.tier[0].toUpperCase() + m.tier.slice(1)} · ${m.collected}/${m.platinum}</small><small>${m.nextTier ? `${m.nextTarget - m.collected} to ${m.nextTier}` : 'Platinum complete'}</small></div>`,
    )
    .join('')}</div></section>`;
}
function nearlySection() {
  const list = nearlyComplete(catalog, owned, categories);
  if (!list.length) return '';
  return `<section class="nearly" aria-labelledby="nearly-title"><div class="section-title"><h2 id="nearly-title">Almost complete</h2><small>One or two categories left</small></div><div class="nearly-list">${list
    .map(
      ({ p, missing }) =>
        `<button class="nearly-item" data-key="nearly-${p.id}" data-pokemon="${p.id}"><img src="${escape(p.art)}" alt="" loading="lazy" width="56" height="56"><span><strong>${escape(p.name)}</strong><small>Only ${missing.map(([, name]) => name).join(' and ')} left</small></span></button>`,
    )
    .join('')}</div></section>`;
}
const gridCategories = () => (formOnly() ? formCategories : categories);
function gridPager(pages) {
  if (pages.length < 2) return '';
  return `<label class="grid-pager">Showing <select data-grid-page-select>${pages.map((pg, k) => `<option value="${k}" ${k === state.gridPage ? 'selected' : ''}>${dex(pg[0].n)}–${dex(pg[pg.length - 1].n)}</option>`).join('')}</select><span>of ${pages.length} pages</span></label>`;
}
function gridTable(list) {
  const cats = gridCategories();
  const totals = categoryTotals(scoped(), owned, cats);
  const pages = pagesOf(list);
  state.gridPage = Math.min(state.gridPage, pages.length - 1);
  const page = pages[state.gridPage] || [];
  // Roving focus: the remembered cell if it is on this page, otherwise the first markable one.
  const cursor = state.gridCursor;
  const onPage =
    cursor && page.some((p) => p.id === cursor.id && p.rules[cursor.cat] === 'released');
  const first = page.flatMap((p) =>
    cats.filter(([id]) => p.rules[id] === 'released').map(([id]) => ({ id: p.id, cat: id })),
  )[0];
  const focusable = onPage ? cursor : first;
  const head = `<thead><tr><th scope="col" class="grid-corner">${list.length} ${state.form === 'species' ? 'species' : 'forms'}</th>${totals
    .map((t) => {
      const pct = t.eligible ? (t.count / t.eligible) * 100 : 0;
      return `<th scope="col" class="cat-${t.id}"><button data-focus-cat="${t.id}" aria-pressed="${state.category === t.id}" title="${t.count} of ${t.eligible}" aria-label="${t.name}: ${t.count} of ${t.eligible}, ${percent(t.count, t.eligible)}. Use for the search string and filter"><span>${t.name}</span><small>${percent(t.count, t.eligible)}</small><i class="meter" aria-hidden="true"><b data-style="width:${pct.toFixed(2)}%"></b></i></button></th>`;
    })
    .join('')}<th scope="col" class="grid-done">Done</th></tr></thead>`;
  const rows = page
    .map((p) => {
      const eligibleCats = cats.filter(([id]) => p.rules[id] === 'released');
      const have = eligibleCats.filter(([id]) => isOwned(p, id)).length;
      const cells = cats
        .map(([id, name]) => {
          if (p.rules[id] !== 'released')
            return `<td><span class="gcell na" title="${ruleLabel(p, id)}"><span class="sr-only">${escape(p.name)} ${name}: ${ruleLabel(p, id)}</span></span></td>`;
          const on = isOwned(p, id);
          const tab = focusable?.id === p.id && focusable.cat === id ? 0 : -1;
          return `<td><button class="gcell cat-${id} ${on ? 'on' : ''}" data-cell="${p.id}" data-cat="${id}" aria-pressed="${on}" aria-label="${escape(p.name)} ${name}" tabindex="${tab}"></button></td>`;
        })
        .join('');
      return `<tr data-key="row-${p.id}" class="${eligibleCats.length && have === eligibleCats.length ? 'row-complete' : ''}"><th scope="row"><button class="grid-name" data-pokemon="${p.id}" aria-label="View details for ${escape(p.name)}"><img src="${escape(p.art)}" alt="" width="36" height="36" loading="lazy"><span class="grid-num">${dex(p.n)}</span><span class="grid-label">${escape(p.name)}</span></button></th>${cells}<td class="grid-done" title="${have} of ${eligibleCats.length} categories"><span>${percent(have, eligibleCats.length)}</span><i class="meter" aria-hidden="true"><b data-style="width:${eligibleCats.length ? ((have / eligibleCats.length) * 100).toFixed(2) : 0}%"></b></i></td></tr>`;
    })
    .join('');
  return `<div class="grid-meta"><p class="grid-help" id="grid-help">Click to mark. Drag down a column or Shift-click to fill a range. Arrow keys move, Space marks. Click a name for details.</p>${gridPager(pages)}</div><div class="grid-scroll"><table class="collection-grid" aria-label="${escape(state.region)} collection grid" aria-describedby="grid-help"><caption class="sr-only">Rows are Pokémon, columns are categories.</caption><colgroup><col class="col-name"><col span="${cats.length}" class="col-cat"><col class="col-done"></colgroup>${head}<tbody>${rows || `<tr><td colspan="${cats.length + 2}">${empty()}</td></tr>`}</tbody></table></div>`;
}
function stringPanel() {
  const value = missingSearch({
    items: scoped(),
    universe: catalog,
    owned,
    category: state.category,
    mode: state.mode,
    families: evolutions.families,
  });
  const where = state.region === 'All regions' ? 'all regions' : state.region;
  return `<aside class="string-panel" aria-labelledby="string-title"><h2 id="string-title">Search string</h2><p class="string-scope">Missing ${label()} · ${where}</p>${lenses()}<div class="segmented" role="group" aria-label="Storage filter">${[
    ['none', 'None'],
    ['personal', 'Personal'],
    ['tradeable', 'Tradeable'],
  ]
    .map(([v, n]) => `<button data-mode="${v}" aria-pressed="${state.mode === v}">${n}</button>`)
    .join(
      '',
    )}</div><code class="string-output" id="grid-string" tabindex="0">${escape(value) || `Every eligible ${label()} entry here is registered.`}</code><div class="string-meta"><span>${gaps().length} missing</span><span>${value.length.toLocaleString()} characters</span></div><button class="primary string-copy" ${value ? `data-copy-value="${escape(value)}"` : 'disabled'}>Copy search string</button><button class="quiet" data-compose>More options in Search Lab ↗</button></aside>`;
}
function progress() {
  return `<div class="progress-layout"><section class="grid-panel" aria-label="Collection grid"><div class="grid-toolbar">${scopeControls()}<label class="sr-only" for="grid-search">Search Pokémon</label><input class="search-input" id="grid-search" type="search" placeholder="Name, number, or type" value="${escape(state.query)}"><div class="segmented" role="group" aria-label="Show">${[
    ['all', 'All'],
    ['missing', `Missing ${label()}`],
    ['collected', `Have ${label()}`],
  ]
    .map(
      ([v, n]) => `<button data-filter="${v}" aria-pressed="${state.filter === v}">${n}</button>`,
    )
    .join('')}</div></div>${gridTable(matching())}</section>${stringPanel()}</div>`;
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
function dexView() {
  return state.dexOpen ? deviceView() : shelf();
}
function regionTally(region) {
  const list = species.filter(
    (p) =>
      (region === 'All regions' || p.region === region) && p.rules[state.category] === 'released',
  );
  return { total: list.length, count: list.filter((p) => isOwned(p)).length };
}
function deviceCard(d) {
  const { total, count } = regionTally(d.region);
  const pct = total ? Math.round((count / total) * 100) : 0;
  const numbers = species
    .filter((p) => d.region === 'All regions' || p.region === d.region)
    .map((p) => p.n);
  const faces = d.showcase.map((n) => species.find((p) => p.n === n)).filter(Boolean);
  return `<a class="device-card ${d.slug === 'national' ? 'master' : ''}" data-key="dev-${d.slug}" href="#dex?r=${d.slug}" data-style="--hue:${d.hue};--pct:${pct}" aria-label="Open the ${d.name} Pokédex: ${count} of ${total} ${label()} registered"><span class="device-lens" aria-hidden="true" ${d.region === state.region ? 'data-style="view-transition-name:dex-lens"' : ''}><span></span></span><span class="device-leds" aria-hidden="true"><i></i><i></i><i></i></span><span class="device-meta"><small>${d.gen} · ${dex(Math.min(...numbers))}–${dex(Math.max(...numbers))}</small><strong>${d.name}</strong></span><span class="device-faces" aria-hidden="true">${faces.map((p) => `<img src="${escape(p.art)}" alt="" width="72" height="72" loading="lazy" class="${isOwned(p) ? '' : 'unseen'}">`).join('')}</span><span class="device-meter" aria-hidden="true"><span class="device-ring"><b>${pct}%</b></span><span>${count} / ${total}</span></span></a>`;
}
function shelf() {
  const [national, ...regions] = DEVICES;
  return `<section class="shelf" aria-labelledby="shelf-title"><div class="shelf-head"><div><div class="eyebrow">POKÉDEX ATLAS</div><h2 id="shelf-title">Choose a Pokédex</h2><p>Every region on one shelf. Open a device to scan its Pokémon one by one, or switch to the grid to mark them fast.</p></div><div class="collection-controls">${lenses()}</div></div>${deviceCard(national)}<div class="shelf-grid">${regions.map(deviceCard).join('')}</div></section>`;
}
function deviceView() {
  const d = deviceFor(state.region);
  const list = matching();
  const total = eligible().length;
  const count = eligible().filter((p) => isOwned(p)).length;
  const views = [
    ['hud', 'Scanner'],
    ['grid', 'Grid'],
  ];
  return `<section class="device" data-key="device" data-style="--hue:${d.hue}" aria-labelledby="device-title"><div class="device-bar"><a class="device-back" href="#dex" aria-label="All Pokédexes"><span aria-hidden="true">‹</span><span class="device-back-text" aria-hidden="true">All Pokédexes</span></a><span class="device-lens small" aria-hidden="true" data-style="view-transition-name:dex-lens"><span></span></span><div class="device-name"><small>${d.gen}</small><h2 id="device-title">${d.name} Pokédex</h2></div><div class="device-count"><strong>${count}</strong><span>/ ${total}</span><small>${label()} registered</small></div><div class="view-switch" role="group" aria-label="Pokédex view">${views.map(([id, name]) => `<button data-dex-view="${id}" aria-pressed="${state.dexView === id}">${name}</button>`).join('')}</div></div><div class="device-tools"><label class="sr-only" for="dex-search">Search Pokémon</label><input class="search-input" id="dex-search" type="search" placeholder="Name, number, or type…" value="${escape(state.query)}"><div class="filter-group" role="group" aria-label="Collection status">${['all', 'missing', 'collected'].map((s) => `<button data-filter="${s}" aria-pressed="${state.filter === s}">${s[0].toUpperCase() + s.slice(1)}</button>`).join('')}</div>${formSelect()}${lenses()}<small id="results-count" aria-live="polite">${list.length} ${state.form === 'species' ? 'species' : 'forms'}</small><button class="quiet" data-compose>Search missing ${label()} ↗</button></div>${state.dexView === 'hud' ? hud(list) : dexGrid(list)}</section>`;
}
function familySection(p) {
  if (!p.isDefault) return '';
  const members = evolutionFamily(p.n, evolutions.families)
    .map((n) => species.find((q) => q.n === n))
    .filter(Boolean);
  if (members.length < 2) return '';
  return `<section class="family" data-key="family" aria-label="Evolution family"><div class="readout-label">Evolution family</div><div class="family-row">${members
    .map((q) => {
      const current = q.id === p.id;
      return `<button data-pokemon="${q.id}" data-key="fam-${q.id}" class="family-member ${current ? 'current' : ''} ${isOwned(q) ? 'owned' : ''}" ${current ? 'aria-current="true"' : ''} aria-label="${escape(q.name)}, ${isOwned(q) ? 'collected' : 'missing'} ${label()}"><img src="${escape(art(q))}" alt="" width="56" height="56" loading="lazy"><span>${escape(q.name)}</span></button>`;
    })
    .join('')}</div></section>`;
}
function hud(list) {
  if (!list.length) return empty();
  let i = list.findIndex((p) => p.id === state.selected);
  if (i < 0) {
    i = 0;
    state.selected = list[0].id;
  }
  const p = list[i];
  const available = p.rules[state.category] === 'released';
  const status = available ? (isOwned(p) ? 'Registered' : 'Not registered') : ruleLabel(p);
  const dial = dialWindow(list, i, 5)
    .map(
      ({ item: q, offset }) =>
        `<li data-key="d${offset}" data-style="--d:${Math.abs(offset)}"><button data-pokemon="${q.id}" class="dial-item ${offset === 0 ? 'current' : ''} ${isOwned(q) ? 'owned' : ''}" ${offset === 0 ? 'aria-current="true"' : ''} tabindex="${offset === 0 ? 0 : -1}" aria-label="${escape(q.name)}, ${dex(q.n)}"><img src="${escape(art(q))}" alt="" width="48" height="48" loading="lazy"><small>${String(q.n).padStart(4, '0')}</small></button></li>`,
    )
    .join('');
  return `<div class="hud" data-key="hud"><div class="hud-stage ${typeClasses(p)} ${available && isOwned(p) ? 'registered' : ''}" data-key="stage"><span class="hud-rings" aria-hidden="true"><i></i><i></i><i></i></span><span class="hud-corners" aria-hidden="true"></span><span class="hud-number" aria-hidden="true">${dex(p.n)}</span><img data-key="art-${p.id}" src="${escape(art(p))}" alt="${escape(p.name)}${state.category === 'shiny' ? ' shiny appearance' : ''}" width="320" height="300"><span class="hud-status">${status} · ${label()}</span><span class="hud-scan" aria-hidden="true"></span></div><aside class="hud-readout ${complete(p) ? 'complete' : ''}" data-key="readout" aria-label="${escape(p.name)} collection inspector"><div class="readout-head"><small>${dex(p.n)} · ${p.region} · Gen ${p.generation}</small><h3>${escape(p.name)}</h3><div class="type-chips">${p.types.map((t) => `<span class="type-chip type-a-${t}">${t}</span>`).join('')}${p.artworkIsFallback ? '<span class="annotation">Representative artwork</span>' : ''}</div></div><div class="readout-label">Registration</div>${categoryButtons(p)}${hintSection(p)}${familySection(p)}${transformationSection(p)}<a class="official-link" href="${officialDexUrl(p.speciesName)}" target="_blank" rel="noopener">Read the official Pokédex entry <span aria-hidden="true">↗</span><small>Opens Pokémon.com in a new tab</small></a></aside><div class="dial" data-key="dial"><button class="dial-step" data-prev aria-label="Inspect previous Pokémon">‹</button><ol class="dial-strip" aria-label="Nearby Pokémon">${dial}</ol><button class="dial-step" data-next aria-label="Inspect next Pokémon">›</button><label class="dial-scrub"><span>${i + 1} / ${list.length}</span><input id="dex-dial" type="range" min="1" max="${list.length}" value="${i + 1}" aria-label="Scan through ${list.length} Pokémon" aria-valuetext="${escape(p.name)}, ${i + 1} of ${list.length}"></label></div></div>`;
}
function dexGrid(list) {
  const pages = pagesOf(list);
  state.dexPage = Math.min(state.dexPage, pages.length - 1);
  const page = pages[state.dexPage];
  const pager = (where) =>
    pages.length > 1
      ? `<div class="pager" data-key="pager-${where}" role="group" aria-label="Pokédex pages">${pages.map((pg, k) => `<button data-dex-page="${k}" aria-pressed="${k === state.dexPage}">${dex(pg[0].n)}–${dex(pg[pg.length - 1].n)}</button>`).join('')}</div>`
      : '';
  return `<div class="dex-grid-view" data-key="grid-view"><div class="dex-legend" aria-label="Collection indicators"><span><i class="legend-outline"></i>Missing</span><span><i class="legend-outline owned"></i>${label()} collected</span><span><i class="legend-outline complete"></i>All categories complete</span></div>${pager('top')}<div class="target-list dex-grid" id="dex-results">${page.map(target).join('') || empty()}</div>${pager('bottom')}</div>`;
}
function about() {
  const groups = sourceGroups(catalogSources);
  const links = (items) =>
    `<ul class="source-list">${items.map((s) => `<li><a href="${escape(s.url)}" target="_blank" rel="noopener"><strong>${escape(s.host)}</strong><span>${escape(s.url.replace(/^https:\/\/[^/]+/, '') || '/')}</span></a></li>`).join('')}</ul>`;
  return `<div class="about-layout"><section class="about-hero"><div class="eyebrow">SOURCES &amp; CREDITS</div><h2>A fan-made Pokédex, built with care.</h2><p>CatchGrid is an unofficial, non-commercial fan project for tracking a Pokémon GO collection. It is free, has no ads, and has no connection to any game account.</p></section><section><h2>Copyright and trademarks</h2><p>Pokémon, Pokémon GO, Pokémon character names, and all related artwork are trademarks and © of Nintendo, Creatures Inc., GAME FREAK inc., The Pokémon Company, and Niantic, Inc. CatchGrid is not affiliated with, endorsed, sponsored, or approved by any of them. Names and artwork appear only to identify Pokémon in a personal collection tracker.</p><p class="annotation">© 1995–${new Date().getFullYear()} Nintendo / Creatures Inc. / GAME FREAK inc. Pokémon GO © Niantic, Inc.</p></section><section><h2>Pokédex entries</h2><p>CatchGrid does not copy Pokédex text. Each Pokémon links to its entry in the <a href="https://www.pokemon.com/us/pokedex" target="_blank" rel="noopener">official Pokédex at Pokémon.com</a>. Type colors follow that Pokédex.</p></section><section><h2>Artwork</h2><p>Pokémon HOME artwork from the <a href="https://archives.bulbagarden.net/wiki/Category:HOME_artwork" target="_blank" rel="noopener">Bulbagarden Archives</a>, stored with CatchGrid rather than hotlinked. Artwork © The Pokémon Company; see the <a href="https://archives.bulbagarden.net/wiki/Archives:Copyrights" target="_blank" rel="noopener">Archives copyright notice</a>. Artwork is not proof that a Pokémon is available in Pokémon GO.</p></section><section><h2>Availability data</h2><p>Release, Shiny, Shadow and form availability was reviewed on ${catalogDate}${ledgerDate ? `, with release updates through ${ledgerDate}` : ''} against official Pokémon GO news and help pages where they exist, and cross-checked with community references. Dated corrections are kept in the catalog with their sources. Which genders each species can be comes from a community Pokédex spreadsheet, reviewed ${escape(gendersReviewedAt)}; the official Pokédex is the reference for corrections.</p><details><summary>Official sources (${groups.official.length})</summary>${links(groups.official)}</details><details><summary>Community references (${groups.secondary.length})</summary>${links(groups.secondary)}</details></section><section><h2>Your data</h2><p>Your collection is saved in this browser only. Compare links carry their data inside the link itself; nothing is uploaded. The public site uses Cloudflare’s cookie-free web analytics for aggregate visit counts.</p></section></div>`;
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
let entriesCache = null;
const entries = () => (entriesCache ??= storageError ? [] : collectedEntries());
function copyRow(value, id) {
  return `<div class="copy-row" data-key="${id}"><code tabindex="0">${escape(value)}</code><button class="secondary" data-copy-value="${escape(value)}">Copy</button></div>`;
}
function codyPanel() {
  return `<section class="cody-panel" aria-labelledby="cody-title"><h2 id="cody-title">Cody’s recommended searches</h2><p>Saved storage searches in a deliberate order. Tag names are Cody’s; swap in your own.</p>${recommendations(
    species,
    entries(),
  )
    .map(
      (r) =>
        `<article class="recommendation" data-key="rec-${r.id}"><h3>${r.name}</h3><p>${escape(r.description)}</p>${r.values.length ? r.values.map((v, i) => copyRow(v, `rec-${r.id}-${i}`)).join('') : `<p class="annotation">${escape(r.emptyMessage || '')}</p>`}${r.help ? `<p class="annotation">${escape(r.help)}</p>` : ''}</article>`,
    )
    .join('')}</section>`;
}
function discordPanel() {
  const messages = discordMessages(species, entries(), {
    nitro: state.nitro,
    categories: state.discordCategories,
    evolveSizes: state.evolveSizes,
  });
  return `<section class="discord-panel" aria-labelledby="discord-title"><h2 id="discord-title">Share your missing lists on Discord</h2><p>Messages are split to fit Discord’s limit and copy exactly as shown.</p><div class="term-buttons" role="group" aria-label="Lists to include">${DISCORD_CATEGORIES.map(([id, name]) => `<button data-discord-category="${id}" aria-pressed="${state.discordCategories.has(id)}">${name}</button>`).join('')}</div><label class="evolve-option"><input type="checkbox" data-nitro ${state.nitro ? 'checked' : ''}> I use Discord Nitro (4,000-character messages)</label><label class="evolve-option"><input type="checkbox" data-evolve-sizes ${state.evolveSizes ? 'checked' : ''}> Include earlier stages for missing XXL/XXS</label>${
    messages.length
      ? messages
          .map(
            (m, i) =>
              `<article class="discord-message" data-key="discord-${i}"><h3>Message ${i + 1} of ${messages.length}</h3><pre tabindex="0">${escape(m)}</pre><button class="secondary" data-copy-value="${escape(m)}">Copy Discord message</button>${navigator.share ? `<button class="quiet" data-share-text="${escape(m)}">Share…</button>` : ''}</article>`,
          )
          .join('')
      : '<p class="annotation">Choose at least one list with missing entries to build a message.</p>'
  }</section>`;
}
function legacyPanel() {
  const windows = legacyWindows();
  const active = windows.some((w) => windowStatus(w) === 'Active');
  return `<section class="legacy-panel"><h2>Legacy move windows</h2><p>Reviewed ${legacyReviewedAt}. ${active ? 'An entry below is within its announced window.' : 'No active featured-attack window is confirmed in this reviewed list.'} This is a dated selection, not a live or exhaustive event feed.</p>${windows
    .map((w) => {
      const status = windowStatus(w);
      return `<article data-key="legacy-${w.id}"><span class="page-count">${status === 'Active' ? 'Active in your device time zone' : status}</span><h3>${escape(w.name)} · ${escape(w.move)}</h3><p>${escape(w.method)} between ${new Date(w.start).toLocaleString()} and ${new Date(w.end).toLocaleString()} local time. ${status === 'Ended' ? 'This window has ended; evolving now does not grant this event attack.' : ''}</p><a href="${escape(w.url)}" target="_blank" rel="noopener">Official announcement ↗</a>${status === 'Ended' ? '' : ` <button class="quiet" data-ics="${escape(w.id)}">Add to calendar</button>`}</article>`;
    })
    .join(
      '',
    )}<p>Event acquisition and Elite TM eligibility are different. Confirm the move in the game’s Elite TM preview before spending an item. Event windows use your device’s local time zone; verify it matches your location.</p><a class="secondary" href="https://pokemongo.com/news" target="_blank" rel="noopener">Check latest official announcements ↗</a></section>`;
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
  const tabs = [
    ['custom', 'Build my own'],
    ['missing', 'My missing'],
    ['cody', 'Cody’s picks'],
    ['discord', 'Discord'],
    ['legacy', 'Legacy moves'],
  ];
  const body = {
    legacy: legacyPanel,
    cody: codyPanel,
    discord: discordPanel,
  }[state.preset];
  return `<div class="subnav" role="group" aria-label="Search starting point">${tabs.map(([id, name]) => `<button data-preset="${id}" aria-pressed="${state.preset === id}">${name}</button>`).join('')}</div>${
    body
      ? body()
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
          )}</div></details></div><aside class="query-board" aria-label="Generated query"><h2>${missing ? `Missing ${label()}` : 'Your search'}</h2><code id="query-text" aria-live="polite">${escape(query()) || (missing ? 'No matching missing entries or evolution candidates.' : 'Choose a filter to begin.')}</code><button class="primary" data-copy ${query() ? '' : 'disabled'}>Copy search string ↗</button><p>Paste into Pokémon GO’s storage search.</p>${missing ? '<p>Species numbers may also match alternate forms. This finds candidates; it does not read your in-game collection.</p>' : ''}</aside></div>`
  }`;
}
// Whole percent, but never show 0% once something is registered.
function percent(count, eligible) {
  if (!eligible) return '–';
  const pct = Math.floor((count / eligible) * 100);
  return count && !pct ? '<1%' : `${pct}%`;
}
// Apple Watch style: one ring per category, Normal outermost, nested toward the centre.
function activityRings(totals, overall) {
  // Sized so ten rings still leave room for the overall figure in the centre.
  const size = 300;
  const stroke = 9.5;
  const gap = 2;
  const mid = size / 2;
  const circles = totals
    .map((t, i) => {
      const r = size / 2 - stroke / 2 - i * (stroke + gap);
      const c = 2 * Math.PI * r;
      const pct = t.eligible ? t.count / t.eligible : 0;
      return `<g class="cat-${t.id}" data-style="--c:${c.toFixed(1)}"><circle class="ring-track" cx="${mid}" cy="${mid}" r="${r.toFixed(1)}"/><circle class="ring-value" cx="${mid}" cy="${mid}" r="${r.toFixed(1)}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - pct)).toFixed(1)}"/></g>`;
    })
    .join('');
  const legend = totals
    .map((t) => {
      const pct = t.eligible ? (t.count / t.eligible) * 100 : 0;
      return `<a class="ring-legend-item cat-${t.id}" data-key="ring-${t.id}" href="#progress" data-focus-cat="${t.id}" data-focus-region="All regions" aria-label="${t.name}: ${t.count} of ${t.eligible} registered, ${percent(t.count, t.eligible)}. Open in Progress"><i class="ring-dot" aria-hidden="true"></i><span class="ring-name">${t.name}</span><strong>${percent(t.count, t.eligible)}</strong><i class="meter" aria-hidden="true"><b data-style="width:${pct.toFixed(2)}%"></b></i><small>${t.count.toLocaleString()} / ${t.eligible.toLocaleString()}</small></a>`;
    })
    .join('');
  return `<div class="rings"><svg class="rings-art" viewBox="0 0 ${size} ${size}" role="img" aria-label="Category rings, Normal outermost to Purified innermost, ${overall}% overall">${circles}<text x="${mid}" y="${mid - 2}" class="rings-total">${overall}%</text><text x="${mid}" y="${mid + 18}" class="rings-caption">overall</text></svg><div class="ring-legend">${legend}</div></div>`;
}
function heatCard() {
  const rows = regionHeat(species, owned, categories, REGIONS.slice(1));
  return `<section class="dash-card heat-card" aria-labelledby="heat-title"><div class="card-head"><h2 id="heat-title">Regions by category</h2><small>Hover for counts · select a cell to work on it</small></div><div class="heat-scroll"><table class="heat"><thead><tr><th scope="col"><span class="sr-only">Region</span></th>${categories.map(([id, name]) => `<th scope="col" class="cat-${id}">${name}</th>`).join('')}</tr></thead><tbody>${rows
    .map(
      (r) =>
        `<tr data-key="heat-${r.region}"><th scope="row">${r.region}</th>${r.cells
          .map((c) => {
            if (!c.eligible) return '<td><span class="heat-cell empty">–</span></td>';
            const pct = (c.count / c.eligible) * 100;
            return `<td><a class="heat-cell cat-${c.id} ${c.count === c.eligible ? 'full' : ''} ${c.count ? '' : 'zero'}" href="#progress" data-focus-cat="${c.id}" data-focus-region="${r.region}" title="${c.count} of ${c.eligible}" aria-label="${r.region} ${c.name}: ${c.count} of ${c.eligible}, ${percent(c.count, c.eligible)}"><span>${percent(c.count, c.eligible)}</span><i class="meter" aria-hidden="true"><b data-style="width:${pct.toFixed(2)}%"></b></i></a></td>`;
          })
          .join('')}</tr>`,
    )
    .join('')}</tbody></table></div></section>`;
}
function activityCard(days) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const month = days.reduce((sum, d) => sum + d.count, 0);
  const busiest = days.reduce((best, d) => (d.count > best.count ? d : best), days[0]);
  const dated = entries().some((e) => e.updatedAt);
  const bars = days
    .map((d, i) => {
      const h = d.count ? Math.max(3, (d.count / max) * 56) : 0;
      return `<rect x="${i * 10 + 1}" y="${(60 - h).toFixed(1)}" width="7" height="${h.toFixed(1)}" rx="2"><title>${d.day}: ${d.count}</title></rect>`;
    })
    .join('');
  return `<section class="dash-card activity-card" aria-labelledby="activity-title"><div class="card-head"><h2 id="activity-title">Activity</h2><small>${month} in the last 30 days</small></div>${
    dated
      ? `<svg class="activity-chart" viewBox="0 0 300 64" preserveAspectRatio="none" role="img" aria-label="Registrations per day for the last 30 days: ${month} in total"><line x1="0" y1="60.5" x2="300" y2="60.5"/>${bars}</svg><div class="activity-foot"><small>${busiest.count ? `Busiest: ${new Date(`${busiest.day}T12:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${busiest.count}` : 'No entries yet this month'}</small><button class="quiet" data-recap-card>Recap card ↗</button></div>`
      : '<p class="annotation">Dates are recorded from September 25, 2026 on. Mark new catches and your activity builds up here.</p>'
  }</section>`;
}
function kpi(id, name, value, sub, extra = '') {
  return `<div class="kpi" data-key="kpi-${id}"><span class="kpi-label">${name}</span><strong class="kpi-value">${value}</strong><span class="kpi-sub">${sub}</span>${extra}</div>`;
}
function toolsCard() {
  const shareable = SHARE_CATEGORIES.includes(state.category);
  const next = legacyWindows().find((w) => windowStatus(w) !== 'Ended');
  return `<section class="dash-card tools-card" aria-labelledby="tools-title"><div class="card-head"><h2 id="tools-title">Share and tools</h2><small>Nothing uploaded</small></div><div class="tool-list"><button data-poster><span>Create poster ↗</span><small>${label()} map and medals as a PNG</small></button><button data-share-link ${shareable ? '' : 'disabled'}><span>Copy compare link</span><small>${shareable ? `${label()} · friends see who can help whom` : 'Normal, Shiny, XXL and XXS only'}</small></button>${next ? `<a href="#search?section=legacy-moves" data-preset-link="legacy"><span>Next legacy move</span><small>${escape(next.name)} · ${escape(next.move)} · ${new Date(next.start).toLocaleDateString()}</small></a>` : ''}<a href="#settings"><span>Import and export</span><small>JSON backup or CSV for spreadsheets</small></a><a href="#dex"><span>Pokédex</span><small>Browse region by region</small></a></div></section>`;
}
function importReviewMarkup() {
  if (!pendingImport) return '';
  const actions = `<button class="primary" data-import-apply ${pendingImport.count ? '' : 'disabled'}>Apply reviewed import</button><button class="quiet" data-import-cancel>Cancel</button>`;
  if (pendingImport.kind !== 'sheet')
    return `<p>${pendingImport.count} collected entries to import. ${escape(pendingImport.description)}</p>${actions}`;
  const s = pendingImport.summary;
  const byCategory = {};
  for (const e of pendingImport.adds)
    byCategory[e.categoryId] = (byCategory[e.categoryId] || 0) + 1;
  const notes = [
    pendingImport.already ? `${pendingImport.already} already registered here` : '',
    s.notTracked
      ? `${s.notTracked} cells for regional forms beyond Normal and Shiny aren’t tracked`
      : '',
    s.notEligible ? `${s.notEligible} cells aren’t available in Pokémon GO per the catalog` : '',
    s.unmatched.length
      ? `${s.unmatched.length} rows not recognised: ${escape(s.unmatched.slice(0, 5).join(', '))}${s.unmatched.length > 5 ? '…' : ''}`
      : '',
  ].filter(Boolean);
  return `<div class="sheet-review"><p><strong>${pendingImport.count.toLocaleString()} new entries</strong> from ${s.rows.toLocaleString()} rows (${s.pokemon.toLocaleString()} Pokémon).</p>${
    pendingImport.count
      ? `<ul class="sheet-review-counts">${categories
          .filter(([id]) => byCategory[id])
          .map(
            ([id, name]) =>
              `<li class="cat-${id}"><span>${name}</span><strong>+${byCategory[id]}</strong></li>`,
          )
          .join('')}</ul>`
      : '<p>Everything in this sheet is already registered here.</p>'
  }${notes.length ? `<p class="annotation">${notes.join(' · ')}.</p>` : ''}${skippedDetails(s.skipped)}${actions}</div>`;
}
/** Which spreadsheet cells were left out, grouped by category, so they can be checked. */
function skippedDetails(skipped) {
  if (!skipped?.length) return '';
  const groups = categories
    .map(([id, name]) => [name, skipped.filter((s) => s.categoryId === id)])
    .filter(([, list]) => list.length);
  return `<details class="sheet-skipped"><summary>See skipped cells</summary><p class="annotation">Skipped cells stay in your spreadsheet. If the catalog is out of date for any of these, they can be corrected with a dated source.</p><dl>${groups
    .map(
      ([name, list]) =>
        `<dt>${name} <small>${list.length}</small></dt><dd>${list
          .map(
            (s) =>
              `${escape(`#${s.n} ${s.name}`)}${s.reason === 'notTracked' ? ' <small>(form)</small>' : ''}`,
          )
          .join(', ')}</dd>`,
    )
    .join('')}</dl></details>`;
}
/** Search string and missing count for the spreadsheet's trade search tab. */
function sheetSearch(categoryId) {
  const missing = species.filter(
    (p) => p.rules[categoryId] === 'released' && !owned.has(`${p.id}:${categoryId}`),
  ).length;
  const value = missingSearch({
    items: species,
    universe: catalog,
    owned,
    category: categoryId,
    mode: 'tradeable',
    families: evolutions.families,
  });
  return { value, missing };
}
function home() {
  const totals = categoryTotals(species, owned, categories);
  const have = totals.reduce((sum, t) => sum + t.count, 0);
  const all = totals.reduce((sum, t) => sum + t.eligible, 0);
  const normal = totals[0];
  const pct = all ? Math.floor((have / all) * 1000) / 10 : 0;
  const mastered = species.filter((p) => p.rules.normal === 'released' && complete(p)).length;
  const days = dailyActivity(entries(), 30);
  const week = days.slice(-7).reduce((sum, d) => sum + d.count, 0);
  const streak = activeStreak(days);
  return `<div class="dash"><div class="dash-top"><p class="hero-eyebrow">${trainer() ? `Trainer ${escape(trainer())}` : 'Your collection'}</p><div class="hero-actions"><button class="secondary" data-compose>Build a search</button><a class="primary" href="#progress">Update collection</a></div></div><div class="kpi-row" aria-label="Collection summary">${kpi('overall', 'Overall', `${pct}%`, `${have.toLocaleString()} of ${all.toLocaleString()} entries`, `<i class="kpi-bar" data-style="--p:${pct}%" aria-hidden="true"></i>`)}${kpi('species', 'Species', normal.count.toLocaleString(), `of ${normal.eligible.toLocaleString()} registered`)}${kpi('complete', 'Complete', mastered.toLocaleString(), 'every category done')}${kpi('week', 'This week', week.toLocaleString(), `${days.at(-1).count} today`)}${kpi('streak', 'Streak', `${streak} ${streak === 1 ? 'day' : 'days'}`, streak ? 'Keep it going' : 'Mark one today')}</div><section class="dash-card ring-card" aria-labelledby="ring-title"><div class="card-head"><h2 id="ring-title">Categories</h2><small>National Dex species · select one to work on it</small></div>${activityRings(totals, pct)}</section><div class="bento">${heatCard()}${activityCard(days)}${nearlySection() || '<section class="nearly"><div class="section-title"><h2>Almost complete</h2></div><p class="annotation">Pokémon one or two categories from complete show up here.</p></section>'}${medals()}${toolsCard()}</div></div>`;
}
function compareView() {
  const share = parseShare(location.hash);
  if (!share)
    return '<div class="settings-layout"><section><h2>This compare link can’t be read</h2><p>It may have been cut off when it was copied. Ask your friend to send it again.</p><a class="primary" href="#progress">Open your map</a></section></div>';
  const result = compare(catalog, owned, share);
  const who = share.name || 'Your friend';
  const whom = share.name || 'your friend';
  const cat = categoryLabels[share.category];
  const list = (items) =>
    items.length
      ? `<div class="compare-list">${items
          .slice(0, 60)
          .map(
            (p) =>
              `<button class="compare-chip" data-key="c-${p.id}" data-pokemon="${p.id}" data-open-dex>${dex(p.n)} ${escape(p.name)}</button>`,
          )
          .join(
            '',
          )}${items.length > 60 ? `<span class="annotation">and ${items.length - 60} more</span>` : ''}</div>`
      : '<p class="annotation">None.</p>';
  const search = helpSearch(result.youCanHelp, share.category);
  return `<div class="compare-layout"><section class="compare-head"><div class="eyebrow">COMPARE · ${cat.toUpperCase()}</div><h2>${escape(who)} has ${result.theirCount} of ${result.total}</h2><p>You have ${result.total - result.bothMissing.length - result.theyCanHelp.length} of ${result.total}. Compared on this device; nothing was uploaded.</p></section><section><h2>You could help ${escape(whom)} with ${result.youCanHelp.length}</h2><p>You’ve registered these in ${cat}; ${escape(whom)} hasn’t.</p>${list(result.youCanHelp)}${search ? `<h3>Find untraded candidates in your storage</h3>${copyRow(search, 'help-search')}<p class="annotation">Registered doesn’t mean you still have one. Traded Pokémon can’t be traded again, so the search excludes them.</p>` : ''}</section><section><h2>${escape(who)} could help you with ${result.theyCanHelp.length}</h2>${list(result.theyCanHelp)}</section><section><h2>Neither of you has ${result.bothMissing.length}</h2><p class="annotation">Good targets to hunt together.</p></section><section><h2>Send yours back</h2><p>Copy your own ${cat} compare link to reply.</p><button class="secondary" data-share-link data-share-category="${share.category}">Copy my compare link</button></section></div>`;
}
function settings() {
  const accent = pref('accent', 'slate');
  const snapshots = storageError ? [] : recoverySnapshots();
  const regionTotals = REGIONS.slice(1, -1).map((region) => [
    region,
    species.filter((p) => p.region === region && p.rules.normal === 'released').length,
  ]);
  const review = snapshots.find((s) => s.id === state.reviewSnapshot);
  return `<div class="settings-layout"><section><h2>Appearance</h2><p>Dark by default. Your choices are remembered on this browser.</p><button class="secondary" data-theme>Switch light / dark ◐</button><fieldset class="accent-picker"><legend>Accent color</legend>${ACCENTS.map(([id, name]) => `<button class="accent-swatch accent-${id}" data-accent="${id}" aria-pressed="${accent === id}"><span aria-hidden="true"></span>${name}</button>`).join('')}</fieldset><label class="evolve-option"><input type="checkbox" data-silhouettes ${pref('silhouettes', 'on') === 'on' ? 'checked' : ''}> Show missing Pokémon as silhouettes in the Dex</label></section><section><h2>Trainer name</h2><p>Optional. Signs your posters, recap cards and compare links. Stays on this browser.</p><label class="sr-only" for="trainer-name">Trainer name</label><input class="search-input" id="trainer-name" maxlength="24" value="${escape(trainer())}" placeholder="Your trainer name"></section><section><h2>Export collection</h2><p>The spreadsheet matches the community Pokédex list: one tab per region with gender, Shiny, 100%, Lucky, XXL, XXS, Shadow and Purified, plus trade search strings. JSON is a complete CatchGrid backup.</p><button class="primary" data-export="xlsx">Download spreadsheet (.xlsx)</button><button class="secondary" data-export="json">Download JSON backup</button><button class="secondary" data-export="csv">Download CSV</button></section><section><h2>Import collection</h2><p>Choose the community spreadsheet (.xlsx, from Google Sheets: File › Download › Microsoft Excel), a CatchGrid backup or a CSV. Spreadsheet imports only add; nothing you’ve registered is removed. You review everything before it’s saved.</p><label class="secondary">Choose spreadsheet, backup or CSV<input id="import-file" type="file" accept=".xlsx,.json,.csv,.tsv,.txt" /></label><details class="paste-rows"><summary>Or paste rows from your spreadsheet</summary><label for="paste-rows" class="sr-only">Rows copied from your spreadsheet</label><textarea id="paste-rows" rows="5" placeholder="Copy rows from the sheet (Number, Pokémon, gender, Shiny, 100%, …) and paste them here"></textarea><button class="secondary" data-paste-review>Review pasted rows</button></details><div id="import-review" role="status">${importReviewMarkup()}</div></section><section><h2>Recovery snapshots</h2><p>CatchGrid keeps up to five automatic copies on this browser before big changes. Restoring saves your current collection as a new snapshot first.</p>${
    snapshots.length
      ? `<ul class="snapshot-list">${snapshots
          .map(
            (s) =>
              `<li data-key="snap-${s.id}"><span><strong>${new Date(s.summary.createdAt).toLocaleString()}</strong><small>${escape(s.summary.sourceName)} · ${s.summary.collectionRecords} ${s.summary.collectionRecords === 1 ? 'record' : 'records'}</small></span><button class="quiet" data-review-snapshot="${escape(s.id)}">Review</button></li>`,
          )
          .join('')}</ul>`
      : '<p class="annotation">No snapshots yet.</p>'
  }${review ? `<div class="confirm-box" role="group" aria-label="Confirm restore"><p>Restore ${review.summary.collectionRecords} collection ${review.summary.collectionRecords === 1 ? 'record' : 'records'} from ${new Date(review.summary.createdAt).toLocaleString()}? Catalog ${review.summary.catalogCompatibility === 'current' ? 'matches' : 'differs; unknown forms are kept as-is'}.</p><button class="primary" data-restore-snapshot="${escape(review.id)}">Restore this snapshot</button><button class="quiet" data-cancel-snapshot>Cancel</button></div>` : ''}</section><section><h2>Bulk region setup</h2><p>Mark or clear a whole region’s obtainable Normal entries. Shiny, Lucky, sizes, Shadow and Purified are never changed. Paint mode on the Progress map handles smaller ranges.</p><ul class="region-setup">${regionTotals
    .map(([region, count]) => {
      const pending = state.pendingBulk?.region === region;
      return `<li data-key="bulk-${region}"><span><strong>${region}</strong><small>${count} obtainable Normal entries</small></span>${
        pending
          ? `<span class="confirm-inline"><button class="primary" data-bulk-confirm>${state.pendingBulk.collected ? `Mark all ${count}` : 'Clear Normal'}</button><button class="quiet" data-bulk-cancel>Cancel</button></span>`
          : `<span><button class="secondary" data-bulk="${region}" data-bulk-collected="true">Mark complete</button><button class="quiet" data-bulk="${region}" data-bulk-collected="false">Clear</button></span>`
      }</li>`;
    })
    .join(
      '',
    )}</ul></section><section><h2>Catalog and storage</h2><p>All regions and supported forms. Costumes are pending. Catalog base reviewed ${catalogDate}${ledgerDate ? `, release updates through ${ledgerDate}` : ''}; availability changes require dated sources. Unreleased and ineligible categories cannot be selected.</p><p>Data is stored on this browser, using the existing CatchGrid profile and recovery snapshots. No Pokémon GO account connection.</p></section></div>`;
}
function render() {
  entriesCache = null;
  main.dataset.route = state.route;
  document.querySelectorAll('nav a').forEach((a) => {
    if (a.hash === '#' + state.route) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  updateMarkup(
    main,
    `<h1 class="sr-only">${{ home: 'Home', dex: 'Pokédex', progress: 'Progress', search: 'Search Lab', settings: 'Settings', compare: 'Compare collections', about: 'Sources and credits' }[state.route]}</h1>` +
      (storageError
        ? `<p role="alert">${escape(storageError)} Collection editing is unavailable.</p>`
        : '') +
      { home, dex: dexView, progress, search, settings, compare: compareView, about }[
        state.route
      ](),
  );
  if (dialog.open) updateMarkup(document.querySelector('#dialog-content'), specimen());
}
function compose() {
  state.mode = 'none';
  state.preset = 'missing';
  navigate('search');
}
function applyTheme(dark) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  setPref('appearance', dark ? 'dark' : 'light');
  document
    .querySelector('.theme-toggle')
    .setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} appearance`);
}
function select(n) {
  const source = document.querySelector(`[data-quick="${n}"] img, [data-pokemon="${n}"] img`);
  const origin = source?.getBoundingClientRect();
  state.selected = n;
  if (state.route === 'dex') {
    // The Pokédex shows details in its scanner, opening the right device if needed.
    const p = catalog.find((q) => q.id === n);
    if (state.region !== 'All regions' && p.region !== state.region) state.region = p.region;
    if (!scoped().some((q) => q.id === n)) state.form = p.isDefault ? 'species' : 'all';
    if (!matching().some((q) => q.id === n)) {
      state.query = '';
      state.filter = 'all';
    }
    const entering = !state.dexOpen || state.dexView !== 'hud';
    state.dexOpen = true;
    state.dexView = 'hud';
    history.replaceState(null, '', `#dex?r=${deviceFor(state.region).slug}`);
    render();
    if (entering) main.querySelector('.device')?.scrollIntoView({ block: 'start' });
    main.querySelector('.dial-item.current')?.focus({ preventScroll: true });
    revealArtwork(origin, main.querySelector('.hud-stage img'));
    return;
  }
  // Everywhere else, details open over the page so the grid or dashboard stays put.
  updateMarkup(document.querySelector('#dialog-content'), specimen());
  if (!dialog.open) dialog.showModal();
  revealArtwork(origin, dialog.querySelector('.specimen-stage img'));
}
function download(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function copy(value, success = 'Copied. Paste it where you need it.') {
  try {
    await navigator.clipboard.writeText(value);
    announce(success);
  } catch {
    // The value may not be on screen (compare links, share text), so show it to select.
    announce(
      'Copy unavailable on this device. Text selected below; use your device’s Copy command.',
    );
    const field = document.querySelector('.toast-copy');
    field.value = value;
    field.hidden = false;
    field.focus();
    field.select();
  }
}
function applyBatch(changes, verb) {
  const real = changes.filter((c) => owned.has(`${c.formId}:${c.categoryId}`) !== c.collected);
  if (!real.length) return;
  const result = setMany(real, `Before ${verb}`);
  owned = result.owned;
  lastBatch = real.map((c) => ({ ...c, collected: !c.collected }));
  render();
  announce(
    `${result.changed} ${categoryLabels[real[0].categoryId]} ${result.changed === 1 ? 'entry' : 'entries'} ${real[0].collected ? 'collected' : 'cleared'}.`,
    { undo: true },
  );
}
function posterCells() {
  return scoped().map((p) => {
    const eligibleCats = categories.filter(([c]) => p.rules[c] === 'released');
    return {
      n: p.n,
      state:
        p.rules[state.category] !== 'released'
          ? 'unavailable'
          : complete(p)
            ? 'complete'
            : isOwned(p)
              ? 'owned'
              : 'missing',
      progress: eligibleCats.length
        ? eligibleCats.filter(([c]) => isOwned(p, c)).length / eligibleCats.length
        : 0,
    };
  });
}

document.addEventListener('click', async (event) => {
  const b = event.target.closest('button,a');
  if (!b) return;
  // Rendering can morph this element into a different control; decide from the clicked state.
  const probe = b.cloneNode(false);
  if (probe.matches('.menu-toggle')) {
    const open = document.querySelector('nav').classList.toggle('open');
    b.setAttribute('aria-expanded', String(open));
  }
  if (b.matches('nav a')) {
    document.querySelector('nav').classList.remove('open');
    document.querySelector('.menu-toggle').setAttribute('aria-expanded', 'false');
  }
  if (probe.matches('.theme-toggle,[data-theme]'))
    applyTheme(document.documentElement.dataset.theme !== 'dark');
  if (probe.matches('.jump-toggle')) openJump();
  if (probe.matches('[data-jump]')) {
    jumpDialog.close();
    jumpTo(probe.dataset.jump);
    return;
  }
  if (probe.matches('.gcell')) {
    // Pointer marking happens on pointerup; this handles Space and Enter.
    if (event.detail === 0) toggleCell(probe.dataset.cell, probe.dataset.cat);
    return;
  }
  if (probe.matches('[data-focus-cat]')) {
    state.category = probe.dataset.focusCat;
    if (probe.dataset.focusRegion) {
      state.region = probe.dataset.focusRegion;
      state.form = 'species';
      state.filter = 'missing';
    }
    state.gridPage = 0;
    // Links carry on to Progress; the grid's column headers update in place.
    if (!probe.matches('a')) {
      render();
      main.querySelector(`[data-focus-cat="${state.category}"]`)?.focus();
    }
  }
  if (probe.matches('[data-pokemon]')) {
    if (probe.matches('[data-open-dex]') && innerWidth > 800) {
      state.selected = probe.dataset.pokemon;
      state.openAfterRoute = true;
      navigate('dex');
      return;
    }
    select(probe.dataset.pokemon);
  }
  if (probe.matches('[data-prev],[data-next]')) {
    const sequence = ['dex', 'progress'].includes(state.route) ? matching() : scoped();
    if (!sequence.length) return;
    const i = sequence.findIndex((p) => p.id === state.selected);
    state.selected =
      sequence[
        i < 0
          ? probe.matches('[data-next]')
            ? 0
            : sequence.length - 1
          : (i + (probe.matches('[data-next]') ? 1 : sequence.length - 1)) % sequence.length
      ].id;
    render();
    (dialog.open ? dialog : main)
      .querySelector(probe.matches('[data-next]') ? '[data-next]' : '[data-prev]')
      ?.focus({ preventScroll: true });
  }
  if (probe.matches('[data-quick],[data-category-toggle]')) {
    const p = catalog.find(
      (q) => q.id === (probe.dataset.quick || probe.dataset.formToggle || state.selected),
    );
    const category = probe.dataset.categoryToggle || state.category;
    if (p.rules[category] !== 'released') return;
    const had = owned.has(`${p.id}:${category}`);
    const focus = probe.dataset.quick
      ? `[data-quick="${p.id}"]`
      : probe.dataset.formToggle
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
      `${p.name} ${categoryLabels[category]} ${had ? 'removed' : 'collected'}.${complete(p) ? ' All eligible categories complete!' : ''}`,
      { silent: true },
    );
  }
  if (probe.matches('[data-undo]') && lastBatch) {
    const batch = lastBatch;
    lastBatch = null;
    const result = setMany(batch, 'Before undoing a bulk change');
    owned = result.owned;
    render();
    announce('Change undone.');
  }
  if (probe.matches('[data-filter]')) {
    state.filter = probe.dataset.filter;
    state.dexPage = 0;
    state.gridPage = 0;
    render();
    document.querySelector(`[data-filter="${state.filter}"]`).focus();
  }
  if (probe.matches('[data-show-missing]')) {
    state.filter = 'missing';
    state.dexView = 'grid';
    state.dexPage = 0;
  }
  if (probe.matches('.device-card')) {
    // The clicked device's lens morphs into the open device's header.
    main.querySelectorAll('.device-lens').forEach((lens) => (lens.style.viewTransitionName = ''));
    b.querySelector('.device-lens').style.viewTransitionName = 'dex-lens';
    state.dexView = 'hud';
    state.dexPage = 0;
  }
  if (probe.matches('[data-dex-view]')) {
    state.dexView = probe.dataset.dexView;
    if (state.dexView === 'grid') {
      const i = matching().findIndex((p) => p.id === state.selected);
      state.dexPage = pagesOf(matching()).length > 1 ? Math.max(0, Math.floor(i / 100)) : 0;
    }
    render();
    main.querySelector(`[data-dex-view="${state.dexView}"]`)?.focus();
  }
  if (probe.matches('[data-dex-page]')) {
    state.dexPage = Number(probe.dataset.dexPage);
    render();
    main.querySelector('.dex-grid-view')?.scrollIntoView({ block: 'start' });
    main.querySelector(`[data-dex-page="${state.dexPage}"]`)?.focus({ preventScroll: true });
  }
  if (probe.matches('[data-clear]')) {
    state.query = '';
    state.filter = 'all';
    render();
    document.querySelector('#dex-search')?.focus();
  }
  if (probe.matches('[data-compose]')) compose();
  if (probe.matches('[data-preset-link]')) state.preset = probe.dataset.presetLink;
  if (probe.matches('[data-term]')) {
    const v = probe.dataset.term;
    if (state.terms.has(v)) state.terms.delete(v);
    else state.terms.add(v);
    render();
    [...document.querySelectorAll('[data-term]')].find((x) => x.dataset.term === v)?.focus();
  }
  if (probe.matches('[data-mode]')) {
    state.mode = probe.dataset.mode;
    render();
    document.querySelector(`[data-mode="${state.mode}"]`).focus();
  }
  if (probe.matches('[data-remove-term]')) {
    state.custom = state.custom.filter((x) => x !== probe.dataset.removeTerm);
    render();
    document.querySelector('#custom-term').focus();
  }
  if (probe.matches('[data-preset]')) {
    state.preset = probe.dataset.preset;
    render();
    document.querySelector(`[data-preset="${state.preset}"]`)?.focus();
  }
  if (probe.matches('[data-discord-category]')) {
    const id = probe.dataset.discordCategory;
    if (state.discordCategories.has(id)) state.discordCategories.delete(id);
    else state.discordCategories.add(id);
    render();
    main.querySelector(`[data-discord-category="${id}"]`)?.focus();
  }
  if (probe.matches('[data-copy]')) {
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
  if (probe.matches('[data-copy-value]'))
    await copy(probe.dataset.copyValue, 'Copied exactly as shown.');
  if (probe.matches('[data-share-text]')) {
    try {
      await navigator.share({ title: 'My missing CatchGrid lists', text: probe.dataset.shareText });
    } catch (error) {
      if (error?.name !== 'AbortError') await copy(probe.dataset.shareText);
    }
  }
  if (probe.matches('[data-ics]')) {
    const w = legacyWindows().find((x) => x.id === probe.dataset.ics);
    if (w) download(icsFor(w), `CatchGrid-${w.id}.ics`, 'text/calendar;charset=utf-8');
  }
  if (probe.matches('[data-poster]')) {
    const total = eligible().length;
    const count = eligible().filter((p) => isOwned(p)).length;
    const c = drawCollectionPoster({
      title: `${state.region} · ${label()}`,
      subtitle: `${state.form === 'species' ? 'National Dex species' : 'Supported forms'} · ${new Date().toLocaleDateString()}`,
      cells: posterCells(),
      count,
      total,
      trainer: trainer(),
      accent: accentColor(),
      label: label(),
      medals:
        state.form === 'species' && state.region === 'All regions'
          ? medalShelf(catalog, owned, state.category)
          : null,
    });
    try {
      const outcome = await shareCanvas(
        c,
        `CatchGrid-${state.region.replace(/\s+/g, '')}-${state.category}.png`,
        'My CatchGrid collection',
      );
      if (outcome === 'downloaded') announce('Poster saved as a PNG.');
    } catch (error) {
      announce(error.message);
    }
  }
  if (probe.matches('[data-recap-card]')) {
    const since = new Date(Date.now() - state.recapDays * 86_400_000);
    const r = recap(entries(), catalog, since);
    const c = drawRecapCard({
      period: state.recapDays === 7 ? 'My week in Pokémon GO' : 'My month in Pokémon GO',
      ...r,
      labels: categoryLabels,
      trainer: trainer(),
      accent: accentColor(),
    });
    try {
      const outcome = await shareCanvas(
        c,
        `CatchGrid-recap-${new Date().toISOString().slice(0, 10)}.png`,
        'My CatchGrid recap',
      );
      if (outcome === 'downloaded') announce('Recap card saved as a PNG.');
    } catch (error) {
      announce(error.message);
    }
  }
  if (probe.matches('[data-share-link]')) {
    const category = probe.dataset.shareCategory || state.category;
    await copy(
      shareLink(location.origin, catalog, owned, category, trainer()),
      `Compare link copied for ${categoryLabels[category]}. Send it to a friend.`,
    );
  }
  if (probe.matches('[data-accent]')) {
    const accent = probe.dataset.accent;
    setPref('accent', accent);
    if (accent === 'slate') delete document.documentElement.dataset.accent;
    else document.documentElement.dataset.accent = accent;
    render();
    main.querySelector(`[data-accent="${accent}"]`)?.focus();
  }
  if (probe.matches('[data-bulk]')) {
    state.pendingBulk = {
      region: probe.dataset.bulk,
      collected: probe.dataset.bulkCollected === 'true',
    };
    render();
    main.querySelector('[data-bulk-confirm]')?.focus();
  }
  if (probe.matches('[data-bulk-cancel]')) {
    const region = state.pendingBulk?.region;
    state.pendingBulk = null;
    render();
    main.querySelector(`[data-bulk="${region}"]`)?.focus();
  }
  if (probe.matches('[data-bulk-confirm]') && state.pendingBulk) {
    const { region, collected } = state.pendingBulk;
    state.pendingBulk = null;
    try {
      applyBatch(
        species
          .filter((p) => p.region === region && p.rules.normal === 'released')
          .map((p) => ({ formId: p.id, categoryId: 'normal', collected })),
        `updating ${region}`,
      );
      render();
    } catch (error) {
      announce(error.message);
    }
  }
  if (probe.matches('[data-review-snapshot]')) {
    state.reviewSnapshot = probe.dataset.reviewSnapshot;
    render();
    main.querySelector('[data-restore-snapshot]')?.focus();
  }
  if (probe.matches('[data-cancel-snapshot]')) {
    state.reviewSnapshot = null;
    render();
  }
  if (probe.matches('[data-restore-snapshot]')) {
    try {
      owned = restoreSnapshot(probe.dataset.restoreSnapshot);
      storageError = '';
      state.reviewSnapshot = null;
      render();
      announce('Snapshot restored. Your previous collection was saved as a new snapshot.');
    } catch (error) {
      announce(error.message);
    }
  }
  if (probe.matches('.dialog-close')) b.closest('dialog').close();
});

// Progress grid: a click marks one cell; a drag or Shift-click fills a range in one save.
let fill = null;
let gridAnchor = null;
function focusCell(id, cat) {
  main
    .querySelector(`.gcell[data-cell="${id}"][data-cat="${cat}"]`)
    ?.focus({ preventScroll: true });
}
function toggleCell(id, cat) {
  const p = catalog.find((q) => q.id === id);
  const had = isOwned(p, cat);
  try {
    owned = toggleCollection(id, cat);
  } catch (error) {
    announce(error.message);
    return;
  }
  gridAnchor = { id, cat, value: !had };
  state.gridCursor = { id, cat };
  render();
  focusCell(id, cat);
  announce(`${p.name} ${categoryLabels[cat]} ${had ? 'removed' : 'collected'}.`, { silent: true });
}
function fillCells(cells, value, focus) {
  try {
    applyBatch(
      cells.map(({ id, cat }) => ({ formId: id, categoryId: cat, collected: value })),
      'filling the grid',
    );
  } catch (error) {
    announce(error.message);
  }
  state.gridCursor = focus;
  focusCell(focus.id, focus.cat);
}
document.addEventListener('pointerdown', (event) => {
  const cell = event.target.closest('button.gcell');
  if (!cell || event.button > 0) return;
  const { cell: id, cat } = cell.dataset;
  if (event.pointerType === 'mouse') event.preventDefault();
  if (event.shiftKey && gridAnchor?.cat === cat) {
    const rows = [...main.querySelectorAll(`.gcell[data-cat="${cat}"]`)];
    const a = rows.findIndex((c) => c.dataset.cell === gridAnchor.id);
    const b = rows.indexOf(cell);
    if (a >= 0) {
      const range = rows.slice(Math.min(a, b), Math.max(a, b) + 1);
      fillCells(
        range.map((c) => ({ id: c.dataset.cell, cat })),
        gridAnchor.value,
        { id, cat },
      );
      return;
    }
  }
  const value = cell.getAttribute('aria-pressed') !== 'true';
  fill = { value, cells: new Map([[`${id}:${cat}`, { id, cat }]]), last: { id, cat } };
  cell.classList.add('filling', value ? 'to-on' : 'to-off');
});
document.addEventListener('pointermove', (event) => {
  if (!fill) return;
  const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest('button.gcell');
  if (!cell) return;
  const { cell: id, cat } = cell.dataset;
  if (fill.cells.has(`${id}:${cat}`)) return;
  fill.cells.set(`${id}:${cat}`, { id, cat });
  fill.last = { id, cat };
  cell.classList.add('filling', fill.value ? 'to-on' : 'to-off');
});
document.addEventListener('pointerup', () => {
  if (!fill) return;
  const { cells, value, last } = fill;
  fill = null;
  if (cells.size === 1) toggleCell(last.id, last.cat);
  else {
    gridAnchor = { ...last, value };
    fillCells([...cells.values()], value, last);
  }
});
// Scrolling on a touch screen cancels the gesture: nothing is marked.
document.addEventListener('pointercancel', () => {
  if (!fill) return;
  fill = null;
  main
    .querySelectorAll('.gcell.filling')
    .forEach((c) => c.classList.remove('filling', 'to-on', 'to-off'));
});

// Keep one grid cell in the tab order: whichever was focused last.
document.addEventListener('focusin', (event) => {
  const cell = event.target.closest?.('button.gcell');
  if (!cell) return;
  main.querySelectorAll('button.gcell[tabindex="0"]').forEach((c) => (c.tabIndex = -1));
  cell.tabIndex = 0;
  state.gridCursor = { id: cell.dataset.cell, cat: cell.dataset.cat };
});

// Pokédex scanner: wheel over the dial and swipe across the artwork move through Pokémon.
let wheelDistance = 0;
document.addEventListener(
  'wheel',
  (event) => {
    if (!event.target.closest('.dial-strip')) return;
    event.preventDefault();
    wheelDistance += Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (Math.abs(wheelDistance) < 40) return;
    const step = wheelDistance > 0 ? '[data-next]' : '[data-prev]';
    wheelDistance = 0;
    main.querySelector(step)?.click();
  },
  { passive: false },
);
let swipe = null;
document.addEventListener('pointerdown', (event) => {
  swipe = event.target.closest('.hud-stage') ? { x: event.clientX, y: event.clientY } : null;
});
document.addEventListener('pointerup', (event) => {
  if (!swipe) return;
  const dx = event.clientX - swipe.x;
  const dy = event.clientY - swipe.y;
  swipe = null;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5)
    main.querySelector(dx < 0 ? '[data-next]' : '[data-prev]')?.click();
});

// Quick jump: press / anywhere (outside text fields) to open a Pokémon.
function jumpResults(text) {
  const q = text.trim().toLowerCase().replace(/^#/, '');
  if (!q) return [];
  const n = Number(q);
  return catalog
    .filter((p) => (Number.isInteger(n) && n > 0 ? p.n === n : p.name.toLowerCase().includes(q)))
    .sort(
      (a, b) =>
        Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)) ||
        Number(!a.isDefault) - Number(!b.isDefault) ||
        a.n - b.n,
    )
    .slice(0, 8);
}
function renderJump() {
  const results = jumpResults(document.querySelector('#jump-input').value);
  updateMarkup(
    document.querySelector('#jump-results'),
    results
      .map(
        (p) =>
          `<li data-key="j-${p.id}"><button data-jump="${p.id}"><img src="${escape(p.art)}" alt="" width="40" height="40" loading="lazy"><span>${escape(p.name)}</span><small>${dex(p.n)} · ${p.region}</small></button></li>`,
      )
      .join('') ||
      (document.querySelector('#jump-input').value
        ? '<li class="annotation">No Pokémon found.</li>'
        : ''),
  );
}
function openJump() {
  const input = document.querySelector('#jump-input');
  input.value = '';
  renderJump();
  jumpDialog.showModal();
  input.focus();
}
function jumpTo(id) {
  state.selected = id;
  if (['dex', 'progress'].includes(state.route)) select(id);
  else {
    state.openAfterRoute = true;
    navigate('dex');
  }
}
document.querySelector('#jump-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const first = jumpResults(document.querySelector('#jump-input').value)[0];
  if (!first) return;
  jumpDialog.close();
  jumpTo(first.id);
});

document.addEventListener('input', (event) => {
  if (event.target.id === 'custom-term') state.draft = event.target.value;
  if (event.target.id === 'jump-input') renderJump();
  if (event.target.id === 'trainer-name') setPref('trainer', event.target.value.slice(0, 24));
  if (event.target.id === 'dex-search' || event.target.id === 'grid-search') {
    state.query = event.target.value;
    state.dexPage = 0;
    state.gridPage = 0;
    render();
  }
  if (event.target.id === 'dex-dial') {
    const p = matching()[Number(event.target.value) - 1];
    if (p && p.id !== state.selected) {
      state.selected = p.id;
      render();
    }
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
  const previous = state.route;
  state.route = routeFromHash();
  if (state.route === 'search' && location.hash.includes('section='))
    state.preset = presetFromHash();
  if (state.route === 'dex') dexFromHash();
  document.querySelector('.toast').hidden = true;
  if (dialog.open) dialog.close();
  state.pendingBulk = null;
  state.reviewSnapshot = null;
  const update = () => {
    render();
    const device = state.route === 'dex' && main.querySelector('.device');
    if (device) device.scrollIntoView({ block: 'start', behavior: 'instant' });
    else scrollTo({ top: 0, behavior: 'instant' });
    main.focus({ preventScroll: true });
  };
  // Opening or closing a Pokédex device morphs between the shelf and the device.
  if (
    previous === 'dex' &&
    state.route === 'dex' &&
    document.startViewTransition &&
    document.visibilityState === 'visible' &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches
  )
    // The browser can still skip the animation; the update runs either way.
    document.startViewTransition(update).ready.catch(() => {});
  else update();
  if (state.openAfterRoute) {
    state.openAfterRoute = false;
    select(state.selected);
  }
});
document.addEventListener('keydown', (e) => {
  const typing = e.target.closest('input,textarea,select,[contenteditable]');
  if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !jumpDialog.open) {
    e.preventDefault();
    openJump();
    return;
  }
  if (
    !typing &&
    e.target.closest('.hud') &&
    ['ArrowLeft', 'ArrowRight'].includes(e.key) &&
    !e.altKey &&
    !e.metaKey &&
    !e.ctrlKey
  ) {
    e.preventDefault();
    main.querySelector(e.key === 'ArrowRight' ? '[data-next]' : '[data-prev]')?.click();
    return;
  }
  // Progress grid: arrows move between markable cells, skipping ones that aren't eligible.
  const cell = e.target.closest('button.gcell');
  if (cell && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
    e.preventDefault();
    const rows = [...main.querySelectorAll('.collection-grid tbody tr')];
    let r = rows.indexOf(cell.closest('tr'));
    let c = [...cell.closest('tr').children].indexOf(cell.closest('td'));
    const at = (row, col) => rows[row]?.children[col]?.querySelector('button.gcell');
    if (e.key === 'Home' || e.key === 'End') {
      const cells = [...rows[r].querySelectorAll('button.gcell')];
      (e.key === 'Home' ? cells[0] : cells.at(-1))?.focus();
      return;
    }
    const [dr, dc] = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    }[e.key];
    let next = null;
    while (!next) {
      r += dr;
      c += dc;
      if (r < 0 || r >= rows.length || c < 1 || c >= rows[0].children.length) break;
      next = at(r, c);
    }
    next?.focus();
  }
  if (e.key === 'Escape') {
    document.querySelector('nav').classList.remove('open');
    document.querySelector('.menu-toggle').setAttribute('aria-expanded', 'false');
  }
});
dialog.addEventListener('close', () => {
  const next =
    main.querySelector(`[data-pokemon="${state.selected}"]`) || main.querySelector('#dex-search');
  next?.focus({ preventScroll: true });
});

document.addEventListener('change', async (event) => {
  const t = event.target;
  if (t.matches('[data-category-select]')) {
    state.category = t.value;
    render();
  }
  if (t.matches('[data-region],[data-form]')) {
    if (t.matches('[data-region]')) state.region = t.value;
    else {
      state.form = t.value;
      if (formOnly() && !['normal', 'shiny'].includes(state.category)) state.category = 'normal';
      state.evolve = false;
    }
    if (!scoped().some((p) => p.id === state.selected) && scoped().length)
      state.selected = scoped()[0].id;
    state.dexPage = 0;
    if (state.route === 'dex' && state.dexOpen)
      history.replaceState(null, '', `#dex?r=${deviceFor(state.region).slug}`);
    render();
  }
  if (t.matches('[data-grid-page-select]')) {
    state.gridPage = Number(t.value);
    render();
    main.querySelector('.grid-scroll')?.scrollTo({ top: 0 });
  }
  if (t.matches('[data-evolution]')) {
    state.evolve = t.checked;
    render();
  }
  if (t.matches('[data-nitro]')) {
    state.nitro = t.checked;
    render();
  }
  if (t.matches('[data-evolve-sizes]')) {
    state.evolveSizes = t.checked;
    render();
  }
  if (t.matches('[data-silhouettes]')) {
    setPref('silhouettes', t.checked ? 'on' : 'off');
    render();
  }
  if (t.id === 'import-file') {
    pendingImport = null;
    const file = t.files[0];
    if (!file) return;
    try {
      if (file.size > 5000000) throw new Error('Choose a file smaller than 5 MB.');
      const name = file.name.toLowerCase();
      if (name.endsWith('.xlsx'))
        pendingImport = reviewSheetImport(await readWorkbook(await file.arrayBuffer()));
      else if (name.endsWith('.json')) pendingImport = reviewImport(await file.text(), 'json');
      else {
        // CatchGrid's own CSV has form IDs; anything else is read as spreadsheet rows.
        const text = await file.text();
        pendingImport = /(^|,)"?(form_id|dex_number)"?(,|$)/m.test(text.split('\n')[0])
          ? reviewImport(text, 'csv')
          : reviewSheetImport(readText(text));
      }
      render();
    } catch (error) {
      document.querySelector('#import-review').textContent = error.message;
    }
  }
});

document.addEventListener('click', (event) => {
  const b = event.target.closest('button');
  if (!b) return;
  try {
    if (b.matches('[data-export="xlsx"]'))
      download(
        collectionWorkbook(catalog, owned, sheetSearch, categoryLabels),
        `CatchGrid-Pokedex-${new Date().toISOString().slice(0, 10)}.xlsx`,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
    else if (b.matches('[data-export]'))
      download(
        b.dataset.export === 'csv' ? exportCsv() : exportBackup(),
        `CatchGrid-${new Date().toISOString().slice(0, 10)}.${b.dataset.export}`,
        b.dataset.export === 'csv' ? 'text/csv;charset=utf-8' : 'application/json',
      );
    if (b.matches('[data-paste-review]')) {
      const text = document.querySelector('#paste-rows').value;
      pendingImport = null;
      try {
        pendingImport = reviewSheetImport(readText(text));
        render();
      } catch (error) {
        document.querySelector('#import-review').textContent = error.message;
      }
    }
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
window.addEventListener('storage', () => {
  try {
    owned = collectionKeys();
    storageError = '';
  } catch (error) {
    storageError = error.message;
  }
  render();
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

render();
