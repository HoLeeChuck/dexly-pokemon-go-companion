#!/usr/bin/env node
// Download Pokémon HOME form artwork listed in catalog/form-artwork.v1.json.
// Files come from the Bulbagarden Archives media server as 256px thumbnails. The URL is derived
// from the file name (MediaWiki stores files under the MD5 of their name), so no API call is
// needed. Existing local files are kept. Writes catalog/form-artwork-manifest.v1.json.
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MAPPING_PATH = resolve(ROOT, 'catalog/form-artwork.v1.json');
const MANIFEST_PATH = resolve(ROOT, 'catalog/form-artwork-manifest.v1.json');
const HOME_MANIFEST_PATH = resolve(ROOT, 'catalog/home-artwork-manifest.v1.json');
const ASSET_DIR = resolve(ROOT, 'public/artwork/pokemon-home');
const MEDIA = 'https://archives.bulbagarden.net/media/upload';
const WIDTH = 256;
const USER_AGENT = 'CatchGrid artwork sync (https://dex.cjdev.app)';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
function urls(file) {
  const name = file.replace(/ /g, '_');
  const md5 = createHash('md5').update(name).digest('hex');
  const path = `${md5[0]}/${md5.slice(0, 2)}/${encodeURIComponent(name)}`;
  return {
    sourcePage: `https://archives.bulbagarden.net/wiki/File:${encodeURIComponent(name)}`,
    originalUrl: `${MEDIA}/${path}`,
    thumbnailUrl: `${MEDIA}/thumb/${path}/${WIDTH}px-${encodeURIComponent(name)}`,
  };
}
async function download(url) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (response.ok) {
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
        return bytes;
      throw new Error(`${url} did not return a PNG.`);
    }
    if (response.status === 404) return null;
    if (response.status !== 429 && response.status < 500)
      throw new Error(`${url} returned HTTP ${response.status}.`);
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
  throw new Error(`${url} kept failing.`);
}
/** The 256px thumbnail, or the original when the Archives has no thumbnail for the file. */
async function fetchArtwork(where) {
  const thumbnail = await download(where.thumbnailUrl);
  if (thumbnail) return { bytes: thumbnail, retrievedFrom: where.thumbnailUrl };
  const original = await download(where.originalUrl);
  if (original) return { bytes: original, retrievedFrom: where.originalUrl };
  throw new Error(`${where.originalUrl} was not found.`);
}

async function main() {
  const mapping = JSON.parse(await readFile(MAPPING_PATH, 'utf8'));
  const known = new Set(
    JSON.parse(await readFile(HOME_MANIFEST_PATH, 'utf8')).assets.map((a) => a.file),
  );
  const previous = existsSync(MANIFEST_PATH)
    ? JSON.parse(await readFile(MANIFEST_PATH, 'utf8'))
    : { assets: [] };
  const byFile = new Map(previous.assets.map((a) => [a.file, a]));
  const files = [
    ...new Set(
      Object.values(mapping.forms).flatMap(({ normal, shiny }) => [normal, shiny].filter(Boolean)),
    ),
  ].filter((file) => !known.has(file)); // Already covered by the species artwork manifest.

  await mkdir(ASSET_DIR, { recursive: true });
  // After scripts/artwork/resize-artwork.ps1 shrinks originals, record their new size and checksum.
  if (process.argv.includes('--refresh-hashes')) {
    for (const [file, asset] of byFile) {
      const local = resolve(ASSET_DIR, file);
      if (!existsSync(local)) continue;
      const bytes = await readFile(local);
      const hash = sha256(bytes);
      if (hash === asset.sha256) continue;
      byFile.set(file, {
        ...asset,
        byteSize: bytes.length,
        sha256: hash,
        localResize: { width: WIDTH, tool: 'scripts/artwork/resize-artwork.ps1' },
      });
    }
  }
  const queue = [...files];
  let fetched = 0;
  const failures = [];
  const worker = async () => {
    while (queue.length) {
      const file = queue.shift();
      const local = resolve(ASSET_DIR, file);
      if (existsSync(local) && byFile.has(file)) continue;
      try {
        const where = urls(file);
        const { bytes, retrievedFrom } = await fetchArtwork(where);
        await writeFile(local, bytes);
        byFile.set(file, {
          file,
          localPath: `artwork/pokemon-home/${file}`,
          ...where,
          retrievedFrom,
          byteSize: bytes.length,
          sha256: sha256(bytes),
        });
        fetched += 1;
      } catch (error) {
        failures.push(`${file}: ${error.message}`);
      }
      await new Promise((r) => setTimeout(r, 400));
    }
  };
  await Promise.all(Array.from({ length: 2 }, worker));

  const assets = files.filter((f) => byFile.has(f)).map((f) => byFile.get(f));
  await writeFile(
    MANIFEST_PATH,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        sourceCategory: mapping.source.url,
        rightsNotice: mapping.source.rightsNotice,
        retrievalMethod: `Archives media server, ${WIDTH}px thumbnail or the original when no thumbnail exists (see retrievedFrom); URL derived from the file name; checked-in, no runtime hotlinking`,
        thumbnailWidth: WIDTH,
        totalFiles: assets.length,
        totalBytes: assets.reduce((n, a) => n + a.byteSize, 0),
        assets: assets.sort((a, b) => a.file.localeCompare(b.file)),
      },
      null,
      2,
    )}\n`,
  );
  console.log(
    `Form artwork: ${fetched} downloaded, ${assets.length} recorded, ${failures.length} failed.`,
  );
  if (failures.length) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
  }
}

await main();
