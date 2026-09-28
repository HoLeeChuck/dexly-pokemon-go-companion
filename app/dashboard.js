// Read-only numbers for the Home dashboard and the Progress grid. Nothing here writes data.

/** Use all owned keys (including forms), not just eligible National Dex totals. */
export function showFirstRunHome(ownedCount, activity, storageUnavailable = false) {
  return !storageUnavailable && ownedCount === 0 && !activity.some((day) => day.count > 0);
}

/** Most registrations; category order breaks ties and supplies the empty fallback. */
export function mostProgressCategory(totals) {
  return totals.reduce((best, item) => (!best || item.count > best.count ? item : best), null)?.id;
}

/** Latest distinct Pokémon marked in the same local-calendar window as the weekly KPI. */
export function recentlyMarked(entries, catalog, now = new Date(), limit = 3) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const seen = new Set();
  return entries
    .filter(
      (e) =>
        e.collected &&
        byId.has(e.formId) &&
        Date.parse(e.updatedAt) >= start.getTime() &&
        Date.parse(e.updatedAt) <= now.getTime(),
    )
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .filter((e) => {
      if (seen.has(e.formId)) return false;
      seen.add(e.formId);
      return true;
    })
    .slice(0, limit)
    .map((entry) => ({ entry, p: byId.get(entry.formId) }));
}

/** Registered and eligible counts for each category across the given Pokémon. */
export function categoryTotals(items, owned, categories) {
  return categories.map(([id, name]) => {
    const eligible = items.filter((p) => p.rules[id] === 'released');
    const count = eligible.filter((p) => owned.has(`${p.id}:${id}`)).length;
    return { id, name, eligible: eligible.length, count };
  });
}

/** One row per region with categoryTotals for that region's Pokémon. */
export function regionHeat(items, owned, categories, regions) {
  return regions
    .map((region) => ({
      region,
      cells: categoryTotals(
        items.filter((p) => p.region === region),
        owned,
        categories,
      ),
    }))
    .filter((row) => row.cells.some((c) => c.eligible > 0));
}

const localDay = (date) => date.toLocaleDateString('en-CA');

/** Registrations per local day for the last `days` days, oldest first. */
export function dailyActivity(entries, days, now = new Date()) {
  const counts = new Map();
  for (const e of entries) {
    if (!e.collected || !e.updatedAt) continue;
    const day = localDay(new Date(e.updatedAt));
    counts.set(day, (counts.get(day) || 0) + 1);
  }
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (days - 1 - i));
    const day = localDay(date);
    return { day, count: counts.get(day) || 0 };
  });
}

/** Consecutive active days ending today, or yesterday if today has no entries yet. */
export function activeStreak(activity) {
  let i = activity.length - 1;
  if (i >= 0 && activity[i].count === 0) i -= 1;
  let streak = 0;
  for (; i >= 0 && activity[i].count > 0; i -= 1) streak += 1;
  return streak;
}
