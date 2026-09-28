import { describe, expect, it } from 'vitest';
import { catalog } from '../../app/catalog.js';
import {
  categoryTotals,
  regionHeat,
  dailyActivity,
  activeStreak,
  showFirstRunHome,
} from '../../app/dashboard.js';

const species = catalog.filter((p) => p.isDefault);
const categories = [
  ['normal', 'Normal'],
  ['shiny', 'Shiny'],
];

describe('first-run Home eligibility', () => {
  it('shows onboarding only for an empty collection with no activity', () => {
    expect(showFirstRunHome(0, [])).toBe(true);
    expect(showFirstRunHome(0, [{ count: 0 }, { count: 0 }])).toBe(true);
    expect(showFirstRunHome(0, [{ count: 1 }, { count: 0 }])).toBe(false);
  });

  it('keeps returning users on their dashboard, even with only forms or undated entries', () => {
    expect(showFirstRunHome(new Set(['form-0006-mega-x:shiny']).size, [])).toBe(false);
    expect(showFirstRunHome(1, [{ count: 0 }])).toBe(false);
    expect(showFirstRunHome(232, [{ count: 26 }])).toBe(false);
  });

  it('does not mistake unreadable storage for a new collection', () => {
    expect(showFirstRunHome(0, [], true)).toBe(false);
  });
});

describe('categoryTotals', () => {
  it('counts only eligible entries, per category', () => {
    const bulbasaur = species.find((p) => p.n === 1)!;
    const owned = new Set([`${bulbasaur.id}:normal`, `${bulbasaur.id}:shiny`]);
    const [normal, shiny] = categoryTotals(species, owned, categories);
    expect(normal).toMatchObject({ id: 'normal', count: 1 });
    expect(normal!.eligible).toBe(species.filter((p) => p.rules.normal === 'released').length);
    expect(shiny!.eligible).toBeLessThan(normal!.eligible);
  });

  it('ignores owned keys for categories a Pokémon is not eligible for', () => {
    const ineligible = species.find((p) => p.rules.shiny !== 'released')!;
    const [, shiny] = categoryTotals(species, new Set([`${ineligible.id}:shiny`]), categories);
    expect(shiny!.count).toBe(0);
  });
});

describe('regionHeat', () => {
  it('returns one row per region that has eligible Pokémon', () => {
    const rows = regionHeat(species, new Set(), categories, ['Kanto', 'Orre']);
    expect(rows.map((r) => r.region)).toEqual(['Kanto']);
    expect(rows[0]!.cells[0]).toMatchObject({ id: 'normal', eligible: 151, count: 0 });
  });
});

describe('dailyActivity and activeStreak', () => {
  const now = new Date(2026, 8, 26, 15, 0);
  const at = (daysAgo: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString();
  };
  const entry = (daysAgo: number, collected = true) => ({
    formId: 'x',
    categoryId: 'normal',
    collected,
    updatedAt: at(daysAgo),
  });

  it('buckets collected, dated entries by local day, oldest first', () => {
    const days = dailyActivity(
      [
        entry(0),
        entry(0),
        entry(2),
        entry(40),
        entry(1, false),
        { ...entry(0), updatedAt: undefined },
      ],
      7,
      now,
    );
    expect(days).toHaveLength(7);
    expect(days.at(-1)).toMatchObject({ day: '2026-09-26', count: 2 });
    expect(days.at(-3)!.count).toBe(1);
    expect(days.reduce((sum, d) => sum + d.count, 0)).toBe(3);
  });

  it('counts a streak ending today, or ending yesterday before today’s first catch', () => {
    expect(activeStreak([{ count: 0 }, { count: 1 }, { count: 2 }, { count: 3 }])).toBe(3);
    expect(activeStreak([{ count: 1 }, { count: 1 }, { count: 0 }])).toBe(2);
    expect(activeStreak([{ count: 1 }, { count: 0 }, { count: 0 }])).toBe(0);
    expect(activeStreak([])).toBe(0);
  });
});
