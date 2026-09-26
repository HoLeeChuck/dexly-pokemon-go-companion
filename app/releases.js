// Release ledger: dated, sourced corrections applied on top of the generated catalog.
// Recording a Pokémon GO release is one entry in catalog/releases.v1.json — no catalog
// regeneration or migration. Pure functions, no DOM access.

export const LEDGER_CATEGORIES = [
  'normal',
  'shiny',
  'lucky',
  'hundo',
  'xxl',
  'xxs',
  'shadow',
  'purified',
];
export const LEDGER_STATUSES = ['released', 'unreleased', 'ineligible'];
/** Kinds of form the ledger can add. New forms track Normal and Shiny, like other forms. */
export const LEDGER_FORM_KINDS = ['mega', 'primal', 'gigantamax', 'regional', 'alternate'];
const FORM_CATEGORIES = ['normal', 'shiny'];
const TYPES = new Set([
  'normal',
  'fire',
  'water',
  'grass',
  'electric',
  'ice',
  'fighting',
  'poison',
  'ground',
  'flying',
  'psychic',
  'bug',
  'rock',
  'ghost',
  'dragon',
  'dark',
  'steel',
  'fairy',
]);
/** Announcements must come from Niantic or The Pokémon Company. */
export const OFFICIAL_HOSTS = [
  'pokemongo.com',
  'niantic.helpshift.com',
  'nianticlabs.com',
  'pokemon.com',
  'pokemongolive.com',
];

const isOfficial = (url) => {
  try {
    const { protocol, hostname } = new URL(url);
    return (
      protocol === 'https:' &&
      OFFICIAL_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`))
    );
  } catch {
    return false;
  }
};
const targets = (entry, forms) =>
  entry.formId
    ? forms.filter((p) => p.formId === entry.formId)
    : forms.filter((p) => p.isDefault && p.dex === entry.dex);

function checkDateAndSource(entry, at, todayKey, errors) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry?.date ?? '') || Number.isNaN(Date.parse(entry.date)))
    errors.push(`${at}: date must be YYYY-MM-DD.`);
  else if (entry.date > todayKey) errors.push(`${at}: date ${entry.date} is in the future.`);
  if (!isOfficial(entry?.source))
    errors.push(`${at}: source must be an https link on ${OFFICIAL_HOSTS.join(', ')}.`);
}

/** Problems with the ledger, as readable messages. An empty list means it is valid. */
export function validateLedger(ledger, forms, today = new Date()) {
  const errors = [];
  if (ledger?.schemaVersion !== 1) errors.push('schemaVersion must be 1.');
  if (!Array.isArray(ledger?.entries)) return [...errors, 'entries must be a list.'];
  if (ledger.forms !== undefined && !Array.isArray(ledger.forms))
    return [...errors, 'forms must be a list.'];
  const todayKey = today.toISOString().slice(0, 10);
  const existing = new Set(forms.map((p) => p.formId));
  (ledger.forms ?? []).forEach((form, i) => {
    const at = `forms[${i}]${form?.formName ? ` (${form.formName})` : ''}`;
    checkDateAndSource(form, at, todayKey, errors);
    if (!/^form-\d{4}-[a-z0-9-]+$/.test(form?.formId ?? ''))
      errors.push(`${at}: formId must look like form-0658-mega.`);
    else if (existing.has(form.formId)) errors.push(`${at}: ${form.formId} already exists.`);
    else existing.add(form.formId);
    const base = forms.find((p) => p.isDefault && p.dex === form?.dex);
    if (!base) errors.push(`${at}: no default species for dex ${form?.dex}.`);
    else if (!form.formId?.startsWith(`form-${String(form.dex).padStart(4, '0')}-`))
      errors.push(`${at}: formId must start with form-${String(form.dex).padStart(4, '0')}-.`);
    if (!form?.formName?.trim()) errors.push(`${at}: give a formName.`);
    if (!LEDGER_FORM_KINDS.includes(form?.variantKind))
      errors.push(`${at}: variantKind must be ${LEDGER_FORM_KINDS.join(', ')}.`);
    if (!Array.isArray(form?.types) || !form.types.length || form.types.some((t) => !TYPES.has(t)))
      errors.push(`${at}: types must be one or two Pokémon types.`);
    if (!Array.isArray(form?.categories) || !form.categories.length)
      errors.push(`${at}: list at least one category.`);
    for (const c of form?.categories ?? [])
      if (!FORM_CATEGORIES.includes(c)) errors.push(`${at}: forms track Normal and Shiny only.`);
    if (form?.artwork !== undefined && !/^[\w .-]+\.png$/.test(form.artwork?.normal ?? ''))
      errors.push(`${at}: artwork.normal must be a .png file name.`);
  });
  const seen = new Set();
  ledger.entries.forEach((entry, i) => {
    const at = `entries[${i}]${entry?.dex ? ` (#${entry.dex})` : ''}`;
    checkDateAndSource(entry, at, todayKey, errors);
    if (!entry?.formId && !Number.isInteger(entry?.dex))
      errors.push(`${at}: give a dex number or a formId.`);
    else if (!targets(entry, forms).length && !existing.has(entry.formId))
      errors.push(`${at}: no catalog form matches.`);
    if (!Array.isArray(entry?.categories) || !entry.categories.length)
      errors.push(`${at}: list at least one category.`);
    for (const c of entry?.categories ?? [])
      if (!LEDGER_CATEGORIES.includes(c)) errors.push(`${at}: unknown category "${c}".`);
    if (entry?.status !== undefined && !LEDGER_STATUSES.includes(entry.status))
      errors.push(`${at}: status must be ${LEDGER_STATUSES.join(', ')}.`);
    for (const c of entry?.categories ?? []) {
      const key = `${entry.formId ?? entry.dex}:${c}:${entry.date}`;
      if (seen.has(key)) errors.push(`${at}: duplicates another entry for ${c} on ${entry.date}.`);
      seen.add(key);
    }
  });
  return errors;
}

/**
 * Forms with ledger entries applied, oldest entry first so the newest decision wins.
 * Returns new objects; the input is not changed.
 */
export function applyLedger(forms, ledger) {
  const added = (ledger?.forms ?? []).map((form) => newForm(forms, form));
  if (added.length)
    forms = [...forms, ...added].sort(
      (a, b) =>
        a.dex - b.dex || a.formSortOrder - b.formSortOrder || a.formId.localeCompare(b.formId),
    );
  const entries = [...(ledger?.entries ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  if (!entries.length) return forms;
  const rules = new Map();
  for (const entry of entries)
    for (const p of targets(entry, forms)) {
      const next = rules.get(p.formId) ?? { ...p.rules };
      for (const c of entry.categories) next[c] = entry.status ?? 'released';
      rules.set(p.formId, next);
    }
  return forms.map((p) => (rules.has(p.formId) ? withRules(p, rules.get(p.formId)) : p));
}
function withRules(p, rules) {
  return {
    ...p,
    rules,
    isReleased: rules.normal === 'released',
    eligibility: Object.fromEntries(Object.entries(rules).map(([k, v]) => [k, v === 'released'])),
  };
}
/** A new form built from its default species: Normal and Shiny as listed, nothing else. */
function newForm(forms, form) {
  const base = forms.find((p) => p.isDefault && p.dex === form.dex);
  const rules = Object.fromEntries(
    Object.keys(base.rules).map((k) => [
      k,
      FORM_CATEGORIES.includes(k)
        ? form.categories.includes(k)
          ? 'released'
          : 'unreleased'
        : 'ineligible',
    ]),
  );
  return withRules(
    {
      ...structuredClone(base),
      formId: form.formId,
      formKey: form.formId.replace(/^form-\d{4}-/, ''),
      formName: form.formName,
      isDefault: false,
      variantKind: form.variantKind,
      types: [...form.types],
      formSortOrder: 700,
      searchExact: false,
      artworkIsFallback: !form.artwork,
      release: {
        normal: form.categories.includes('normal'),
        shiny: form.categories.includes('shiny'),
        shadow: false,
        purified: false,
      },
      sourceIds: [form.source],
      ...(form.artwork ? { assets: artworkAssets(base, form.artwork) } : {}),
    },
    rules,
  );
}
/** Point a new form at its own artwork files (normal and optional shiny). */
function artworkAssets(base, artwork) {
  const dir = base.assets.normal.upstreamPath.replace(/[^/]+$/, '');
  return {
    ...base.assets,
    normal: { ...base.assets.normal, upstreamPath: dir + artwork.normal },
    ...(artwork.shiny
      ? { shiny: { ...base.assets.shiny, upstreamPath: dir + artwork.shiny } }
      : {}),
  };
}

/** The ledger's official links, in the catalog's source format, for Sources & credits. */
export function ledgerSources(ledger) {
  return [...(ledger?.forms ?? []), ...(ledger?.entries ?? [])].map((entry, i) => ({
    key: `release-ledger-${i}`,
    kind: 'official',
    url: entry.source,
  }));
}

/** The newest entry or form date, or null when the ledger is empty. */
export const ledgerUpdatedAt = (ledger) =>
  [...(ledger?.forms ?? []), ...(ledger?.entries ?? [])].reduce(
    (latest, e) => (e.date > (latest ?? '') ? e.date : latest),
    null,
  );
