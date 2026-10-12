import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// UTF-8 text that was decoded as Windows-1252 and saved again ("â— " for "● ").
const doubleEncoded =
  /\u00c3[\u0080-\u00bf]|\u00c2[\u0080-\u00bf]|\u00e2[\u0080-\u00bf\u2013-\u203a\u20ac]/u;

describe('public app sources', () => {
  const files = [
    'index.html',
    ...readdirSync('app')
      .filter((f) => /\.(css|js)$/.test(f))
      .map((f) => join('app', f)),
    ...readdirSync('public')
      .filter((f) => /\.js$/.test(f))
      .map((f) => join('public', f)),
  ];
  it.each(files)('%s has no double-encoded UTF-8', (file) => {
    const lines = readFileSync(file, 'utf8')
      .split('\n')
      .map((line, i) => [i + 1, line] as const)
      .filter(([, line]) => doubleEncoded.test(line))
      .map(([n, line]) => `${n}: ${line.trim().slice(0, 80)}`);
    expect(lines).toEqual([]);
  });
});
