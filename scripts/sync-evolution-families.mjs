import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { format } from 'prettier';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SOURCE_URL = 'https://pogoapi.net/api/v1/pokemon_evolutions.json';
const HASH_URL = 'https://pogoapi.net/api/v1/api_hashes.json';

const [evolutionResponse, hashResponse] = await Promise.all([fetch(SOURCE_URL), fetch(HASH_URL)]);
if (!evolutionResponse.ok) throw new Error(`Evolution metadata: HTTP ${evolutionResponse.status}`);
if (!hashResponse.ok) throw new Error(`PoGoAPI hashes: HTTP ${hashResponse.status}`);

const evolutions = await evolutionResponse.json();
const hashes = await hashResponse.json();
const parentByDex = new Map();

for (const entry of evolutions) {
  if (entry.form !== 'Normal') continue;
  for (const evolution of entry.evolutions ?? []) {
    if (evolution.form !== 'Normal') continue;
    if (!parentByDex.has(evolution.pokemon_id)) {
      parentByDex.set(evolution.pokemon_id, entry.pokemon_id);
    }
  }
}

function ancestorsFor(dex) {
  const seen = new Set();
  const ancestors = [dex];
  let current = dex;
  while (parentByDex.has(current) && !seen.has(current)) {
    seen.add(current);
    current = parentByDex.get(current);
    ancestors.push(current);
  }
  return ancestors.sort((left, right) => left - right);
}

const allDexNumbers = new Set();
for (const [child, parent] of parentByDex) {
  allDexNumbers.add(child);
  allDexNumbers.add(parent);
}

const families = Object.fromEntries(
  [...allDexNumbers]
    .sort((left, right) => left - right)
    .map((dex) => [String(dex), ancestorsFor(dex)]),
);
const payload = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString().slice(0, 10),
  source: {
    url: SOURCE_URL,
    sha256: hashes['pokemon_evolutions.json'].hash_sha256,
  },
  families,
};

await writeFile(
  `${ROOT}catalog/evolution-families.v1.json`,
  await format(JSON.stringify(payload), { parser: 'json', printWidth: 100 }),
);
console.log(`Generated ${Object.keys(families).length} evolution-family mappings.`);
