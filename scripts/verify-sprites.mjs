#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const rootDirectory = resolve(scriptDirectory, '..');
const defaultManifestPath = resolve(rootDirectory, 'catalog', 'catalog.v1.json');
const medalsPath = resolve(rootDirectory, 'catalog', 'region-medals.v1.json');
const allowedTypes = new Set([
  'bug',
  'dark',
  'dragon',
  'electric',
  'fairy',
  'fighting',
  'fire',
  'flying',
  'ghost',
  'grass',
  'ground',
  'ice',
  'normal',
  'poison',
  'psychic',
  'rock',
  'steel',
  'water',
]);
const allowedVariants = new Set([
  'standard',
  'regional',
  'costume',
  'gender',
  'alternate',
  'mega',
  'primal',
  'gigantamax',
  'fusion',
  'other',
]);
const categories = ['normal', 'shiny', 'lucky', 'hundo', 'xxl', 'xxs', 'shadow', 'purified'];
const ruleStates = new Set(['released', 'unreleased', 'ineligible', 'unknown']);

function usage() {
  console.log(`Usage: node scripts/verify-sprites.mjs [options]

Options:
  --network          Send an HTTP HEAD request for every unique sprite URL
  --manifest <path>  Validate a different manifest (defaults to catalog/catalog.v1.json)
  --help             Show this help`);
}

function parseArguments(arguments_) {
  const options = { manifestPath: defaultManifestPath, network: false };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--network') {
      options.network = true;
    } else if (argument === '--manifest') {
      const value = arguments_[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--manifest requires a file path.');
      options.manifestPath = resolve(process.cwd(), value);
      index += 1;
    } else if (argument === '--help' || argument === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }
  return options;
}

function normalizeName(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function safeAssetPath(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    !value.startsWith('/') &&
    !value.startsWith('\\') &&
    !value.includes('..') &&
    !value.includes('\\') &&
    !/^[a-z][a-z\d+.-]*:/i.test(value) &&
    value.endsWith('.png')
  );
}

function validUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function validateManifest(manifest, medals) {
  const errors = [];
  const add = (message) => errors.push(message);
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return ['Manifest root must be an object.'];
  }
  if (manifest.schemaVersion !== 2) add('schemaVersion must equal 2.');
  if (!/^\d{4}-\d{2}-\d{2}\.\d+$/.test(manifest.catalogVersion ?? '')) {
    add('catalogVersion must be a date plus revision (YYYY-MM-DD.N).');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(manifest.releaseMetadataAsOf ?? '')) {
    add('releaseMetadataAsOf must use YYYY-MM-DD.');
  }
  if (manifest.nationalDex?.min !== 1 || manifest.nationalDex?.max !== 1025) {
    add('nationalDex must cover #1 through #1025.');
  }
  if (manifest.nationalDex?.includesUnreleased !== true) {
    add('nationalDex.includesUnreleased must be true.');
  }
  if (!/^[a-f\d]{40}$/.test(manifest.source?.commit ?? '')) {
    add('source.commit must be a pinned 40-character lowercase SHA.');
  }
  if (!/^[a-f\d]{64}$/.test(manifest.source?.assetTreeSha256 ?? '')) {
    add('source.assetTreeSha256 must be SHA-256.');
  }
  if (!/^[a-f\d]{64}$/.test(manifest.source?.overridesSha256 ?? '')) {
    add('source.overridesSha256 must be SHA-256.');
  }
  if (!validUrl(manifest.source?.rawBaseUrl)) add('source.rawBaseUrl must use HTTPS.');
  if (!manifest.source?.rawBaseUrl?.includes(`/${manifest.source?.commit}/`)) {
    add('source.rawBaseUrl must contain the pinned asset commit.');
  }
  if (!Array.isArray(manifest.sourceInputs) || manifest.sourceInputs.length < 10) {
    add('sourceInputs must include hash-addressed API, asset, and manual inputs.');
  } else {
    const sourceKeys = new Set();
    const kinds = new Set();
    for (const [index, source] of manifest.sourceInputs.entries()) {
      if (sourceKeys.has(source.key)) add(`sourceInputs[${index}] duplicates ${source.key}.`);
      sourceKeys.add(source.key);
      kinds.add(source.kind);
      if (!['official', 'secondary', 'asset', 'manual'].includes(source.kind)) {
        add(`sourceInputs[${index}].kind is invalid.`);
      }
      if (!/^[a-f\d]{64}$/.test(source.sha256 ?? '')) {
        add(`sourceInputs[${index}].sha256 must be SHA-256.`);
      }
      if (source.url !== 'catalog/catalog-overrides.v1.json' && !validUrl(source.url)) {
        add(`sourceInputs[${index}].url must be HTTPS or the versioned local overrides path.`);
      }
    }
    for (const kind of ['official', 'secondary', 'asset', 'manual']) {
      if (!kinds.has(kind)) add(`sourceInputs is missing kind ${kind}.`);
    }
  }
  if (JSON.stringify(manifest.eligibilityKeys) !== JSON.stringify(categories)) {
    add('eligibilityKeys must equal the canonical category order.');
  }
  if (!Array.isArray(manifest.forms) || manifest.forms.length < 1025) {
    add('forms must include the complete National Dex plus reviewed forms.');
    return errors;
  }

  const ids = new Set();
  const dexFormKeys = new Set();
  const defaultsByDex = new Map();
  const formById = new Map();
  for (const [index, form] of manifest.forms.entries()) {
    const at = `forms[${index}]`;
    if (!Number.isInteger(form.dex) || form.dex < 1 || form.dex > 1025) add(`${at}.dex invalid.`);
    const padded = String(form.dex).padStart(4, '0');
    if (form.speciesId !== `species-${padded}`) add(`${at}.speciesId is not stable for its dex.`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.formKey ?? '')) {
      add(`${at}.formKey must be kebab-case.`);
    }
    if (form.formId !== `form-${padded}-${form.formKey}`) add(`${at}.formId is not stable.`);
    if (ids.has(form.formId)) add(`${at}.formId duplicates ${form.formId}.`);
    ids.add(form.formId);
    formById.set(form.formId, form);
    const dexForm = `${form.dex}:${form.formKey}`;
    if (dexFormKeys.has(dexForm)) add(`${at} duplicates ${dexForm}.`);
    dexFormKeys.add(dexForm);
    if (form.normalizedName !== normalizeName(form.name)) add(`${at}.normalizedName is incorrect.`);
    if (!allowedVariants.has(form.variantKind)) add(`${at}.variantKind is invalid.`);
    if (typeof form.collectorGroupId !== 'string' || !form.collectorGroupId) {
      add(`${at}.collectorGroupId must be stable and non-empty.`);
    }
    if (typeof form.isDefault !== 'boolean') add(`${at}.isDefault must be boolean.`);
    if (typeof form.isReleased !== 'boolean') add(`${at}.isReleased must be boolean.`);
    if (typeof form.tradeable !== 'boolean') add(`${at}.tradeable must be boolean.`);
    if (!Number.isInteger(form.formSortOrder)) add(`${at}.formSortOrder must be an integer.`);
    if (typeof form.searchExact !== 'boolean') add(`${at}.searchExact must be boolean.`);
    if (!Array.isArray(form.types) || form.types.length < 1 || form.types.length > 2) {
      add(`${at}.types must contain one or two types.`);
    } else {
      for (const type of form.types)
        if (!allowedTypes.has(type)) add(`${at} has invalid type ${type}.`);
    }
    if (!form.rules || typeof form.rules !== 'object') {
      add(`${at}.rules must be an object.`);
    } else {
      for (const category of categories) {
        if (!ruleStates.has(form.rules[category])) add(`${at}.rules.${category} is invalid.`);
      }
    }
    if (!form.release || typeof form.release !== 'object') add(`${at}.release must be an object.`);
    if (form.isReleased !== (form.release?.normal === true)) {
      add(`${at}.isReleased must match release.normal.`);
    }
    if (form.assets?.normal && !safeAssetPath(form.assets.normal.upstreamPath)) {
      add(`${at}.assets.normal is unsafe.`);
    }
    if (form.assets?.shiny && !safeAssetPath(form.assets.shiny.upstreamPath)) {
      add(`${at}.assets.shiny is unsafe.`);
    }
    if (form.release?.normal === true && !form.assets?.normal)
      add(`${at} released form needs a sprite.`);
    if (form.release?.shiny === true && !form.assets?.shiny)
      add(`${at} released Shiny needs a sprite.`);

    if (form.isDefault) {
      if (form.formKey !== 'standard' || form.variantKind !== 'standard') {
        add(`${at} default must use standard key/kind.`);
      }
      if (form.collectorGroupId !== form.speciesId)
        add(`${at} default group must equal speciesId.`);
      if (defaultsByDex.has(form.dex)) add(`${at} is a second default for #${form.dex}.`);
      defaultsByDex.set(form.dex, form);
    } else {
      for (const category of ['lucky', 'hundo', 'xxl', 'xxs']) {
        if (form.rules?.[category] !== 'ineligible') {
          add(`${at} collector form ${category} must be ineligible.`);
        }
      }
      if (form.variantKind !== 'regional') {
        for (const category of ['shadow', 'purified']) {
          if (form.rules?.[category] !== 'ineligible') {
            add(`${at} non-regional collector form ${category} must be ineligible.`);
          }
        }
      } else if (
        form.rules?.shadow === 'released' &&
        !form.sourceIds?.includes('historical-shadow-database')
      ) {
        add(`${at} regional Shadow form lacks form-specific historical evidence.`);
      }
    }
  }

  for (let dex = 1; dex <= 1025; dex += 1) {
    const form = defaultsByDex.get(dex);
    if (!form) add(`National Dex #${dex} has no default representative.`);
    else if (form.formId !== `form-${String(dex).padStart(4, '0')}-standard`) {
      add(`National Dex #${dex} default ID changed.`);
    }
  }
  const unown = manifest.forms.filter((form) => form.collectorGroupId === 'unown');
  if (unown.length !== 28) add(`Unown group must have 28 forms, found ${unown.length}.`);
  const requiredForms = [
    'form-0038-alola',
    'form-0678-female',
    'form-0479-heat',
    'form-0006-mega-x',
    'form-0026-mega-x',
    'form-0026-mega-y',
    'form-0382-primal',
    'form-0812-gigantamax',
    'form-0646-black',
    'form-0025-party-hat-2017',
  ];
  for (const id of requiredForms)
    if (!formById.has(id)) add(`Required reviewed form ${id} missing.`);
  const nickit = formById.get('form-0827-standard');
  if (nickit?.release.shiny !== true || nickit?.rules.shiny !== 'released') {
    add('Nickit must be Shiny after its August 16, 2026 Community Day debut.');
  }

  if (medals?.schemaVersion !== 2) add('Region medals schemaVersion must equal 2.');
  if (medals?.nationalDexMax !== 1025) add('Region medals must target National Dex #1025.');
  if (JSON.stringify(medals?.categoryIds) !== JSON.stringify(categories)) {
    add('Region medals categoryIds must equal the canonical category order.');
  }
  for (const region of medals?.regions ?? []) {
    const count = [...defaultsByDex.values()].filter((form) => form.region === region.label).length;
    if (count !== region.thresholds.platinum) {
      add(
        `Region medal ${region.label} platinum=${region.thresholds.platinum}, but catalog has ${count} defaults.`,
      );
    }
    const { bronze, silver, gold, platinum } = region.thresholds;
    if (!(bronze <= silver && silver <= gold && gold <= platinum)) {
      add(`Region medal ${region.label} thresholds are not monotonic.`);
    }
    for (const category of categories) {
      const categoryThresholds = region.categoryThresholds?.[category];
      if (!categoryThresholds) {
        add(`Region medal ${region.label} is missing ${category} thresholds.`);
        continue;
      }
      const categoryValues = [
        categoryThresholds.bronze,
        categoryThresholds.silver,
        categoryThresholds.gold,
        categoryThresholds.platinum,
      ];
      if (!categoryValues.every(Number.isInteger)) {
        add(`Region medal ${region.label}/${category} thresholds must be integers.`);
      }
      if (!(
        categoryThresholds.bronze <= categoryThresholds.silver &&
        categoryThresholds.silver <= categoryThresholds.gold &&
        categoryThresholds.gold <= categoryThresholds.platinum
      )) {
        add(`Region medal ${region.label}/${category} thresholds are not monotonic.`);
      }
      if (categoryThresholds.platinum !== count) {
        add(
          `Region medal ${region.label}/${category} platinum=${categoryThresholds.platinum}; it must remain the full ${count}-species denominator, not current availability.`,
        );
      }
    }
  }
  return errors;
}

function collectAssetChecks(manifest) {
  const byPath = new Map();
  for (const form of manifest.forms) {
    for (const [kind, asset] of Object.entries(form.assets ?? {})) {
      if (!asset?.upstreamPath || byPath.has(asset.upstreamPath)) continue;
      byPath.set(asset.upstreamPath, {
        formId: form.formId,
        kind,
        path: asset.upstreamPath,
        url: new URL(asset.upstreamPath, manifest.source.rawBaseUrl).href,
      });
    }
  }
  return [...byPath.values()];
}

async function checkUrl(check) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(check.url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'CatchGrid catalog verifier/2' },
    });
    return response.ok
      ? { ...check, status: response.status }
      : { ...check, error: `HTTP ${response.status}` };
  } catch (error) {
    return { ...check, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timeout);
  }
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

async function main() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error(`Argument error: ${error.message}`);
    usage();
    process.exitCode = 2;
    return;
  }
  if (options.help) return;
  const [manifest, medals] = await Promise.all([
    readFile(options.manifestPath, 'utf8').then(JSON.parse),
    readFile(medalsPath, 'utf8').then(JSON.parse),
  ]);
  const errors = validateManifest(manifest, medals);
  if (errors.length) {
    console.error(`Manifest validation failed with ${errors.length} error(s):`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exitCode = 1;
    return;
  }
  const checks = collectAssetChecks(manifest);
  console.log(
    `Manifest valid: schema v${manifest.schemaVersion}, catalog ${manifest.catalogVersion}, ` +
      `1025 National Dex representatives, ${manifest.forms.length} total forms, ${checks.length} unique sprite references.`,
  );
  if (!options.network) {
    console.log('Network checks skipped. Run with --network to verify commit-pinned sprite URLs.');
    return;
  }
  const results = await mapWithConcurrency(checks, 16, checkUrl);
  const failures = results.filter((result) => result.error);
  if (failures.length) {
    for (const failure of failures)
      console.error(`${failure.formId}/${failure.kind}: ${failure.error}`);
    throw new Error(`${failures.length} sprite URL checks failed.`);
  }
  console.log(`Network verification passed for ${checks.length} unique sprite URLs.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
