// Read-only numbers for the Home dashboard and the Progress grid. Nothing here writes data.

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
