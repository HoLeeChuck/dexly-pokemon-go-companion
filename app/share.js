// Account-free comparison links. A category's registered species travel as a bitset in the
// URL fragment, so nothing is uploaded or stored on a server.
export const SHARE_CATEGORIES = ['normal', 'shiny', 'xxl', 'xxs'];
const MAX_DEX = 1025;

function toBase64Url(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromBase64Url(text) {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** Registered default species for one category, as a compact bitset. */
export function encodeCollection(catalog, owned, category) {
  const bytes = new Uint8Array(Math.ceil(MAX_DEX / 8));
  for (const p of catalog) {
    if (!p.isDefault || p.n < 1 || p.n > MAX_DEX || !owned.has(`${p.id}:${category}`)) continue;
    bytes[(p.n - 1) >> 3] |= 1 << ((p.n - 1) & 7);
  }
  return toBase64Url(bytes);
}

export function decodeCollection(data) {
  const bytes = fromBase64Url(data);
  const numbers = new Set();
  for (let n = 1; n <= Math.min(MAX_DEX, bytes.length * 8); n += 1)
    if (bytes[(n - 1) >> 3] & (1 << ((n - 1) & 7))) numbers.add(n);
  return numbers;
}

const cleanName = (name) =>
  String(name || '')
    .replace(/[^\p{L}\p{N} ._-]/gu, '')
    .trim()
    .slice(0, 24);

export function shareLink(origin, catalog, owned, category, name) {
  const params = new URLSearchParams({
    v: '1',
    c: category,
    d: encodeCollection(catalog, owned, category),
  });
  if (cleanName(name)) params.set('n', cleanName(name));
  return `${origin}/#compare?${params}`;
}

/** Parse a #compare fragment. Returns null for anything malformed. */
export function parseShare(hash) {
  const query = hash.split('?')[1];
  if (!query) return null;
  const params = new URLSearchParams(query);
  const category = params.get('c');
  const data = params.get('d');
  if (params.get('v') !== '1' || !SHARE_CATEGORIES.includes(category) || !data) return null;
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(data)) return null;
  try {
    return { category, name: cleanName(params.get('n')), registered: decodeCollection(data) };
  } catch {
    return null;
  }
}

/** Compare a friend's registered set with this browser's collection. */
export function compare(catalog, owned, share) {
  const species = catalog.filter((p) => p.isDefault && p.rules[share.category] === 'released');
  const mine = (p) => owned.has(`${p.id}:${share.category}`);
  const theirs = (p) => share.registered.has(p.n);
  return {
    youCanHelp: species.filter((p) => mine(p) && !theirs(p)),
    theyCanHelp: species.filter((p) => !mine(p) && theirs(p)),
    bothMissing: species.filter((p) => !mine(p) && !theirs(p)),
    theirCount: species.filter(theirs).length,
    total: species.length,
  };
}

/** Pokémon GO search for untraded candidates of the given species in your own storage. */
export function helpSearch(list, category) {
  if (!list.length) return '';
  const terms = [[...new Set(list.map((p) => p.n))].sort((a, b) => a - b).join(',')];
  if (category !== 'normal') terms.push(category);
  terms.push('!traded');
  return terms.join('&');
}
