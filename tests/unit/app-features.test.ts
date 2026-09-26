import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { catalog } from '../../app/catalog.js';
import {
  collectionKeys,
  collectedEntries,
  setMany,
  recoverySnapshots,
  restoreSnapshot,
} from '../../app/data.js';
import {
  encodeCollection,
  decodeCollection,
  parseShare,
  shareLink,
  compare,
  helpSearch,
} from '../../app/share.js';
import { medalShelf, nearlyComplete, evolutionHint, recap } from '../../app/insights.js';
import { legacyWindows, windowStatus, icsFor } from '../../app/legacy-moves.js';
import { recommendations, discordMessages } from '../../app/recommendations.js';
import evolutions from '../../catalog/evolution-families.v1.json';

class MemoryStorage {
  values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  getItem(k: string) {
    return this.values.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.values.set(k, v);
  }
  removeItem(k: string) {
    this.values.delete(k);
  }
  key(i: number) {
    return [...this.values.keys()][i] ?? null;
  }
}
const categories: [string, string][] = [
  ['normal', 'Normal'],
  ['shiny', 'Shiny'],
  ['lucky', 'Lucky'],
  ['hundo', '100%'],
  ['xxl', 'XXL'],
  ['xxs', 'XXS'],
  ['shadow', 'Shadow'],
  ['purified', 'Purified'],
];
const species = catalog.filter((p) => p.isDefault);
const byDex = (n: number) => species.find((p) => p.n === n)!;

beforeEach(() => vi.stubGlobal('localStorage', new MemoryStorage()));
afterEach(() => vi.unstubAllGlobals());

describe('bulk collection changes', () => {
  it('saves a batch once, skips ineligible targets and records collection dates', () => {
    const { changed } = setMany([
      { formId: 'form-0001-standard', categoryId: 'normal', collected: true },
      { formId: 'form-0004-standard', categoryId: 'normal', collected: true },
      { formId: 'form-0133-standard', categoryId: 'shadow', collected: true },
      { formId: 'form-0006-mega-x', categoryId: 'xxl', collected: true },
    ]);
    expect(changed).toBe(2);
    expect([...collectionKeys()].sort()).toEqual([
      'form-0001-standard:normal',
      'form-0004-standard:normal',
    ]);
    expect(collectedEntries().every((e) => typeof e.updatedAt === 'string')).toBe(true);
  });
  it('clears entries and keeps a restorable recovery snapshot', () => {
    setMany([{ formId: 'form-0001-standard', categoryId: 'normal', collected: true }]);
    setMany(
      [{ formId: 'form-0001-standard', categoryId: 'normal', collected: false }],
      'Before test clear',
    );
    expect(collectionKeys().size).toBe(0);
    const snapshot = recoverySnapshots().find((s) => s.summary.sourceName === 'Before test clear');
    expect(snapshot?.summary.collectionRecords).toBe(1);
    restoreSnapshot(snapshot!.id);
    expect(collectionKeys().has('form-0001-standard:normal')).toBe(true);
  });
});

describe('compare links', () => {
  it('round trips registered species through the URL fragment', () => {
    const owned = new Set([
      'form-0001-standard:shiny',
      'form-1025-standard:shiny',
      'form-0006-mega-x:shiny',
    ]);
    const decoded = decodeCollection(encodeCollection(catalog, owned, 'shiny'));
    expect([...decoded].sort((a, b) => a - b)).toEqual([1, 1025]);
    const link = shareLink('https://dex.cjdev.app', catalog, owned, 'shiny', 'Ash <K>');
    const parsed = parseShare(new URL(link).hash);
    expect(parsed?.category).toBe('shiny');
    expect(parsed?.name).toBe('Ash K');
    expect(link.length).toBeLessThan(260);
  });
  it('rejects malformed or unsupported links', () => {
    expect(parseShare('#compare?v=1&c=lucky&d=AAAA')).toBeNull();
    expect(parseShare('#compare?v=2&c=shiny&d=AAAA')).toBeNull();
    expect(parseShare('#compare?v=1&c=shiny&d=%3Cscript%3E')).toBeNull();
    expect(parseShare('#compare')).toBeNull();
  });
  it('finds who can help whom and builds an untraded storage search', () => {
    const mine = new Set([`${byDex(1).id}:normal`, `${byDex(4).id}:normal`]);
    const share = { category: 'normal', name: '', registered: new Set([4, 7]) };
    const result = compare(catalog, mine, share);
    expect(result.youCanHelp.map((p) => p.n)).toEqual([1]);
    expect(result.theyCanHelp.map((p) => p.n)).toEqual([7]);
    expect(helpSearch(result.youCanHelp, 'normal')).toBe('1&!traded');
    expect(helpSearch([byDex(25), byDex(7)], 'shiny')).toBe('7,25&shiny&!traded');
  });
});

describe('insights', () => {
  it('awards regional medals from default species using the reviewed thresholds', () => {
    const owned = new Set(
      species
        .filter((p) => p.region === 'Kanto')
        .slice(0, 50)
        .map((p) => `${p.id}:normal`),
    );
    const kanto = medalShelf(catalog, owned, 'normal').find((m) => m.region === 'Kanto')!;
    expect(kanto).toMatchObject({
      collected: 50,
      tier: 'silver',
      nextTier: 'gold',
      nextTarget: 100,
    });
  });
  it('lists species with one or two eligible categories left', () => {
    const p = byDex(6);
    const eligible = categories.filter(([c]) => p.rules[c] === 'released');
    const owned = new Set(eligible.slice(1).map(([c]) => `${p.id}:${c}`));
    const found = nearlyComplete(catalog, owned, categories).find((x) => x.p.id === p.id);
    expect(found?.missing.map(([c]) => c)).toEqual([eligible[0]![0]]);
  });
  it('hints at evolving a registered earlier stage', () => {
    const owned = new Set([`${byDex(444).id}:normal`]);
    expect(
      evolutionHint(byDex(445), owned, 'normal', catalog, evolutions.families).map((p) => p.n),
    ).toEqual([444]);
    owned.add(`${byDex(445).id}:normal`);
    expect(evolutionHint(byDex(445), owned, 'normal', catalog, evolutions.families)).toEqual([]);
  });
  it('recaps dated entries within the period only', () => {
    const now = Date.parse('2026-09-25T12:00:00Z');
    const entries = [
      {
        formId: byDex(1).id,
        categoryId: 'shiny',
        collected: true,
        updatedAt: '2026-09-24T10:00:00Z',
      },
      {
        formId: byDex(4).id,
        categoryId: 'normal',
        collected: true,
        updatedAt: '2026-09-20T10:00:00Z',
      },
      {
        formId: byDex(7).id,
        categoryId: 'normal',
        collected: true,
        updatedAt: '2026-08-01T10:00:00Z',
      },
      { formId: byDex(8).id, categoryId: 'normal', collected: true },
    ];
    const r = recap(entries, catalog, new Date(now - 7 * 86_400_000));
    expect(r).toMatchObject({
      total: 2,
      activeDays: 2,
      dated: true,
      byCategory: { shiny: 1, normal: 1 },
    });
    expect(r.highlights.map((h) => h.p.n)).toEqual([1]);
  });
});

describe('legacy move windows', () => {
  it('orders open windows first and reports status by date', () => {
    const at = new Date('2026-10-10T15:00:00');
    expect(windowStatus(legacyWindows(at)[0]!, at)).toBe('Active');
    expect(
      legacyWindows(new Date('2026-12-01T00:00:00')).every(
        (w) => windowStatus(w, new Date('2026-12-01')) === 'Ended',
      ),
    ).toBe(true);
  });
  it('exports a floating-time calendar event with a reminder', () => {
    const ics = icsFor(legacyWindows(new Date('2026-09-01'))[0]!, new Date('2026-09-25T00:00:00Z'));
    expect(ics).toContain('DTSTART:20260912T140000');
    expect(ics).toContain('TRIGGER:-PT1H');
    expect(ics.split('\r\n')[0]).toBe('BEGIN:VCALENDAR');
  });
});

describe('ported Search Lab tools', () => {
  it('keeps the eight recommendations in order with exact strings', () => {
    const recs = recommendations(species, []);
    expect(recs.map((r) => r.name)).toEqual([
      'Trade',
      'Megas',
      'Tag',
      'Evolve',
      'Special Moves',
      'Untagged',
      'XXL',
      'XXS',
    ]);
    expect(recs.slice(0, 6).map((r) => r.values[0])).toEqual([
      '#trade&',
      '#max&mega2-3&',
      '!#&4*,shiny,costume,background,candykm20,dynamax,gigantamax,lucky&',
      '!#&evolvenew&',
      '!#&@frustration,@return,@special&',
      '!#&',
    ]);
    expect(recs[6]!.values.every((v) => v.startsWith('!#&'))).toBe(true);
  });
  it('splits Discord messages within the standard and Nitro limits', () => {
    const all = new Set(['normal', 'shiny', 'xxl', 'xxs']);
    // Alternating gaps defeat range compression, forcing long lists.
    const entries = species
      .filter((p) => p.n % 2)
      .flatMap((p) =>
        [...all].map((categoryId) => ({ formId: p.id, categoryId, collected: true })),
      );
    const standard = discordMessages(species, entries, { categories: all });
    const nitro = discordMessages(species, entries, { categories: all, nitro: true });
    expect(standard.every((m) => m.length <= 2000)).toBe(true);
    expect(nitro.every((m) => m.length <= 4000)).toBe(true);
    expect(nitro.length).toBeLessThan(standard.length);
    expect(discordMessages(species, [], { categories: new Set() })).toEqual([]);
  });
});
