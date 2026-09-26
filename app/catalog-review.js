/** Dated, source-backed corrections for the full-collection preview.
 * Does not rewrite immutable catalog migration 0011.
 */
export const reviewDate = '2026-09-24';
export const sources = {
  megaSquads: 'https://pokemongo.com/en/news/mega-squads-2026',
  cinderace: 'https://pokemongo.com/news/gigantamax-cinderace-max-battle-day-2026',
};
export function reviewedForms(input) {
  const forms = structuredClone(input);
  for (const p of forms) {
    if (p.isDefault && [942, 943].includes(p.dex)) {
      p.isReleased = true;
      p.release.normal = true;
      for (const c of ['normal', 'lucky', 'hundo', 'xxl', 'xxs']) p.rules[c] = 'released';
      p.sourceIds.push(sources.megaSquads);
    }
    if (p.isDefault && p.dex === 973) {
      p.release.shiny = true;
      p.rules.shiny = 'released';
      p.sourceIds.push(sources.megaSquads);
    }
    if (p.formId === 'form-0815-gigantamax') {
      p.release.shiny = false;
      p.rules.shiny = 'unreleased';
      p.sourceIds.push(sources.cinderace);
    }
  }
  // Mega Staraptor now lives in catalog/releases.v1.json with the other ledger-added forms.
  for (const p of forms)
    p.eligibility = Object.fromEntries(
      Object.entries(p.rules).map(([k, v]) => [k, v === 'released']),
    );
  return forms.sort(
    (a, b) =>
      a.dex - b.dex || a.formSortOrder - b.formSortOrder || a.formId.localeCompare(b.formId),
  );
}
