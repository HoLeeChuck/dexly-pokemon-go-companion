#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format } from 'prettier';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const BASE_PATH = resolve(ROOT, 'catalog/catalog-base-2026-08-19.v1.json');
const UPDATE_PATH = resolve(ROOT, 'catalog/catchgrid-update.v1.json');
const MANIFEST_PATH = resolve(ROOT, 'catalog/home-artwork-manifest.v1.json');
const OUTPUT_DIRECTORY = resolve(ROOT, 'public/artwork/pokemon-home');
const API = 'https://archives.bulbagarden.net/w/api.php';
const USER_AGENT = 'CatchGrid HOME artwork sync/1.0 (local catalog provenance audit)';
const THUMBNAIL_WIDTH = 256;

function id4(value) {
  return String(value).padStart(4, '0');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`Archives API returned HTTP ${response.status}.`);
  return response.json();
}

function chunks(values, size) {
  return Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
    values.slice(index * size, index * size + size),
  );
}

async function mapWithConcurrency(values, concurrency, task) {
  const results = new Array(values.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (cursor < values.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await task(values[index], index);
      }
    }),
  );
  return results;
}

function resolvedShinyDex(base, update) {
  const shiny = new Set(
    base.forms
      .filter((form) => form.isDefault && form.release.shiny === true)
      .map((form) => form.dex),
  );
  for (const patch of update.defaultPatches) {
    if (patch.shinyState === 'released') shiny.add(patch.dex);
    if (patch.shinyState === 'unreleased') shiny.delete(patch.dex);
  }
  for (const patch of update.shinyReleasePatches) for (const dex of patch.dexes) shiny.add(dex);
  return shiny;
}

function defaultArtworkFiles(dex, update, shiny) {
  const patch = update.defaultPatches.find((entry) => entry.dex === dex);
  return {
    normal: patch?.normalArtworkFile ?? `HOME${id4(dex)}.png`,
    shiny: patch?.shinyArtworkFile ?? `HOME${id4(dex)} s.png`,
    includeShiny: shiny.has(dex),
  };
}

async function main() {
  const [base, update, previousManifest] = await Promise.all([
    readFile(BASE_PATH, 'utf8').then(JSON.parse),
    readFile(UPDATE_PATH, 'utf8').then(JSON.parse),
    readFile(MANIFEST_PATH, 'utf8')
      .then(JSON.parse)
      .catch(() => null),
  ]);
  const previousByFile = new Map(
    (previousManifest?.assets ?? []).map((asset) => [asset.file, asset]),
  );
  const shinyDex = resolvedShinyDex(base, update);
  const requiredFiles = [];
  for (let dex = 1; dex <= base.nationalDex.max; dex += 1) {
    const files = defaultArtworkFiles(dex, update, shinyDex);
    requiredFiles.push(files.normal);
    if (files.includeShiny) requiredFiles.push(files.shiny);
  }
  for (const group of update.groups) {
    for (const member of group.members) {
      if (member.normalArtworkFile) requiredFiles.push(member.normalArtworkFile);
      if (member.shinyState === 'released') {
        requiredFiles.push(member.shinyArtworkFile ?? `HOME${id4(member.dex)} s.png`);
      }
    }
  }
  const uniqueFiles = [...new Set(requiredFiles)];

  const pages = [];
  const batches = chunks(uniqueFiles, 40);
  const responses = await mapWithConcurrency(batches, 4, async (batch) => {
    const query = new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      prop: 'imageinfo',
      titles: batch.map((file) => `File:${file}`).join('|'),
      iiprop: 'sha1|timestamp|url',
      iiurlwidth: String(THUMBNAIL_WIDTH),
    });
    return fetchJson(`${API}?${query}`);
  });
  for (const response of responses) pages.push(...(response.query?.pages ?? []));

  const byFile = new Map();
  const missing = [];
  for (const page of pages) {
    const file = page.title?.replace(/^File:/, '');
    const info = page.imageinfo?.[0];
    if (!file || page.missing || !info?.thumburl) {
      if (file) missing.push(file);
      continue;
    }
    byFile.set(file, info);
  }
  for (const file of uniqueFiles)
    if (!byFile.has(file) && !missing.includes(file)) missing.push(file);
  if (missing.length) {
    throw new Error(
      `Missing ${missing.length} required HOME artwork file(s): ${missing.join(', ')}`,
    );
  }

  await mkdir(OUTPUT_DIRECTORY, { recursive: true });
  const assets = await mapWithConcurrency(uniqueFiles, 8, async (file, index) => {
    const info = byFile.get(file);
    const localPath = `artwork/pokemon-home/${file}`;
    const previous = previousByFile.get(file);
    if (previous?.archivesSha1 === info.sha1) {
      try {
        const bytes = await readFile(resolve(ROOT, 'public', localPath));
        if (sha256(bytes) === previous.sha256) {
          return {
            ...previous,
            sourcePage: info.descriptionurl,
            originalUrl: info.url,
            thumbnailUrl: info.thumburl,
            sourceTimestamp: info.timestamp,
          };
        }
      } catch {
        // Missing or changed local bytes are downloaded again below.
      }
    }
    const response = await fetch(info.thumburl, { headers: { 'User-Agent': USER_AGENT } });
    if (!response.ok) throw new Error(`${file} thumbnail returned HTTP ${response.status}.`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!response.headers.get('content-type')?.startsWith('image/')) {
      throw new Error(`${file} did not return an image content type.`);
    }
    await writeFile(resolve(ROOT, 'public', localPath), bytes);
    if ((index + 1) % 100 === 0) console.log(`Downloaded ${index + 1}/${uniqueFiles.length}…`);
    return {
      file,
      localPath,
      sourcePage: info.descriptionurl,
      originalUrl: info.url,
      thumbnailUrl: info.thumburl,
      archivesSha1: info.sha1,
      sourceTimestamp: info.timestamp,
      byteSize: bytes.length,
      sha256: sha256(bytes),
    };
  });

  const totalBytes = assets.reduce((sum, asset) => sum + asset.byteSize, 0);
  const manifest = {
    schemaVersion: 1,
    sourceCategory: 'https://archives.bulbagarden.net/wiki/Category:HOME_artwork',
    rightsNotice: 'https://archives.bulbagarden.net/wiki/Archives:Copyrights',
    retrievalMethod:
      'MediaWiki imageinfo API with checked-in 256px thumbnails; no runtime hotlinking',
    retrievedAt: new Date().toISOString(),
    thumbnailWidth: THUMBNAIL_WIDTH,
    requiredByCatalogVersion: update.catalogVersion,
    totalFiles: assets.length,
    totalBytes,
    assets: assets.sort((left, right) => left.file.localeCompare(right.file)),
  };
  const formatted = await format(JSON.stringify(manifest), { parser: 'json', printWidth: 100 });
  await writeFile(MANIFEST_PATH, formatted);
  const manifestSize = (await stat(MANIFEST_PATH)).size;
  console.log(
    `Synced ${assets.length} local HOME artwork files (${(totalBytes / 1_048_576).toFixed(1)} MiB); provenance manifest ${manifestSize} bytes.`,
  );
}

await main();
