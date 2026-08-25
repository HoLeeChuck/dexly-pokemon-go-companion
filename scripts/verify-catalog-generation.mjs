#!/usr/bin/env node

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const overrides = JSON.parse(
  await readFile(resolve(root, 'catalog/catchgrid-update.v1.json'), 'utf8'),
);
const reportFilename = `CHANGE_REPORT_${overrides.catalogVersion.slice(0, 10)}.md`;
const generatedArtifacts = [
  'catalog/catalog.v1.json',
  `catalog/${reportFilename}`,
  `migrations/${overrides.nextMigration}`,
];

function runGenerator(arguments_, timeout = 180_000) {
  const result = spawnSync(
    process.execPath,
    ['scripts/generate-catchgrid-update.mjs', ...arguments_],
    {
      cwd: root,
      encoding: 'utf8',
      timeout,
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  return { ...result, output: `${result.stdout ?? ''}\n${result.stderr ?? ''}` };
}

function firstDifference(expected, actual) {
  const length = Math.min(expected.length, actual.length);
  for (let index = 0; index < length; index += 1) {
    if (expected[index] !== actual[index]) return index;
  }
  return expected.length === actual.length ? -1 : length;
}

const refusal = runGenerator(['--migration', overrides.nextMigration], 30_000);
if (refusal.status === 0) {
  throw new Error('Catalog sync overwrote an existing migration instead of refusing it.');
}
if (
  !refusal.output.includes('already exists') ||
  !refusal.output.includes('Catalog generation is immutable')
) {
  throw new Error(`Catalog sync failed for an unexpected reason:\n${refusal.output.trim()}`);
}
if (/HTTP \d{3}|fetch failed/i.test(refusal.output)) {
  throw new Error('Catalog sync reached the network before refusing the existing migration.');
}

const temporaryRoot = await mkdtemp(resolve(tmpdir(), 'catchgrid-catalog-generation-'));
try {
  const generation = runGenerator([
    '--migration',
    overrides.nextMigration,
    '--output-root',
    temporaryRoot,
  ]);
  if (generation.status !== 0) {
    throw new Error(`Temporary catalog regeneration failed:\n${generation.output.trim()}`);
  }

  const drift = [];
  for (const artifact of generatedArtifacts) {
    const [checkedIn, regenerated] = await Promise.all([
      readFile(resolve(root, artifact)),
      readFile(resolve(temporaryRoot, artifact)),
    ]);
    if (Buffer.compare(checkedIn, regenerated) === 0) continue;
    const offset = firstDifference(checkedIn, regenerated);
    drift.push(
      `${artifact} differs at byte ${offset} (checked in ${checkedIn.length} bytes; regenerated ${regenerated.length} bytes)`,
    );
  }
  if (drift.length > 0) {
    throw new Error(
      `Generated catalog artifact drift detected:\n${drift.map((item) => `  - ${item}`).join('\n')}\nRun pnpm catalog:sync with a new immutable migration after reviewing source changes.`,
    );
  }

  console.log(
    `Catalog generation verified: immutable overwrite refusal passed and ${generatedArtifacts
      .map((artifact) => basename(artifact))
      .join(', ')} exactly match a fresh temporary regeneration.`,
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
