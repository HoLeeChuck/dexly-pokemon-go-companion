/// <reference types="node" />
// Reads checked-in artwork files, so this test uses Node's file APIs.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import mapping from '../../catalog/form-artwork.v1.json';
import formManifest from '../../catalog/form-artwork-manifest.v1.json';
import homeManifest from '../../catalog/home-artwork-manifest.v1.json';
import { catalog } from '../../app/catalog.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const recorded = new Map(
  [...formManifest.assets, ...homeManifest.assets].map((a) => [a.file, a.sha256]),
);
const files = Object.values(mapping.forms).flatMap((f) =>
  [f.normal, (f as { shiny?: string }).shiny].filter(Boolean),
) as string[];

describe('form artwork', () => {
  it('only lists files that are checked in and match their recorded checksum', () => {
    const problems: string[] = [];
    for (const file of new Set(files)) {
      const path = resolve(root, 'public/artwork/pokemon-home', file);
      if (!existsSync(path)) problems.push(`${file}: not on disk`);
      else if (!recorded.has(file)) problems.push(`${file}: not in a manifest`);
      else if (createHash('sha256').update(readFileSync(path)).digest('hex') !== recorded.get(file))
        problems.push(`${file}: checksum differs from the manifest`);
    }
    expect(problems).toEqual([]);
  });

  it('maps only forms that exist in the app catalog', () => {
    const ids = new Set(catalog.map((p) => p.id));
    expect(Object.keys(mapping.forms).filter((id) => !ids.has(id))).toEqual([]);
  });

  it('shows the form’s own art instead of the species fallback', () => {
    const galarArticuno = catalog.find((p) => p.id === 'form-0144-galar')!;
    expect(galarArticuno.art).toBe('/artwork/pokemon-home/HOME0144G.png');
    expect(galarArticuno.shiny).toBe('/artwork/pokemon-home/HOME0144G s.png');
    expect(galarArticuno.artworkIsFallback).toBe(false);
    const modern = catalog.find((p) => p.id === 'form-0666-modern')!;
    expect(modern.art).toBe('/artwork/pokemon-home/HOME0666Mod.png');
    const greninja = catalog.find((p) => p.id === 'form-0658-mega')!;
    expect(greninja.art).toBe('/artwork/pokemon-home/HOME0658M.png');
  });

  it('keeps species art where the Archives file was unavailable', () => {
    const lopunny = catalog.find((p) => p.id === 'form-0428-mega')!;
    expect(lopunny.art).not.toContain('HOME0428M');
    expect(lopunny.artworkIsFallback).toBe(true);
  });
});
