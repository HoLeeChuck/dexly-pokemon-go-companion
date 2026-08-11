#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const defaultManifestPath = resolve(scriptDirectory, '..', 'catalog', 'catalog.v1.json');
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
const releaseKeys = ['normal', 'shiny', 'shadow', 'purified'];

function usage() {
  console.log(`Usage: node scripts/verify-sprites.mjs [options]

Options:
  --network          Send an HTTP HEAD request for every sprite URL
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
      if (!value || value.startsWith('--')) {
        throw new Error('--manifest requires a file path.');
      }
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

function isBooleanOrNull(value) {
  return typeof value === 'boolean' || value === null;
}

function isSafeRelativeAssetPath(value) {
  if (typeof value !== 'string' || value.length === 0) return false;
  if (value.startsWith('/') || value.startsWith('\\')) return false;
  if (value.includes('..') || value.includes('\\')) return false;
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) return false;
  return value.endsWith('.png');
}

function validateManifest(manifest) {
  const errors = [];
  const addError = (message) => errors.push(message);

  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return ['Manifest root must be a JSON object.'];
  }

  if (manifest.schemaVersion !== 1) addError('schemaVersion must equal 1.');
  if (typeof manifest.catalogVersion !== 'string' || manifest.catalogVersion.length === 0) {
    addError('catalogVersion must be a non-empty string.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(manifest.releaseMetadataAsOf ?? '')) {
    addError('releaseMetadataAsOf must use YYYY-MM-DD.');
  }

  const source = manifest.source;
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    addError('source must be an object.');
  } else {
    if (!/^[a-f\d]{40}$/.test(source.commit ?? '')) {
      addError('source.commit must be a 40-character lowercase Git commit SHA.');
    }
    if (typeof source.assetRoot !== 'string' || source.assetRoot.length === 0) {
      addError('source.assetRoot must be a non-empty string.');
    }

    try {
      const repositoryUrl = new URL(source.repositoryUrl);
      if (repositoryUrl.protocol !== 'https:') addError('source.repositoryUrl must use HTTPS.');
    } catch {
      addError('source.repositoryUrl must be a valid URL.');
    }

    try {
      const rawBaseUrl = new URL(source.rawBaseUrl);
      if (rawBaseUrl.protocol !== 'https:') addError('source.rawBaseUrl must use HTTPS.');
      if (!rawBaseUrl.pathname.includes(`/${source.commit}/`)) {
        addError('source.rawBaseUrl must include the pinned source.commit, not a moving branch.');
      }
      if (!source.rawBaseUrl.endsWith('/')) addError('source.rawBaseUrl must end with a slash.');
    } catch {
      addError('source.rawBaseUrl must be a valid URL.');
    }
  }

  const eligibilityKeys = manifest.eligibilityKeys;
  if (!Array.isArray(eligibilityKeys) || eligibilityKeys.length === 0) {
    addError('eligibilityKeys must be a non-empty array.');
  } else {
    const duplicateKeys = eligibilityKeys.filter(
      (key, index) => eligibilityKeys.indexOf(key) !== index,
    );
    if (duplicateKeys.length > 0)
      addError(`eligibilityKeys contains duplicates: ${[...new Set(duplicateKeys)].join(', ')}.`);
  }

  if (!Array.isArray(manifest.forms) || manifest.forms.length === 0) {
    addError('forms must be a non-empty array.');
    return errors;
  }

  const formIds = new Set();
  const dexAndFormKeys = new Set();
  const assetPaths = new Set();

  for (const [index, form] of manifest.forms.entries()) {
    const location = `forms[${index}]`;
    if (!form || typeof form !== 'object' || Array.isArray(form)) {
      addError(`${location} must be an object.`);
      continue;
    }

    if (!/^species-\d{4}$/.test(form.speciesId ?? '')) {
      addError(`${location}.speciesId must match species-0000.`);
    }
    if (!/^form-\d{4}-[a-z0-9-]+$/.test(form.formId ?? '')) {
      addError(`${location}.formId must match form-0000-key.`);
    } else if (formIds.has(form.formId)) {
      addError(`${location}.formId duplicates ${form.formId}.`);
    } else {
      formIds.add(form.formId);
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.formKey ?? '')) {
      addError(`${location}.formKey must be a lowercase kebab-case key.`);
    }
    if (!Number.isInteger(form.dex) || form.dex < 1) {
      addError(`${location}.dex must be a positive integer.`);
    } else {
      const paddedDex = String(form.dex).padStart(4, '0');
      if (form.speciesId !== `species-${paddedDex}`) {
        addError(`${location}.speciesId does not agree with dex ${form.dex}.`);
      }
      if (typeof form.formKey === 'string' && form.formId !== `form-${paddedDex}-${form.formKey}`) {
        addError(`${location}.formId does not agree with dex and formKey.`);
      }

      const compositeKey = `${form.dex}:${form.formKey}`;
      if (dexAndFormKeys.has(compositeKey)) {
        addError(`${location} duplicates dex/formKey ${compositeKey}.`);
      } else {
        dexAndFormKeys.add(compositeKey);
      }
    }
    if (typeof form.name !== 'string' || form.name.trim().length === 0) {
      addError(`${location}.name must be a non-empty string.`);
    } else if (form.normalizedName !== normalizeName(form.name)) {
      addError(`${location}.normalizedName must equal "${normalizeName(form.name)}".`);
    }
    if (!Number.isInteger(form.generation) || form.generation < 1) {
      addError(`${location}.generation must be a positive integer.`);
    }
    if (typeof form.region !== 'string' || form.region.trim().length === 0) {
      addError(`${location}.region must be a non-empty string.`);
    }
    if (!Array.isArray(form.types) || form.types.length < 1 || form.types.length > 2) {
      addError(`${location}.types must contain one or two types.`);
    } else {
      const uniqueTypes = new Set(form.types);
      if (uniqueTypes.size !== form.types.length)
        addError(`${location}.types must not contain duplicates.`);
      for (const type of form.types) {
        if (!allowedTypes.has(type)) addError(`${location}.types contains unknown type "${type}".`);
      }
    }

    if (!form.release || typeof form.release !== 'object' || Array.isArray(form.release)) {
      addError(`${location}.release must be an object.`);
    } else {
      for (const key of releaseKeys) {
        if (!Object.hasOwn(form.release, key) || !isBooleanOrNull(form.release[key])) {
          addError(`${location}.release.${key} must be true, false, or null.`);
        }
      }
    }

    if (
      !form.eligibility ||
      typeof form.eligibility !== 'object' ||
      Array.isArray(form.eligibility)
    ) {
      addError(`${location}.eligibility must be an object.`);
    } else if (Array.isArray(eligibilityKeys)) {
      for (const key of eligibilityKeys) {
        if (!Object.hasOwn(form.eligibility, key) || !isBooleanOrNull(form.eligibility[key])) {
          addError(`${location}.eligibility.${key} must be true, false, or null.`);
        }
      }
    }

    if (typeof form.tradeable !== 'boolean') addError(`${location}.tradeable must be a boolean.`);

    if (!form.assets || typeof form.assets !== 'object' || Array.isArray(form.assets)) {
      addError(`${location}.assets must be an object.`);
      continue;
    }

    for (const kind of ['normal', 'shiny']) {
      const upstreamPath = form.assets[kind]?.upstreamPath;
      const isRequired =
        kind === 'normal' ? form.release?.normal === true : form.release?.shiny === true;

      if (isRequired && !isSafeRelativeAssetPath(upstreamPath)) {
        addError(`${location}.assets.${kind}.upstreamPath must be a safe relative PNG path.`);
      } else if (upstreamPath !== undefined && !isSafeRelativeAssetPath(upstreamPath)) {
        addError(`${location}.assets.${kind}.upstreamPath is invalid.`);
      } else if (upstreamPath !== undefined) {
        if (assetPaths.has(upstreamPath))
          addError(`${location}.assets.${kind} duplicates asset path ${upstreamPath}.`);
        assetPaths.add(upstreamPath);
      }
    }
  }

  return errors;
}

function collectAssetChecks(manifest) {
  const checks = [];
  for (const form of manifest.forms) {
    for (const [kind, asset] of Object.entries(form.assets)) {
      if (!asset?.upstreamPath) continue;
      checks.push({
        formId: form.formId,
        kind,
        path: asset.upstreamPath,
        url: new URL(asset.upstreamPath, manifest.source.rawBaseUrl).href,
      });
    }
  }
  return checks;
}

async function checkUrl(check) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(check.url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'pogo-collection-companion-sprite-verifier/1' },
    });
    if (!response.ok) return { ...check, error: `HTTP ${response.status} ${response.statusText}` };
    return { ...check, status: response.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ...check, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runWorker));
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

  if (options.help) {
    usage();
    return;
  }

  let manifest;
  try {
    manifest = JSON.parse(await readFile(options.manifestPath, 'utf8'));
  } catch (error) {
    console.error(`Could not read manifest ${options.manifestPath}: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const validationErrors = validateManifest(manifest);
  if (validationErrors.length > 0) {
    console.error(`Manifest validation failed with ${validationErrors.length} error(s):`);
    for (const error of validationErrors) console.error(`  - ${error}`);
    process.exitCode = 1;
    return;
  }

  const speciesCount = new Set(manifest.forms.map((form) => form.speciesId)).size;
  const assetChecks = collectAssetChecks(manifest);
  console.log(
    `Manifest valid: schema v${manifest.schemaVersion}, catalog ${manifest.catalogVersion}, ` +
      `${speciesCount} species, ${manifest.forms.length} forms, ${assetChecks.length} sprite references.`,
  );

  if (!options.network) {
    console.log(
      'Network checks skipped. Run with --network to verify the commit-pinned sprite URLs.',
    );
    return;
  }

  console.log(`Checking ${assetChecks.length} sprite URL(s) with HTTP HEAD requests...`);
  const results = await mapWithConcurrency(assetChecks, 8, checkUrl);
  const failures = results.filter((result) => result.error);

  if (failures.length > 0) {
    console.error(`Sprite URL verification failed for ${failures.length} asset(s):`);
    for (const failure of failures) {
      console.error(`  - ${failure.formId} ${failure.kind}: ${failure.error}\n    ${failure.url}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `Sprite URL verification passed: ${results.length}/${results.length} returned a successful response.`,
  );
}

await main();
