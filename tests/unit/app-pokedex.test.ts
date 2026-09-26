import { describe, expect, it } from 'vitest';
import { catalog, catalogSources } from '../../app/catalog.js';
import {
  DEVICES,
  deviceFromSlug,
  officialDexUrl,
  evolutionFamily,
  dialWindow,
  pagesOf,
  sourceGroups,
} from '../../app/pokedex.js';
import evolutions from '../../catalog/evolution-families.v1.json';

const species = catalog.filter((p) => p.isDefault);

describe('Pokédex devices', () => {
  it('has one device per catalog region plus the National master device', () => {
    const regions = new Set(species.map((p) => p.region));
    expect(DEVICES[0]?.region).toBe('All regions');
    expect(new Set(DEVICES.slice(1).map((d) => d.region))).toEqual(regions);
    expect(new Set(DEVICES.map((d) => d.slug)).size).toBe(DEVICES.length);
  });

  it('shows only showcase Pokémon that belong to the device', () => {
    for (const d of DEVICES.slice(1))
      for (const n of d.showcase)
        expect(species.find((p) => p.n === n)?.region, `${d.name} #${n}`).toBe(d.region);
  });

  it('resolves slugs from the address and rejects unknown ones', () => {
    expect(deviceFromSlug('kanto')?.region).toBe('Kanto');
    expect(deviceFromSlug('national')?.region).toBe('All regions');
    expect(deviceFromSlug('orre')).toBeNull();
  });
});

describe('official Pokédex links', () => {
  it.each([
    ['Bulbasaur', 'bulbasaur'],
    ['Nidoran♀', 'nidoran-female'],
    ['Nidoran♂', 'nidoran-male'],
    ['Farfetch’d', 'farfetchd'],
    ['Mr. Mime', 'mr-mime'],
    ['Mime Jr.', 'mime-jr'],
    ['Ho-Oh', 'ho-oh'],
    ['Type: Null', 'type-null'],
    ['Flabébé', 'flabebe'],
    ['Tapu Koko', 'tapu-koko'],
  ])('%s → %s', (name, slug) => {
    expect(officialDexUrl(name)).toBe(`https://www.pokemon.com/us/pokedex/${slug}`);
  });

  it('uses the species name, not a form name, for every species', () => {
    for (const p of species)
      expect(officialDexUrl(p.speciesName)).toMatch(/\/pokedex\/[a-z0-9-]+$/);
    const flabebe = species.find((p) => p.n === 669)!;
    expect(officialDexUrl(flabebe.speciesName)).toMatch(/\/flabebe$/);
  });
});

describe('evolution families', () => {
  it('lists a linear family in stage order from any member', () => {
    expect(evolutionFamily(5, evolutions.families)).toEqual([4, 5, 6]);
    expect(evolutionFamily(4, evolutions.families)).toEqual([4, 5, 6]);
  });

  it('includes every branch of a branching family', () => {
    const eevee = evolutionFamily(133, evolutions.families);
    expect(eevee[0]).toBe(133);
    expect(eevee).toEqual(expect.arrayContaining([134, 135, 136, 196, 197]));
  });

  it('returns just the Pokémon when it has no family', () => {
    expect(evolutionFamily(83, { '83': [83] })).toEqual([83]);
    expect(evolutionFamily(999_999, {})).toEqual([999_999]);
  });
});

describe('dial and paging', () => {
  const items = Array.from({ length: 20 }, (_, i) => i);

  it('centres the dial on the current item and wraps at the ends', () => {
    expect(dialWindow(items, 0, 2).map((x) => x.item)).toEqual([18, 19, 0, 1, 2]);
    expect(dialWindow(items, 0, 2).map((x) => x.offset)).toEqual([-2, -1, 0, 1, 2]);
  });

  it('never repeats an item when the list is shorter than the dial', () => {
    expect(dialWindow([1, 2, 3], 1, 5).map((x) => x.item)).toEqual([1, 2, 3]);
    expect(dialWindow([], 0, 5)).toEqual([]);
  });

  it('keeps a region on one page and splits the National Dex', () => {
    expect(pagesOf(species.filter((p) => p.region === 'Unova'))).toHaveLength(1);
    const national = pagesOf(species);
    expect(national).toHaveLength(Math.ceil(species.length / 100));
    expect(national.flat()).toHaveLength(species.length);
  });
});

describe('sources and credits', () => {
  it('groups recorded sources by kind without duplicates or local paths', () => {
    const groups = sourceGroups(catalogSources);
    const all = [...groups.official, ...groups.secondary, ...groups.asset];
    expect(groups.official.length).toBeGreaterThan(0);
    expect(new Set(all.map((s) => s.url)).size).toBe(all.length);
    expect(all.every((s) => s.url.startsWith('https://'))).toBe(true);
  });
});
