#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format } from 'prettier';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const UPDATE_PATH = resolve(ROOT, 'catalog/catchgrid-update.v1.json');
const ARTWORK_PATH = resolve(ROOT, 'catalog/home-artwork-manifest.v1.json');
const CATEGORIES = ['normal', 'shiny', 'lucky', 'hundo', 'xxl', 'xxs', 'shadow', 'purified'];
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

function parseArguments(values) {
  const options = { migration: null, outputRoot: ROOT };
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === '--migration') options.migration = values[++index];
    else if (values[index] === '--output-root') options.outputRoot = resolve(values[++index]);
    else throw new Error(`Unknown option: ${values[index]}`);
  }
  return options;
}

function id4(value) {
  return String(value).padStart(4, '0');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function normalize(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function state(value) {
  return value === 'released' ? true : value === 'unreleased' ? false : null;
}

function rulesFor(form) {
  const released = form.release.normal === true;
  if (!form.isDefault) {
    return {
      normal: released ? 'released' : 'unreleased',
      shiny: released && form.release.shiny === true ? 'released' : 'unreleased',
      lucky: 'ineligible',
      hundo: 'ineligible',
      xxl: 'ineligible',
      xxs: 'ineligible',
      shadow:
        form.variantKind === 'regional' && form.release.shadow === true ? 'released' : 'ineligible',
      purified:
        form.variantKind === 'regional' && form.release.purified === true
          ? 'released'
          : 'ineligible',
    };
  }
  return {
    normal: released ? 'released' : 'unreleased',
    shiny: released && form.release.shiny === true ? 'released' : 'unreleased',
    lucky: !form.tradeable ? 'ineligible' : released ? 'released' : 'unreleased',
    hundo: released ? 'released' : 'unreleased',
    xxl: released ? 'released' : 'unreleased',
    xxs: released ? 'released' : 'unreleased',
    shadow: released && form.release.shadow === true ? 'released' : 'ineligible',
    purified: released && form.release.purified === true ? 'released' : 'ineligible',
  };
}

function sqlQuote(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function values(rows, table, conflict) {
  if (!rows.length) return '';
  const statements = [];
  for (let index = 0; index < rows.length; index += 100) {
    const batch = rows.slice(index, index + 100);
    statements.push(
      `INSERT INTO ${table}\nVALUES\n${batch.map((row) => `  (${row.map(sqlQuote).join(', ')})`).join(',\n')}\n${conflict};`,
    );
  }
  return statements.join('\n\n');
}

function applyRelease(form, normalState, shinyState) {
  if (normalState) form.release.normal = state(normalState);
  if (shinyState) form.release.shiny = state(shinyState);
  form.isReleased = form.release.normal === true;
  form.rules = rulesFor(form);
}

function addSourceIds(form, sourceIds = []) {
  form.sourceIds = [...new Set([...form.sourceIds, ...sourceIds])];
}

function makeAddedForm(base, group, member, index) {
  const normal = state(member.normalState);
  const shiny = state(member.shinyState);
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
    types: member.types ?? base.types,
    isDefault: false,
    variantKind: group.variantKind,
    collectorGroupId: group.id,
    isReleased: normal === true,
    formSortOrder: 700 + index,
    searchExact: member.searchExact ?? false,
    release: { normal, shiny, shadow: false, purified: false },
    tradeable: member.tradeable ?? base.tradeable,
    sourceIds: [...new Set([...(group.sourceIds ?? []), ...(member.sourceIds ?? [])])],
    ...(member.genderCode ? { genderCode: member.genderCode } : {}),
    ...(member.availability ? { availability: member.availability } : {}),
    ...(member.normalArtworkFile || member.shinyArtworkFile
      ? {
          artworkFiles: {
            normal: member.normalArtworkFile,
            shiny: member.shinyArtworkFile,
          },
        }
      : {}),
  };
  form.rules = rulesFor(form);
  form.eligibility = Object.fromEntries(
    CATEGORIES.map((category) => [category, form.rules[category] === 'released']),
  );
  return form;
}

function assignArtwork(forms, artwork) {
  const available = new Set(artwork.assets.map((asset) => asset.file));
  for (const form of forms) {
    const normalFile = form.artworkFiles?.normal ?? `HOME${id4(form.dex)}.png`;
    const shinyFile = form.artworkFiles?.shiny ?? `HOME${id4(form.dex)} s.png`;
    if (!available.has(normalFile)) throw new Error(`Missing pinned HOME artwork ${normalFile}.`);
    if (form.release.shiny === true && !available.has(shinyFile)) {
      throw new Error(`Missing pinned released Shiny HOME artwork ${shinyFile}.`);
    }
    form.assets = {
      normal: {
        upstreamPath: `artwork/pokemon-home/${normalFile}`,
        archivesFile: normalFile,
        ...(form.isDefault ? {} : { fallbackOf: `form-${id4(form.dex)}-standard` }),
      },
      ...(form.release.shiny === true
        ? {
            shiny: {
              upstreamPath: `artwork/pokemon-home/${shinyFile}`,
              archivesFile: shinyFile,
              ...(form.isDefault ? {} : { fallbackOf: `form-${id4(form.dex)}-standard` }),
            },
          }
        : {}),
    };
    form.artworkIsFallback = !form.isDefault && !form.artworkFiles?.normal;
    delete form.artworkFiles;
  }
}

function buildSql(manifest, migrationFilename) {
  const versionId = `catalog-${manifest.catalogVersion.replaceAll('.', '-')}`;
  const upstream = `Local Pokémon HOME artwork manifest ${manifest.source.assetManifestSha256}; reviewed update ${manifest.source.updateSha256}`;
  const spriteRows = manifest.forms.map((form) => [
    `sprite-${form.formId}`,
    `/${form.assets.normal.upstreamPath}`,
    form.assets.shiny ? `/${form.assets.shiny.upstreamPath}` : null,
    upstream,
    manifest.catalogVersion,
    form.artworkIsFallback ? 1 : 0,
  ]);
  const defaults = manifest.forms.filter((form) => form.isDefault);
  const speciesRows = defaults.map((form) => [
    form.speciesId,
    form.dex,
    form.dex === 29
      ? 'nidoran-female'
      : form.dex === 32
        ? 'nidoran-male'
        : normalize(form.name).replaceAll(' ', '-'),
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
    form.availability?.mode ?? 'global',
    JSON.stringify(form.availability?.zones ?? ['global']),
    form.availability?.note ?? null,
  ]);
  const formTypeRows = manifest.forms
    .filter((form) => !form.isDefault)
    .flatMap((form) => form.types.map((type) => [form.formId, type]));
  const aliasRows = manifest.forms.flatMap((form) =>
    [...new Set([form.normalizedName, normalize(form.formName ?? form.name)])].map((alias) => [
      form.formId,
      alias,
    ]),
  );
  const ruleRows = manifest.forms.flatMap((form) =>
    CATEGORIES.map((category) => [
      form.formId,
      category,
      form.rules[category],
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
  return `PRAGMA foreign_keys = ON;\n\n-- Generated by scripts/generate-catchgrid-update.mjs into ${migrationFilename}.\n-- Additive upserts retain every application-owned form ID and collection foreign key.\nALTER TABLE pokemon_forms ADD COLUMN availability_mode TEXT NOT NULL DEFAULT 'global' CHECK (availability_mode IN ('global', 'regional', 'event', 'unknown'));\nALTER TABLE pokemon_forms ADD COLUMN availability_zones_json TEXT NOT NULL DEFAULT '["global"]';\nALTER TABLE pokemon_forms ADD COLUMN availability_note TEXT;\nALTER TABLE sprite_assets ADD COLUMN artwork_is_fallback INTEGER NOT NULL DEFAULT 0 CHECK (artwork_is_fallback IN (0, 1));\n\nINSERT INTO catalog_versions (id, version, upstream_ref, source_hash, imported_at)\nVALUES (${sqlQuote(versionId)}, ${sqlQuote(manifest.catalogVersion)}, ${sqlQuote(upstream)}, ${sqlQuote(sha256(JSON.stringify(manifest)))}, ${sqlQuote(`${manifest.releaseMetadataAsOf}T00:00:00.000Z`)});\n\n${values(spriteRows, 'sprite_assets (id, normal_path, shiny_path, upstream_ref, manifest_version, artwork_is_fallback)', 'ON CONFLICT(id) DO UPDATE SET normal_path=excluded.normal_path, shiny_path=excluded.shiny_path, upstream_ref=excluded.upstream_ref, manifest_version=excluded.manifest_version, artwork_is_fallback=excluded.artwork_is_fallback')}\n\n${values(speciesRows, 'pokemon_species (id, dex_number, slug, display_name, normalized_name, generation, region_code, catalog_version_id)', 'ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name, normalized_name=excluded.normalized_name, generation=excluded.generation, region_code=excluded.region_code, catalog_version_id=excluded.catalog_version_id')}\n\n${values(speciesTypeRows, 'pokemon_types (species_id, type)', 'ON CONFLICT(species_id, type) DO NOTHING')}\n\n${values(formRows, 'pokemon_forms (id, species_id, form_key, display_name, normalized_name, variant_kind, costume_key, gender_code, is_default, is_released, is_tradeable, sprite_asset_id, catalog_version_id, retired_at, collector_kind, collector_group_id, regional_origin, costume_family, transformation_group, form_sort_order, search_exact, availability_mode, availability_zones_json, availability_note)', 'ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name, normalized_name=excluded.normalized_name, variant_kind=excluded.variant_kind, costume_key=excluded.costume_key, gender_code=excluded.gender_code, is_released=excluded.is_released, is_tradeable=excluded.is_tradeable, sprite_asset_id=excluded.sprite_asset_id, catalog_version_id=excluded.catalog_version_id, retired_at=excluded.retired_at, collector_kind=excluded.collector_kind, collector_group_id=excluded.collector_group_id, regional_origin=excluded.regional_origin, costume_family=excluded.costume_family, transformation_group=excluded.transformation_group, form_sort_order=excluded.form_sort_order, search_exact=excluded.search_exact, availability_mode=excluded.availability_mode, availability_zones_json=excluded.availability_zones_json, availability_note=excluded.availability_note')}\n\n${values(formTypeRows, 'pokemon_form_types (form_id, type)', 'ON CONFLICT(form_id, type) DO NOTHING')}\n\n${values(aliasRows, 'form_aliases (form_id, normalized_alias)', 'ON CONFLICT(form_id, normalized_alias) DO NOTHING')}\n\n${values(ruleRows, 'form_category_rules (form_id, category_id, state, source_note, updated_at)', 'ON CONFLICT(form_id, category_id) DO UPDATE SET state=excluded.state, source_note=excluded.source_note, updated_at=excluded.updated_at')}\n\n${values(sourceRows, 'catalog_source_inputs (catalog_version_id, source_key, source_kind, source_url, sha256, effective_at, reviewer_note)', 'ON CONFLICT(catalog_version_id, source_key) DO UPDATE SET source_kind=excluded.source_kind, source_url=excluded.source_url, sha256=excluded.sha256, effective_at=excluded.effective_at, reviewer_note=excluded.reviewer_note')}\n`;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const [updateRaw, artworkRaw] = await Promise.all([
    readFile(UPDATE_PATH, 'utf8'),
    readFile(ARTWORK_PATH, 'utf8'),
  ]);
  const update = JSON.parse(updateRaw);
  const artwork = JSON.parse(artworkRaw);
  const migrationFilename = options.migration ?? update.nextMigration;
  const migrationPath = resolve(options.outputRoot, 'migrations', migrationFilename);
  try {
    await readFile(migrationPath);
    throw new Error(
      `Migration ${migrationFilename} already exists. Catalog generation is immutable; bump the reviewed update version first.`,
    );
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  const baseRaw = await readFile(resolve(ROOT, update.baseCatalog), 'utf8');
  const base = JSON.parse(baseRaw);
  const forms = structuredClone(base.forms);
  const defaultByDex = new Map(
    forms.filter((form) => form.isDefault).map((form) => [form.dex, form]),
  );
  const byId = new Map(forms.map((form) => [form.formId, form]));

  for (const patch of update.defaultPatches) {
    const form = defaultByDex.get(patch.dex);
    if (!form) throw new Error(`Default patch #${patch.dex} is missing.`);
    if (patch.formName) form.formName = patch.formName;
    if (patch.availability) form.availability = patch.availability;
    if (patch.normalArtworkFile || patch.shinyArtworkFile) {
      form.artworkFiles = {
        normal: patch.normalArtworkFile,
        shiny: patch.shinyArtworkFile,
      };
    }
    applyRelease(form, patch.normalState, patch.shinyState);
    addSourceIds(form, patch.sourceIds);
  }
  for (const patch of update.shinyReleasePatches) {
    for (const dex of patch.dexes) {
      const form = defaultByDex.get(dex);
      if (!form) throw new Error(`Shiny patch #${dex} is missing.`);
      applyRelease(form, null, 'released');
      addSourceIds(form, patch.sourceIds);
    }
  }
  for (const patch of update.formPatches) {
    const form = byId.get(patch.formId);
    if (!form) throw new Error(`Form patch ${patch.formId} is missing.`);
    applyRelease(form, patch.normalState, patch.shinyState);
    Object.assign(form.rules, patch.ruleOverrides ?? {});
    addSourceIds(form, patch.sourceIds);
  }
  let additionIndex = 0;
  for (const group of update.groups) {
    for (const member of group.members) {
      const id = `form-${id4(member.dex)}-${member.formKey}`;
      if (byId.has(id)) continue;
      const form = makeAddedForm(defaultByDex.get(member.dex), group, member, additionIndex++);
      forms.push(form);
      byId.set(id, form);
    }
  }
  for (const form of forms) {
    form.normalizedName = normalize(form.name);
    form.availability ??= { mode: 'global', zones: ['global'] };
    form.eligibility = Object.fromEntries(
      CATEGORIES.map((category) => [category, form.rules[category] === 'released']),
    );
  }
  assignArtwork(forms, artwork);
  forms.sort(
    (left, right) =>
      left.dex - right.dex ||
      Number(right.isDefault) - Number(left.isDefault) ||
      left.formSortOrder - right.formSortOrder ||
      left.formKey.localeCompare(right.formKey),
  );

  const baseInputs = base.sourceInputs.filter(
    (source) => !source.key.toLocaleLowerCase('en-US').includes('pokeminers'),
  );
  const sourceInputs = [
    ...baseInputs,
    {
      key: 'catchgrid-base-catalog-2026-08-19',
      kind: 'manual',
      url: update.baseCatalog,
      sha256: sha256(baseRaw),
      effectiveAt: '2026-08-19',
      note: 'Immutable pre-update catalog snapshot retained to prove stable IDs and availability deltas.',
    },
    {
      key: 'bulbagarden-home-artwork-manifest',
      kind: 'asset',
      url: 'catalog/home-artwork-manifest.v1.json',
      sha256: sha256(artworkRaw),
      effectiveAt: update.releaseMetadataAsOf,
      note: `${artwork.totalFiles} locally stored thumbnails; ${artwork.totalBytes} bytes; per-file source pages and hashes are in the manifest.`,
    },
    ...Object.entries(update.sources).map(([key, source]) => ({
      key: `review-record-${key}`,
      ...source,
      sha256: sha256(JSON.stringify({ key, ...source })),
    })),
  ];
  const manifest = {
    ...base,
    catalogVersion: update.catalogVersion,
    releaseMetadataAsOf: update.releaseMetadataAsOf,
    source: {
      name: 'CatchGrid reviewed catalog with repository-local Pokémon HOME artwork',
      repositoryUrl: 'https://archives.bulbagarden.net/wiki/Category:HOME_artwork',
      assetRoot: 'public/artwork/pokemon-home',
      runtimeBaseUrl: '/',
      assetManifestSha256: sha256(artworkRaw),
      updateSha256: sha256(updateRaw),
      rightsNotice: artwork.rightsNotice,
      hotlinking: false,
    },
    sourceInputs,
    forms,
  };
  const report = `# CatchGrid catalog, forms, regions, and artwork update — ${manifest.catalogVersion}\n\n## Outcome\n\n- Stable default IDs retained: ${forms.filter((form) => form.isDefault).length}\n- Collector forms: ${forms.filter((form) => !form.isDefault).length}\n- Regional availability records: ${forms.filter((form) => form.availability?.mode === 'regional').length}\n- Repository-local HOME thumbnails: ${artwork.totalFiles} (${(artwork.totalBytes / 1_048_576).toFixed(1)} MiB)\n- Runtime hotlinks: 0\n\n## Artwork policy\n\nPokémon HOME artwork is downloaded at build time from Bulbagarden Archives and pinned in \`catalog/home-artwork-manifest.v1.json\` with source file pages, timestamps, Archives SHA-1 values, local SHA-256 values, and byte sizes. Bulbagarden Archives does not grant blanket unrestricted rights to this material, so the Archives copyright/fair-use notice remains in product notices. Alternate and event forms without HOME-specific art explicitly use representative species artwork; Pokémon GO event costumes cannot transfer to HOME.\n\n## Costume inventory audit\n\nThe Bulbapedia Event Pokémon (GO) page is a useful secondary inventory and availability chronology, but it is not an official release source and its page currently includes entries dated after this catalog cutoff. CatchGrid retains every existing costume ID. Its ${forms.filter((form) => form.variantKind === 'costume').length} reviewed costume records use explicit representative-art fallbacks. Full page coverage remains a documented gap pending row-by-row official release corroboration and a suitable locally reusable event-art source; inventory presence alone does not create collection rows.\n\n## Corrected reports\n\n- Gossifleur and Eldegoss remain Shiny-unreleased; the submitted Shiny report was not corroborated.\n- Arrokuda and Barraskewda are released from August 18, 2026; their Shinies remain unreleased.\n- Hisuian Sliggoo and Hisuian Goodra remain unreleased because no independent Pokémon GO release evidence was found.\n- Bloodmoon Ursaluna is tracked separately as unreleased; standard Ursaluna remains Shiny-released.\n\n## Provenance\n\n${sourceInputs.map((source) => `- **${source.key}** (${source.kind}, ${source.effectiveAt}): ${source.url} — SHA-256 \`${source.sha256}\``).join('\n')}\n`;

  await mkdir(resolve(options.outputRoot, 'catalog'), { recursive: true });
  await mkdir(resolve(options.outputRoot, 'migrations'), { recursive: true });
  await writeFile(
    resolve(options.outputRoot, 'catalog/catalog.v1.json'),
    await format(JSON.stringify(manifest), { parser: 'json', printWidth: 100 }),
  );
  await writeFile(migrationPath, buildSql(manifest, migrationFilename));
  await writeFile(
    resolve(options.outputRoot, `catalog/CHANGE_REPORT_${update.catalogVersion.slice(0, 10)}.md`),
    report,
  );
  console.log(
    `Generated ${manifest.catalogVersion}: ${forms.length} forms with stable default IDs.`,
  );
}

await main();
