#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format } from 'prettier';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OVERRIDES_PATH = resolve(ROOT, 'catalog/catalog-overrides.v1.json');
const MANIFEST_PATH = resolve(ROOT, 'catalog/catalog.v1.json');
const API_BASE = 'https://pogoapi.net/api/v1';
const CATEGORY_KEYS = ['normal', 'shiny', 'lucky', 'hundo', 'xxl', 'xxs', 'shadow', 'purified'];
const API_INPUTS = [
  'released_pokemon',
  'shiny_pokemon',
  'shadow_pokemon',
  'pokemon_rarity',
  'pokemon_types',
  'pokemon_forms',
  'pokemon_evolutions',
  'pokemon_names',
];
const TRADEABLE_MYTHICAL_EXCEPTIONS = new Set([808, 809]);
const LEGACY_VARIANT_KIND = {
  standard: 'standard',
  regional: 'regional',
  costume: 'costume',
  gender: 'gender',
  alternate: 'alternate',
  mega: 'mega',
  primal: 'other',
  gigantamax: 'other',
  fusion: 'other',
  other: 'other',
};

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const normalize = (value) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const slug = (value) => normalize(value).replaceAll(' ', '-');
const id4 = (dex) => String(dex).padStart(4, '0');
const sqlQuote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const sqlValue = (value) =>
  value === null || value === undefined
    ? 'NULL'
    : typeof value === 'number'
      ? String(value)
      : sqlQuote(value);

function parseArguments(arguments_) {
  const options = { migration: null, outputRoot: ROOT };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--migration') {
      options.migration = arguments_[index + 1];
      if (!options.migration || options.migration.startsWith('--')) {
        throw new Error('--migration requires a filename.');
      }
      index += 1;
    } else if (argument === '--output-root') {
      const value = arguments_[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('--output-root requires a directory path.');
      }
      options.outputRoot = resolve(process.cwd(), value);
      index += 1;
    } else if (argument === '--help' || argument === '-h') {
      console.log(
        'Usage: node scripts/sync-catalog.mjs [--migration 0009_name.sql] [--output-root path]',
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }
  return options;
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function fetchJson(url, label) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'CatchGrid catalog sync/2' },
  });
  if (!response.ok) throw new Error(`${label}: HTTP ${response.status}`);
  const raw = await response.text();
  return { data: JSON.parse(raw), raw, sha256: sha256(raw) };
}

async function getAssetTree(commit) {
  async function tree(sha) {
    return (
      await fetchJson(
        `https://api.github.com/repos/PokeMiners/pogo_assets/git/trees/${sha}`,
        `PokeMiners tree ${sha}`,
      )
    ).data;
  }

  let data = await tree(commit);
  for (const segment of ['Images', 'Pokemon - 256x256', 'Addressable Assets']) {
    const entry = data.tree.find((item) => item.type === 'tree' && item.path === segment);
    if (!entry) throw new Error(`Missing PokeMiners asset directory: ${segment}`);
    data = await tree(entry.sha);
  }
  if (data.truncated) throw new Error('PokeMiners asset tree response was truncated.');
  const filenames = data.tree
    .filter((entry) => entry.type === 'blob')
    .map((entry) => entry.path)
    .sort((left, right) => left.localeCompare(right));
  return { filenames: new Set(filenames), sha256: sha256(`${filenames.join('\n')}\n`) };
}

function generation(dex) {
  if (dex <= 151) return 1;
  if (dex <= 251) return 2;
  if (dex <= 386) return 3;
  if (dex <= 493) return 4;
  if (dex <= 649) return 5;
  if (dex <= 721) return 6;
  if (dex <= 809) return 7;
  if (dex <= 905) return 8;
  return 9;
}

function defaultRegion(dex) {
  if (dex <= 151) return 'Kanto';
  if (dex <= 251) return 'Johto';
  if (dex <= 386) return 'Hoenn';
  if (dex <= 493) return 'Sinnoh';
  if (dex <= 649) return 'Unova';
  if (dex <= 721) return 'Kalos';
  if (dex <= 809) return 'Alola';
  if (dex <= 905) return 'Galar';
  return 'Paldea';
}

function stateValue(value) {
  if (value === 'released') return true;
  if (value === 'unreleased') return false;
  return null;
}

function values(rows, tableAndColumns, conflict) {
  if (rows.length === 0) return '';
  const statements = [];
  for (let index = 0; index < rows.length; index += 40) {
    statements.push(
      `INSERT INTO ${tableAndColumns}\nVALUES\n${rows
        .slice(index, index + 40)
        .map((row) => `  (${row.map(sqlValue).join(', ')})`)
        .join(',\n')}\n${conflict};`,
    );
  }
  return statements.join('\n\n');
}

function resolveTypes(typeEntries, dex, metadataForm, fallback) {
  const entries = typeEntries.filter((entry) => entry.pokemon_id === dex);
  const requested = metadataForm
    ? entries.find((entry) => normalize(entry.form) === normalize(metadataForm))
    : null;
  const entry =
    requested ??
    entries.find((candidate) => candidate.form === 'Normal') ??
    (entries.length > 0 &&
    entries.every((candidate) => candidate.type.join('|') === entries[0].type.join('|'))
      ? entries[0]
      : null);
  const resolved = entry?.type?.map((type) => type.toLocaleLowerCase('en-US'));
  return resolved?.length ? resolved : fallback;
}

function rulesFor(form) {
  if (!form.isDefault) {
    return {
      normal:
        form.release.normal === true
          ? 'released'
          : form.release.normal === false
            ? 'unreleased'
            : 'unknown',
      shiny:
        form.release.shiny === true
          ? 'released'
          : form.release.shiny === false
            ? 'unreleased'
            : 'unknown',
      lucky: 'ineligible',
      hundo: 'ineligible',
      xxl: 'ineligible',
      xxs: 'ineligible',
      shadow: 'ineligible',
      purified: 'ineligible',
    };
  }

  const unreleased = form.release.normal !== true;
  return {
    normal: unreleased ? 'unreleased' : 'released',
    shiny: unreleased ? 'unreleased' : form.release.shiny ? 'released' : 'unreleased',
    lucky: !form.tradeable ? 'ineligible' : unreleased ? 'unreleased' : 'released',
    hundo: unreleased ? 'unreleased' : 'released',
    xxl: unreleased ? 'unreleased' : 'released',
    xxs: unreleased ? 'unreleased' : 'released',
    shadow: unreleased ? 'unreleased' : form.release.shadow ? 'released' : 'ineligible',
    purified: unreleased ? 'unreleased' : form.release.purified ? 'released' : 'ineligible',
  };
}

function makeDefaultAssets(dex, isReleased, releasedShiny, assetOverride, filenames) {
  const normalPath = assetOverride?.normalAsset ?? `pm${dex}.icon.png`;
  if (!filenames.has(normalPath)) {
    if (!isReleased) return {};
    throw new Error(
      `No exact representative sprite for #${dex}. Add a reviewed defaultFormAssets override.`,
    );
  }
  const assets = { normal: { upstreamPath: normalPath } };
  if (releasedShiny) {
    const shinyPath =
      assetOverride?.shinyAsset ?? normalPath.replace(/\.icon\.png$/, '.s.icon.png');
    if (!filenames.has(shinyPath)) {
      throw new Error(`Released Shiny #${dex} is missing exact paired sprite ${shinyPath}.`);
    }
    assets.shiny = { upstreamPath: shinyPath };
  }
  return assets;
}

function makeSourceInputs(overrides, apiInputs, apiHashes, assetTreeHash, overridesHash) {
  const inputs = [];
  for (const input of API_INPUTS) {
    const filename = `${input}.json`;
    inputs.push({
      key: `pogoapi-${input.replaceAll('_', '-')}`,
      kind: 'secondary',
      url: `${API_BASE}/${filename}`,
      sha256: apiInputs[input].sha256,
      effectiveAt: overrides.releaseMetadataAsOf,
      note: `Raw response hash; PoGoAPI published hash ${apiHashes[filename].hash_sha256}.`,
    });
  }
  inputs.push({
    key: 'pokeminers-asset-tree',
    kind: 'asset',
    url: `https://github.com/PokeMiners/pogo_assets/tree/${overrides.assetCommit}/Images/Pokemon%20-%20256x256/Addressable%20Assets`,
    sha256: assetTreeHash,
    effectiveAt: overrides.releaseMetadataAsOf,
    note: 'Hash covers the sorted, newline-delimited filenames in the pinned asset directory.',
  });
  inputs.push({
    key: 'catchgrid-reviewed-overrides',
    kind: 'manual',
    url: 'catalog/catalog-overrides.v1.json',
    sha256: overridesHash,
    effectiveAt: overrides.releaseMetadataAsOf,
    note: 'Hash covers the complete versioned manual override file.',
  });
  for (const [sourceId, source] of Object.entries(overrides.sources)) {
    const record = JSON.stringify({ sourceId, ...source });
    inputs.push({
      key: `review-record-${sourceId}`,
      kind: source.kind,
      url: source.url,
      sha256: sha256(record),
      effectiveAt: source.effectiveAt,
      note: `${source.note} Hash covers this local review record, not mutable remote page bytes.`,
    });
  }
  return inputs;
}

function buildSql(manifest, migrationPath) {
  const versionId = `catalog-${manifest.catalogVersion.replaceAll('.', '-').replaceAll('_', '-')}`;
  const upstream = `PokeMiners/pogo_assets@${manifest.source.commit}; PoGoAPI snapshot ${manifest.releaseMetadataAsOf}; reviewed overrides ${manifest.source.overridesSha256}`;
  const manifestJson = JSON.stringify(manifest);
  const manifestHash = sha256(manifestJson);
  const spriteRows = manifest.forms.map((form) => [
    `sprite-${form.formId}`,
    form.assets.normal ? manifest.source.rawBaseUrl + form.assets.normal.upstreamPath : '',
    form.assets.shiny ? manifest.source.rawBaseUrl + form.assets.shiny.upstreamPath : null,
    upstream,
    manifest.catalogVersion,
  ]);
  const defaults = manifest.forms.filter((form) => form.isDefault);
  const speciesRows = defaults.map((form) => [
    form.speciesId,
    form.dex,
    form.dex === 29 ? 'nidoran-female' : form.dex === 32 ? 'nidoran-male' : slug(form.name),
    form.name,
    form.normalizedName,
    form.generation,
    form.region.toLocaleLowerCase('en-US'),
    versionId,
  ]);
  const speciesTypeRows = defaults.flatMap((form) =>
    form.types.map((type) => [form.speciesId, type]),
  );
  const formRows = manifest.forms.map((form) => [
    form.formId,
    form.speciesId,
    form.formKey,
    form.formName ?? form.name,
    normalize(form.formName ?? form.name),
    LEGACY_VARIANT_KIND[form.variantKind],
    form.variantKind === 'costume' ? form.formKey : null,
    form.genderCode ?? null,
    form.isDefault ? 1 : 0,
    form.isReleased ? 1 : 0,
    form.tradeable ? 1 : 0,
    `sprite-${form.formId}`,
    versionId,
    form.retiredAt ?? null,
    form.variantKind,
    form.collectorGroupId,
    form.regionalOrigin ?? null,
    form.costumeFamily ?? null,
    form.transformationGroup ?? null,
    form.formSortOrder,
    form.searchExact ? 1 : 0,
  ]);
  const formTypeRows = manifest.forms
    .filter((form) => !form.isDefault)
    .flatMap((form) => form.types.map((type) => [form.formId, type]));
  const aliasRows = manifest.forms.flatMap((form) => {
    const aliases = new Set([form.normalizedName, normalize(form.formName ?? form.name)]);
    return [...aliases].map((alias) => [form.formId, alias]);
  });
  const ruleRows = manifest.forms.flatMap((form) =>
    CATEGORY_KEYS.map((key) => [
      form.formId,
      key,
      form.rules[key],
      `Catalog ${manifest.catalogVersion}; sources: ${form.sourceIds.join(', ')}`,
      `${manifest.releaseMetadataAsOf}T00:00:00.000Z`,
    ]),
  );
  const sourceRows = manifest.sourceInputs.map((source) => [
    versionId,
    source.key,
    source.kind,
    source.url,
    source.sha256,
    source.effectiveAt,
    source.note,
  ]);

  return `PRAGMA foreign_keys = ON;\n\n-- Generated by scripts/sync-catalog.mjs into ${migrationPath}.\n-- Additive upserts retain stable form IDs and never delete user collection rows.\nINSERT INTO catalog_versions (id, version, upstream_ref, source_hash, imported_at)\nVALUES (${sqlQuote(versionId)}, ${sqlQuote(manifest.catalogVersion)}, ${sqlQuote(upstream)}, ${sqlQuote(manifestHash)}, ${sqlQuote(`${manifest.releaseMetadataAsOf}T00:00:00.000Z`)});\n\n${values(spriteRows, 'sprite_assets (id, normal_path, shiny_path, upstream_ref, manifest_version)', 'ON CONFLICT(id) DO UPDATE SET normal_path=excluded.normal_path, shiny_path=excluded.shiny_path, upstream_ref=excluded.upstream_ref, manifest_version=excluded.manifest_version')}\n\n${values(speciesRows, 'pokemon_species (id, dex_number, slug, display_name, normalized_name, generation, region_code, catalog_version_id)', 'ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name, normalized_name=excluded.normalized_name, generation=excluded.generation, region_code=excluded.region_code, catalog_version_id=excluded.catalog_version_id')}\n\n${values(speciesTypeRows, 'pokemon_types (species_id, type)', 'ON CONFLICT(species_id, type) DO NOTHING')}\n\n${values(formRows, 'pokemon_forms (id, species_id, form_key, display_name, normalized_name, variant_kind, costume_key, gender_code, is_default, is_released, is_tradeable, sprite_asset_id, catalog_version_id, retired_at, collector_kind, collector_group_id, regional_origin, costume_family, transformation_group, form_sort_order, search_exact)', 'ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name, normalized_name=excluded.normalized_name, variant_kind=excluded.variant_kind, costume_key=excluded.costume_key, gender_code=excluded.gender_code, is_released=excluded.is_released, is_tradeable=excluded.is_tradeable, sprite_asset_id=excluded.sprite_asset_id, catalog_version_id=excluded.catalog_version_id, retired_at=excluded.retired_at, collector_kind=excluded.collector_kind, collector_group_id=excluded.collector_group_id, regional_origin=excluded.regional_origin, costume_family=excluded.costume_family, transformation_group=excluded.transformation_group, form_sort_order=excluded.form_sort_order, search_exact=excluded.search_exact')}\n\n${values(formTypeRows, 'pokemon_form_types (form_id, type)', 'ON CONFLICT(form_id, type) DO NOTHING')}\n\n${values(aliasRows, 'form_aliases (form_id, normalized_alias)', 'ON CONFLICT(form_id, normalized_alias) DO NOTHING')}\n\n${values(ruleRows, 'form_category_rules (form_id, category_id, state, source_note, updated_at)', 'ON CONFLICT(form_id, category_id) DO UPDATE SET state=excluded.state, source_note=excluded.source_note, updated_at=excluded.updated_at')}\n\n${values(sourceRows, 'catalog_source_inputs (catalog_version_id, source_key, source_kind, source_url, sha256, effective_at, reviewer_note)', 'ON CONFLICT(catalog_version_id, source_key) DO UPDATE SET source_kind=excluded.source_kind, source_url=excluded.source_url, sha256=excluded.sha256, effective_at=excluded.effective_at, reviewer_note=excluded.reviewer_note')}\n`;
}

function buildReport(manifest, overrides) {
  const defaultForms = manifest.forms.filter((form) => form.isDefault);
  const alternateForms = manifest.forms.filter((form) => !form.isDefault);
  const byKind = Object.groupBy(alternateForms, (form) => form.variantKind);
  const kindLines = Object.entries(byKind)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([kind, forms]) => `- ${kind}: ${forms.length}`)
    .join('\n');
  return `# Catalog change report — ${manifest.catalogVersion}\n\nGenerated from the versioned CatchGrid override file, hash-pinned PoGoAPI snapshots, and an exact commit-pinned PokeMiners filename tree. Sprite presence is treated only as asset evidence; release states come from metadata or an explicit reviewed source record.\n\n## Coverage\n\n- National Dex placeholders: ${defaultForms.length} (contiguous #0001–#${manifest.nationalDex.max})\n- Released representative species: ${defaultForms.filter((form) => form.isReleased).length}\n- Reviewed collector forms: ${alternateForms.length}\n- All default IDs remain \`form-NNNN-standard\`; form IDs use \`form-NNNN-kebab-key\`.\n\n${kindLines}\n\n## Explicit current-release decisions\n\n- Nickit Community Day is scheduled for August 16, 2026, so Nickit remains non-Shiny in this August 13 snapshot.\n- The reviewed 2026 release delta contains ${overrides.reviewedRecentReleases.length} species not yet present in the pinned PoGoAPI released feed.\n- Mega, Primal, Gigantamax, fusion, regional, gender, Rotom, Unown, and selected costume families are separate collector forms and do not inflate National Dex species progress.\n- Collector forms expose only Normal and Shiny tracking; Lucky, Hundo, XXL, XXS, Shadow, and Purified are ineligible on those form rows.\n\n## Provenance\n\n${manifest.sourceInputs.map((source) => `- **${source.key}** (${source.kind}, ${source.effectiveAt}): ${source.url} — SHA-256 \`${source.sha256}\``).join('\n')}\n\n## Known launch blocker\n\nThe PokeMiners sprite repository remains an asset mapping source, not proof of Pokémon GO release status. Its repository does not provide a clear redistribution license for a public production bundle; legal/provenance approval remains an external launch blocker.\n`;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const overridesRaw = await readFile(OVERRIDES_PATH, 'utf8');
  const overrides = JSON.parse(overridesRaw);
  const migrationFilename = options.migration ?? overrides.nextMigration;
  if (!/^\d{4}_[a-z0-9_]+\.sql$/.test(migrationFilename)) {
    throw new Error(`Invalid migration filename: ${migrationFilename}`);
  }
  const migrationPath = resolve(options.outputRoot, 'migrations', migrationFilename);
  const manifestPath = resolve(options.outputRoot, 'catalog', 'catalog.v1.json');
  const reportFilename = `CHANGE_REPORT_${overrides.catalogVersion.slice(0, 10)}.md`;
  const reportPath = resolve(options.outputRoot, 'catalog', reportFilename);
  if (await pathExists(migrationPath)) {
    throw new Error(
      `Migration ${migrationFilename} already exists. Catalog generation is immutable; bump catalogVersion and nextMigration in catalog/catalog-overrides.v1.json.`,
    );
  }

  const previousManifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  const [hashResponse, assetTree, ...feedResponses] = await Promise.all([
    fetchJson(`${API_BASE}/api_hashes.json`, 'PoGoAPI hashes'),
    getAssetTree(overrides.assetCommit),
    ...API_INPUTS.map((input) => fetchJson(`${API_BASE}/${input}.json`, `PoGoAPI ${input}`)),
  ]);
  const apiInputs = Object.fromEntries(
    API_INPUTS.map((input, index) => [input, feedResponses[index]]),
  );
  for (const input of API_INPUTS) {
    const filename = `${input}.json`;
    const expected = overrides.expectedApiHashes[filename];
    const published = hashResponse.data[filename]?.hash_sha256;
    if (!expected || published !== expected) {
      throw new Error(
        `${filename} changed (expected ${expected ?? 'missing'}, published ${published ?? 'missing'}). Review the diff and update the versioned overrides before generating a migration.`,
      );
    }
    if (apiInputs[input].sha256 !== published) {
      throw new Error(
        `${filename} raw SHA-256 ${apiInputs[input].sha256} does not match PoGoAPI's published ${published}.`,
      );
    }
  }

  const released = apiInputs.released_pokemon.data;
  const shiny = apiInputs.shiny_pokemon.data;
  const shadow = apiInputs.shadow_pokemon.data;
  const rarity = apiInputs.pokemon_rarity.data;
  const typeEntries = apiInputs.pokemon_types.data;
  const names = new Map(
    Object.values(apiInputs.pokemon_names.data).map((entry) => [
      entry.id ?? entry.pokemon_id,
      entry.name,
    ]),
  );
  const releasedDex = new Set(Object.values(released).map((entry) => entry.id));
  for (const release of overrides.reviewedRecentReleases) releasedDex.add(release.dex);
  const reviewedNames = new Map(
    overrides.reviewedRecentReleases.map((entry) => [entry.dex, entry.name]),
  );
  const defaultReleaseOverrides = new Map(
    overrides.defaultReleaseOverrides.map((entry) => [entry.dex, entry]),
  );
  const mythicalDex = new Set((rarity.Mythic ?? []).map((entry) => entry.pokemon_id));
  const regionOverrides = new Map(
    Object.entries(overrides.regionOverrides).map(([dex, region]) => [Number(dex), region]),
  );
  const defaultAssets = new Map(overrides.defaultFormAssets.map((entry) => [entry.dex, entry]));
  const defaultTypes = new Map();
  for (let dex = 1; dex <= overrides.nationalDexMax; dex += 1) {
    const assetOverride = defaultAssets.get(dex);
    const types =
      assetOverride?.types ?? resolveTypes(typeEntries, dex, assetOverride?.metadataForm, null);
    if (!types?.length) throw new Error(`Missing representative type metadata for #${dex}.`);
    defaultTypes.set(dex, types);
  }

  const defaultForms = [];
  for (let dex = 1; dex <= overrides.nationalDexMax; dex += 1) {
    const releasedEntry = released[dex] ?? released[String(dex)];
    const name = names.get(dex) ?? releasedEntry?.name ?? reviewedNames.get(dex);
    if (!name) throw new Error(`Missing National Dex name for #${dex}.`);
    const isReleased = releasedDex.has(dex);
    const releaseOverride = defaultReleaseOverrides.get(dex);
    const isShiny =
      isReleased &&
      (releaseOverride?.shinyState === 'released' || Boolean(shiny[dex] ?? shiny[String(dex)]));
    const isShadow = isReleased && Boolean(shadow[dex] ?? shadow[String(dex)]);
    const tradeable = !mythicalDex.has(dex) || TRADEABLE_MYTHICAL_EXCEPTIONS.has(dex);
    const form = {
      speciesId: `species-${id4(dex)}`,
      formId: `form-${id4(dex)}-standard`,
      formKey: 'standard',
      dex,
      name,
      normalizedName: normalize(name),
      generation: generation(dex),
      region: regionOverrides.get(dex) ?? defaultRegion(dex),
      types: defaultTypes.get(dex),
      isDefault: true,
      variantKind: 'standard',
      collectorGroupId: `species-${id4(dex)}`,
      isReleased,
      formSortOrder: 0,
      searchExact: true,
      release: {
        normal: isReleased,
        shiny: isShiny,
        shadow: isShadow,
        purified: isShadow,
      },
      tradeable,
      assets: makeDefaultAssets(
        dex,
        isReleased,
        isShiny,
        releaseOverride?.shinyAsset
          ? { ...defaultAssets.get(dex), shinyAsset: releaseOverride.shinyAsset }
          : defaultAssets.get(dex),
        assetTree.filenames,
      ),
      sourceIds: [
        'pogoapi-released-pokemon',
        ...(reviewedNames.has(dex)
          ? overrides.reviewedRecentReleases.find((entry) => entry.dex === dex).sourceIds
          : []),
        ...(releaseOverride?.sourceIds ?? []),
      ],
    };
    form.rules = rulesFor(form);
    form.eligibility = Object.fromEntries(
      CATEGORY_KEYS.map((key) => [
        key,
        form.rules[key] === 'released'
          ? true
          : form.rules[key] === 'unreleased' || form.rules[key] === 'ineligible'
            ? false
            : null,
      ]),
    );
    defaultForms.push(form);
  }

  const collectorForms = [];
  for (const group of overrides.formGroups) {
    for (const [memberIndex, member] of group.members.entries()) {
      const base = defaultForms[member.dex - 1];
      if (!base) throw new Error(`${group.id}/${member.formKey} has invalid dex #${member.dex}.`);
      if (!assetTree.filenames.has(member.normalAsset)) {
        throw new Error(
          `${group.id}/${member.formKey} missing exact sprite ${member.normalAsset}.`,
        );
      }
      const releaseState = member.releaseState ?? group.releaseState;
      const shinyState = member.shinyState ?? group.shinyState;
      if (shinyState === 'released' && !member.shinyAsset) {
        throw new Error(`${group.id}/${member.formKey} is released Shiny but has no exact asset.`);
      }
      if (member.shinyAsset && !assetTree.filenames.has(member.shinyAsset)) {
        throw new Error(
          `${group.id}/${member.formKey} missing exact Shiny sprite ${member.shinyAsset}.`,
        );
      }
      const form = {
        speciesId: base.speciesId,
        formId: `form-${id4(member.dex)}-${member.formKey}`,
        formKey: member.formKey,
        dex: member.dex,
        name: base.name,
        formName: member.displayName,
        normalizedName: normalize(base.name),
        generation: base.generation,
        region: base.region,
        types:
          member.types ?? resolveTypes(typeEntries, member.dex, member.metadataForm, base.types),
        isDefault: false,
        variantKind: group.variantKind,
        collectorGroupId: group.id,
        isReleased: stateValue(releaseState) === true,
        formSortOrder: group.sortOrder + memberIndex,
        searchExact: member.searchExact ?? false,
        release: {
          normal: stateValue(releaseState),
          shiny: stateValue(shinyState),
          shadow: null,
          purified: null,
        },
        tradeable: member.tradeable ?? group.tradeable,
        assets: {
          normal: { upstreamPath: member.normalAsset },
          ...(member.shinyAsset ? { shiny: { upstreamPath: member.shinyAsset } } : {}),
        },
        sourceIds: member.sourceIds ?? group.sourceIds,
        ...(group.regionalOrigin ? { regionalOrigin: group.regionalOrigin } : {}),
        ...(group.costumeFamily ? { costumeFamily: group.costumeFamily } : {}),
        ...(group.transformationGroup ? { transformationGroup: group.transformationGroup } : {}),
        ...(member.genderCode ? { genderCode: member.genderCode } : {}),
      };
      form.rules = rulesFor(form);
      form.eligibility = Object.fromEntries(
        CATEGORY_KEYS.map((key) => [
          key,
          form.rules[key] === 'released'
            ? true
            : form.rules[key] === 'unreleased' || form.rules[key] === 'ineligible'
              ? false
              : null,
        ]),
      );
      collectorForms.push(form);
    }
  }

  const forms = [...defaultForms, ...collectorForms].sort(
    (left, right) =>
      left.dex - right.dex ||
      Number(right.isDefault) - Number(left.isDefault) ||
      left.formSortOrder - right.formSortOrder ||
      left.formKey.localeCompare(right.formKey),
  );
  const previousIds = new Set(previousManifest.forms.map((form) => form.formId));
  for (const form of forms) {
    if (
      form.isDefault &&
      previousIds.has(`form-${id4(form.dex)}-standard`) &&
      form.formId !== `form-${id4(form.dex)}-standard`
    ) {
      throw new Error(`Stable ID changed for #${form.dex}.`);
    }
  }
  const rawBaseUrl = `https://raw.githubusercontent.com/PokeMiners/pogo_assets/${overrides.assetCommit}/Images/Pokemon%20-%20256x256/Addressable%20Assets/`;
  const sourceInputs = makeSourceInputs(
    overrides,
    apiInputs,
    hashResponse.data,
    assetTree.sha256,
    sha256(overridesRaw),
  );
  const manifest = {
    schemaVersion: 2,
    catalogVersion: overrides.catalogVersion,
    releaseMetadataAsOf: overrides.releaseMetadataAsOf,
    nationalDex: { min: 1, max: overrides.nationalDexMax, includesUnreleased: true },
    source: {
      name: 'CatchGrid reviewed catalog: PokeMiners assets + PoGoAPI metadata + manual release evidence',
      repositoryUrl: 'https://github.com/PokeMiners/pogo_assets',
      commit: overrides.assetCommit,
      assetRoot: 'Images/Pokemon - 256x256/Addressable Assets',
      rawBaseUrl,
      assetTreeSha256: assetTree.sha256,
      overridesSha256: sha256(overridesRaw),
    },
    sourceInputs,
    eligibilityKeys: CATEGORY_KEYS,
    forms,
  };
  const formattedManifest = await format(JSON.stringify(manifest), {
    parser: 'json',
    printWidth: 100,
  });
  const sql = buildSql(manifest, migrationFilename);
  const report = buildReport(manifest, overrides);
  await mkdir(resolve(options.outputRoot, 'catalog'), { recursive: true });
  await mkdir(resolve(options.outputRoot, 'migrations'), { recursive: true });
  await writeFile(manifestPath, formattedManifest);
  await writeFile(migrationPath, sql);
  await writeFile(reportPath, report);
  console.log(
    `Generated immutable ${migrationFilename}: ${defaultForms.length} National Dex representatives, ${collectorForms.length} collector forms, ${defaultForms.filter((form) => form.isReleased).length} released species.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
