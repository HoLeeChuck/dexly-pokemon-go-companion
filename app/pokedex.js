/** Pokédex devices, official links, evolution families and paging. No DOM access. */

// One device per region. Hues nod to each region's games; National is the master device.
export const DEVICES = [
  {
    region: 'All regions',
    slug: 'national',
    name: 'National',
    gen: 'All generations',
    hue: '#e3350d',
    showcase: [25, 133, 150],
  },
  {
    region: 'Kanto',
    slug: 'kanto',
    name: 'Kanto',
    gen: 'Gen I',
    hue: '#e3350d',
    showcase: [1, 4, 7],
  },
  {
    region: 'Johto',
    slug: 'johto',
    name: 'Johto',
    gen: 'Gen II',
    hue: '#c9a227',
    showcase: [152, 155, 158],
  },
  {
    region: 'Hoenn',
    slug: 'hoenn',
    name: 'Hoenn',
    gen: 'Gen III',
    hue: '#1f9e76',
    showcase: [252, 255, 258],
  },
  {
    region: 'Sinnoh',
    slug: 'sinnoh',
    name: 'Sinnoh',
    gen: 'Gen IV',
    hue: '#7b6fd0',
    showcase: [387, 390, 393],
  },
  {
    region: 'Unova',
    slug: 'unova',
    name: 'Unova',
    gen: 'Gen V',
    hue: '#5d7285',
    showcase: [495, 498, 501],
  },
  {
    region: 'Kalos',
    slug: 'kalos',
    name: 'Kalos',
    gen: 'Gen VI',
    hue: '#2f6fd8',
    showcase: [650, 653, 656],
  },
  {
    region: 'Alola',
    slug: 'alola',
    name: 'Alola',
    gen: 'Gen VII',
    hue: '#ee8a1f',
    showcase: [722, 725, 728],
  },
  {
    region: 'Galar',
    slug: 'galar',
    name: 'Galar',
    gen: 'Gen VIII',
    hue: '#c23f7d',
    showcase: [810, 813, 816],
  },
  {
    region: 'Hisui',
    slug: 'hisui',
    name: 'Hisui',
    gen: 'Legends',
    hue: '#8a6a3c',
    showcase: [899, 900, 903],
  },
  {
    region: 'Paldea',
    slug: 'paldea',
    name: 'Paldea',
    gen: 'Gen IX',
    hue: '#9546d4',
    showcase: [906, 909, 912],
  },
  {
    region: 'Unknown',
    slug: 'unknown',
    name: 'Unknown',
    gen: 'Meltan line',
    hue: '#7d8792',
    showcase: [808, 809],
  },
];

export const deviceFor = (region) => DEVICES.find((d) => d.region === region) || DEVICES[0];
export const deviceFromSlug = (slug) => DEVICES.find((d) => d.slug === slug) || null;

/** Link to the species' page in the official Pokédex at Pokémon.com. */
export function officialDexUrl(speciesName) {
  const slug = speciesName
    .toLowerCase()
    .replace('♀', '-female')
    .replace('♂', '-male')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'.:]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return `https://www.pokemon.com/us/pokedex/${encodeURIComponent(slug)}`;
}

/**
 * Every Dex number in n's evolution family, earliest stage first.
 * families[k] lists k's own line from its first stage: [first, ..., k].
 */
export function evolutionFamily(n, families) {
  const root = (families[n] || [n])[0];
  const stages = new Map([[root, 0]]);
  for (const line of Object.values(families)) {
    if (line[0] !== root) continue;
    line.forEach((m, stage) => stages.set(m, Math.min(stage, stages.get(m) ?? stage)));
  }
  return [...stages].sort((a, b) => a[1] - b[1] || a[0] - b[0]).map(([m]) => m);
}

/** The items around index i, for the dial. Wraps so the dial never runs out. */
export function dialWindow(items, i, radius) {
  if (!items.length) return [];
  const span = Math.min(items.length, radius * 2 + 1);
  const start = i - Math.floor(span / 2);
  return Array.from({ length: span }, (_, k) => {
    const index = (((start + k) % items.length) + items.length) % items.length;
    return { item: items[index], offset: start + k - i };
  });
}

/** Split a long list into pages; short lists (a single region) stay whole. */
export function pagesOf(items, size = 100, wholeUpTo = 160) {
  if (items.length <= wholeUpTo) return [items];
  const pages = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages;
}

/** Recorded catalog sources, grouped by kind and deduplicated by URL. */
export function sourceGroups(sources) {
  const groups = { official: [], secondary: [], asset: [] };
  const seen = new Set();
  for (const s of sources) {
    if (!groups[s.kind] || !/^https:\/\//.test(s.url) || seen.has(s.url)) continue;
    seen.add(s.url);
    groups[s.kind].push({ url: s.url, host: new URL(s.url).hostname.replace(/^www\./, '') });
  }
  return groups;
}
