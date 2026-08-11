import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { format } from 'prettier';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const VERSION = '2026-08-11.2';
const DATE = '2026-08-11';
const ASSET_COMMIT = '1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90';
const RAW_BASE = `https://raw.githubusercontent.com/PokeMiners/pogo_assets/${ASSET_COMMIT}/Images/Pokemon%20-%20256x256/Addressable%20Assets/`;
const API = 'https://pogoapi.net/api/v1';
const KEYS = ['normal', 'shiny', 'lucky', 'hundo', 'xxl', 'xxs', 'shadow', 'purified'];

async function get(name) {
  const response = await fetch(`${API}/${name}.json`);
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  return response.json();
}

async function getAssetFilenames() {
  async function tree(sha) {
    const response = await fetch(
      `https://api.github.com/repos/PokeMiners/pogo_assets/git/trees/${sha}`,
      { headers: { 'User-Agent': 'Dexly catalog sync' } },
    );
    if (!response.ok) throw new Error(`PokeMiners asset tree: HTTP ${response.status}`);
    return response.json();
  }

  let data = await tree(ASSET_COMMIT);
  for (const segment of ['Images', 'Pokemon - 256x256', 'Addressable Assets']) {
    const entry = data.tree.find((item) => item.type === 'tree' && item.path === segment);
    if (!entry) throw new Error(`Missing PokeMiners asset directory: ${segment}`);
    data = await tree(entry.sha);
  }
  if (data.truncated) throw new Error('PokeMiners asset tree response was truncated');
  return new Set(data.tree.filter((entry) => entry.type === 'blob').map((entry) => entry.path));
}

function generation(dex) {
  return dex <= 151
    ? 1
    : dex <= 251
      ? 2
      : dex <= 386
        ? 3
        : dex <= 493
          ? 4
          : dex <= 649
            ? 5
            : dex <= 721
              ? 6
              : dex <= 809
                ? 7
                : dex <= 905
                  ? 8
                  : 9;
}

const regions = [
  '',
  'Kanto',
  'Johto',
  'Hoenn',
  'Sinnoh',
  'Unova',
  'Kalos',
  'Alola',
  'Galar',
  'Paldea',
];
const regionOverrides = new Map([
  [899, 'Hisui'], // Wyrdeer
  [900, 'Hisui'], // Kleavor
  [901, 'Hisui'], // Ursaluna
  [902, 'Hisui'], // Basculegion (applies when the standard form enters the feed)
  [903, 'Hisui'], // Sneasler
  [904, 'Hisui'], // Overqwil
  [905, 'Hisui'], // Enamorus
]);
const normalize = (value) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const slug = (value) => normalize(value).replace(/ /g, '-');
const id4 = (dex) => String(dex).padStart(4, '0');
const q = (value) => `'${String(value).replaceAll("'", "''")}'`;

function values(rows, columns, conflict) {
  const groups = [];
  for (let i = 0; i < rows.length; i += 40) {
    groups.push(
      `INSERT INTO ${columns}\nVALUES\n${rows
        .slice(i, i + 40)
        .map(
          (r) =>
            `  (${r.map((v) => (v === null ? 'NULL' : typeof v === 'number' ? v : q(v))).join(', ')})`,
        )
        .join(',\n')}\n${conflict};`,
    );
  }
  return groups.join('\n\n');
}

const [released, types, shiny, shadow, hashes, assetFilenames] = await Promise.all([
  get('released_pokemon'),
  get('pokemon_types'),
  get('shiny_pokemon'),
  get('shadow_pokemon'),
  get('api_hashes'),
  getAssetFilenames(),
]);

function chooseAssets(dex, isShiny) {
  const exactNormal = `pm${dex}.icon.png`;
  const prefix = `pm${dex}.`;
  const matches = [...assetFilenames].filter(
    (filename) =>
      (filename === exactNormal || filename.startsWith(prefix)) && filename.endsWith('.icon.png'),
  );
  const normalCandidates = matches
    .filter((filename) => !filename.endsWith('.s.icon.png'))
    .sort((a, b) => a.length - b.length || a.localeCompare(b));
  const normal = assetFilenames.has(exactNormal) ? exactNormal : normalCandidates[0];
  if (!normal) throw new Error(`Missing sprite asset for #${dex}`);
  if (!isShiny) return { normal: { upstreamPath: normal } };

  const pairedShiny = normal.replace(/\.icon\.png$/, '.s.icon.png');
  const shinyCandidates = matches
    .filter((filename) => filename.endsWith('.s.icon.png'))
    .sort((a, b) => a.length - b.length || a.localeCompare(b));
  const shinyPath = assetFilenames.has(pairedShiny) ? pairedShiny : shinyCandidates[0];
  if (!shinyPath) throw new Error(`Missing released Shiny sprite asset for #${dex}`);
  return { normal: { upstreamPath: normal }, shiny: { upstreamPath: shinyPath } };
}
const normalTypes = new Map();
for (const entry of types) {
  if (entry.form === 'Normal' || !normalTypes.has(entry.pokemon_id)) {
    normalTypes.set(
      entry.pokemon_id,
      entry.type.map((type) => type.toLowerCase()),
    );
  }
}

// PoGoAPI's release file currently trails the dated release chronology for these
// 2026 debuts. Keep the small reviewed delta explicit until its next snapshot.
const reviewedRecentReleases = {
  778: 'Mimikyu',
  807: 'Zeraora',
  824: 'Blipbug',
  825: 'Dottler',
  826: 'Orbeetle',
  843: 'Silicobra',
  844: 'Sandaconda',
  931: 'Squawkabilly',
  955: 'Flittle',
  956: 'Espathra',
  968: 'Orthworm',
  973: 'Flamigo',
};
for (const [id, name] of Object.entries(reviewedRecentReleases)) {
  released[id] ??= { id: Number(id), name };
}

const forms = Object.values(released)
  .sort((a, b) => a.id - b.id)
  .map(({ id: dex, name }) => {
    const gen = generation(dex);
    const isShiny = Boolean(shiny[dex]);
    const isShadow = Boolean(shadow[dex]);
    const pokemonTypes = normalTypes.get(dex);
    if (!pokemonTypes?.length) throw new Error(`Missing Normal type metadata for #${dex} ${name}`);
    return {
      speciesId: `species-${id4(dex)}`,
      formId: `form-${id4(dex)}-standard`,
      formKey: 'standard',
      dex,
      name,
      normalizedName: normalize(name),
      generation: gen,
      region: regionOverrides.get(dex) ?? regions[gen],
      types: pokemonTypes,
      release: { normal: true, shiny: isShiny, shadow: isShadow, purified: isShadow },
      eligibility: {
        normal: true,
        shiny: isShiny,
        lucky: true,
        hundo: true,
        xxl: true,
        xxs: true,
        shadow: isShadow,
        purified: isShadow,
      },
      tradeable: true,
      assets: chooseAssets(dex, isShiny),
    };
  });

const manifest = {
  schemaVersion: 1,
  catalogVersion: VERSION,
  releaseMetadataAsOf: DATE,
  source: {
    name: 'PokeMiners pogo_assets + PoGoAPI release metadata',
    repositoryUrl: 'https://github.com/PokeMiners/pogo_assets',
    commit: ASSET_COMMIT,
    assetRoot: 'Images/Pokemon - 256x256/Addressable Assets',
    rawBaseUrl: RAW_BASE,
    releaseApiUrl: `${API}/released_pokemon.json`,
    releaseApiSha256: hashes['released_pokemon.json'].hash_sha256,
  },
  eligibilityKeys: KEYS,
  forms,
};
const json = await format(JSON.stringify(manifest), { parser: 'json', printWidth: 100 });
await writeFile(`${ROOT}catalog/catalog.v1.json`, json);

const catalogId = 'catalog-2026-08-11-2';
const upstream = `PokeMiners/pogo_assets@${ASSET_COMMIT}; PoGoAPI released_pokemon@${hashes['released_pokemon.json'].hash_sha256}`;
const sourceHash = createHash('sha256').update(json).digest('hex');
const spriteRows = forms.map((f) => [
  `sprite-${f.formId}`,
  RAW_BASE + f.assets.normal.upstreamPath,
  f.assets.shiny ? RAW_BASE + f.assets.shiny.upstreamPath : null,
  upstream,
  VERSION,
]);
const speciesRows = forms.map((f) => [
  f.speciesId,
  f.dex,
  f.dex === 29 ? 'nidoran-female' : f.dex === 32 ? 'nidoran-male' : slug(f.name),
  f.name,
  f.normalizedName,
  f.generation,
  f.region.toLowerCase(),
  catalogId,
]);
const typeRows = forms.flatMap((f) => f.types.map((type) => [f.speciesId, type]));
const formRows = forms.map((f) => [
  f.formId,
  f.speciesId,
  'standard',
  f.name,
  f.normalizedName,
  'standard',
  1,
  1,
  f.tradeable ? 1 : 0,
  `sprite-${f.formId}`,
  catalogId,
]);
const aliasRows = forms.map((f) => [f.formId, f.normalizedName]);
const ruleRows = forms.flatMap((f) =>
  KEYS.map((key) => [
    f.formId,
    key,
    f.eligibility[key] ? 'released' : key === 'shiny' ? 'unreleased' : 'ineligible',
    `PoGoAPI metadata snapshot ${DATE}`,
    `${DATE}T00:00:00.000Z`,
  ]),
);

const sql = `PRAGMA foreign_keys = ON;\n\n-- Generated by scripts/sync-catalog.mjs. Additive upserts preserve user collection rows.\nINSERT INTO catalog_versions (id, version, upstream_ref, source_hash, imported_at) VALUES (${q(catalogId)}, ${q(VERSION)}, ${q(upstream)}, ${q(sourceHash)}, ${q(`${DATE}T00:00:00.000Z`)});\n\n${values(spriteRows, 'sprite_assets (id, normal_path, shiny_path, upstream_ref, manifest_version)', 'ON CONFLICT(id) DO UPDATE SET normal_path=excluded.normal_path, shiny_path=excluded.shiny_path, upstream_ref=excluded.upstream_ref, manifest_version=excluded.manifest_version')}\n\n${values(speciesRows, 'pokemon_species (id, dex_number, slug, display_name, normalized_name, generation, region_code, catalog_version_id)', 'ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name, normalized_name=excluded.normalized_name, generation=excluded.generation, region_code=excluded.region_code, catalog_version_id=excluded.catalog_version_id')}\n\n${values(typeRows, 'pokemon_types (species_id, type)', 'ON CONFLICT(species_id, type) DO NOTHING')}\n\n${values(formRows, 'pokemon_forms (id, species_id, form_key, display_name, normalized_name, variant_kind, is_default, is_released, is_tradeable, sprite_asset_id, catalog_version_id)', 'ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name, normalized_name=excluded.normalized_name, is_released=excluded.is_released, is_tradeable=excluded.is_tradeable, sprite_asset_id=excluded.sprite_asset_id, catalog_version_id=excluded.catalog_version_id, retired_at=NULL')}\n\n${values(aliasRows, 'form_aliases (form_id, normalized_alias)', 'ON CONFLICT(form_id, normalized_alias) DO NOTHING')}\n\n${values(ruleRows, 'form_category_rules (form_id, category_id, state, source_note, updated_at)', 'ON CONFLICT(form_id, category_id) DO UPDATE SET state=excluded.state, source_note=excluded.source_note, updated_at=excluded.updated_at')}\n`;
await writeFile(`${ROOT}migrations/0003_full_released_pokedex.sql`, sql);
console.log(
  `Generated ${forms.length} released species, ${forms.filter((f) => f.release.shiny).length} shiny, ${forms.filter((f) => f.release.shadow).length} shadow.`,
);
