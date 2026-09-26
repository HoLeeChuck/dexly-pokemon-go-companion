// Read-only views over the collection: medals, near-completions, evolution hints and recaps.
// Nothing here writes collection data.
import medalPolicy from '../catalog/region-medals.v1.json';

export const TIERS = ['bronze', 'silver', 'gold', 'platinum'];

/** CatchGrid regional medals: default species only, thresholds from region-medals.v1.json. */
export function medalShelf(catalog, owned, category) {
  return medalPolicy.regions.map((region) => {
    const species = catalog.filter((p) => p.isDefault && p.region === region.label);
    const thresholds = region.categoryThresholds[category] ?? region.thresholds;
    const collected = species.filter((p) => owned.has(`${p.id}:${category}`)).length;
    const tier = [...TIERS].reverse().find((t) => collected >= thresholds[t]) ?? 'none';
    const nextTier = TIERS.find((t) => collected < thresholds[t]);
    return {
      region: region.label,
      mark: region.mark,
      collected,
      tier,
      nextTier,
      nextTarget: nextTier ? thresholds[nextTier] : null,
      platinum: thresholds.platinum,
    };
  });
}

/** Species closest to completing every eligible category, ranked by fewest remaining. */
export function nearlyComplete(catalog, owned, categories, limit = 6) {
  return catalog
    .filter((p) => p.isDefault)
    .map((p) => {
      const eligible = categories.filter(([c]) => p.rules[c] === 'released');
      const missing = eligible.filter(([c]) => !owned.has(`${p.id}:${c}`));
      return { p, eligible: eligible.length, missing };
    })
    .filter((x) => x.eligible >= 3 && x.missing.length > 0 && x.missing.length <= 2)
    .sort((a, b) => a.missing.length - b.missing.length || b.eligible - a.eligible || a.p.n - b.p.n)
    .slice(0, limit);
}

/**
 * Earlier stages you have already registered in this category that evolve into p.
 * Families list each species' own line: families[n] = [first stage, ..., n].
 */
export function evolutionHint(p, owned, category, catalog, families) {
  if (!p.isDefault || p.rules[category] !== 'released' || owned.has(`${p.id}:${category}`))
    return [];
  const line = (families[String(p.n)] || []).filter((n) => n !== p.n);
  return line
    .map((n) => catalog.find((q) => q.isDefault && q.n === n))
    .filter((q) => q && owned.has(`${q.id}:${category}`));
}

/** Entries collected since a date, grouped for a recap card. Removals are not recorded. */
export function recap(entries, catalog, since) {
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const recent = entries.filter((e) => e.updatedAt && Date.parse(e.updatedAt) >= since.getTime());
  const byCategory = {};
  for (const e of recent) byCategory[e.categoryId] = (byCategory[e.categoryId] || 0) + 1;
  const highlights = recent
    .filter((e) => e.categoryId !== 'normal')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((e) => ({ entry: e, p: byId.get(e.formId) }))
    .filter((x) => x.p)
    .slice(0, 8);
  const days = new Set(recent.map((e) => e.updatedAt.slice(0, 10)));
  return {
    total: recent.length,
    byCategory,
    highlights,
    activeDays: days.size,
    dated: entries.some((e) => e.updatedAt),
  };
}
