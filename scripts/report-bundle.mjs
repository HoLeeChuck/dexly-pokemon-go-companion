import { appendFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = resolve('dist/client');
const assets = readdirSync(resolve(root, 'assets')).filter((name) => /\.(?:js|css)$/.test(name));
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const initialNames = new Set(
  [...html.matchAll(/(?:src|href)="\/assets\/([^"]+\.(?:js|css))"/g)]
    .map((match) => match[1])
    .filter(Boolean),
);
const rows = assets.map((name) => {
  const bytes = statSync(resolve(root, 'assets', name)).size;
  const gzipBytes = gzipSync(readFileSync(resolve(root, 'assets', name))).byteLength;
  return {
    name,
    type: name.endsWith('.js') ? 'js' : 'css',
    initial: initialNames.has(name),
    bytes,
    gzipBytes,
  };
});
const sum = (type, initial, field) =>
  rows
    .filter((row) => row.type === type && (initial === undefined || row.initial === initial))
    .reduce((total, row) => total + row[field], 0);
const summary = {
  generatedAt: new Date().toISOString(),
  chunks: rows.length,
  javascriptChunks: rows.filter((row) => row.type === 'js').length,
  cssChunks: rows.filter((row) => row.type === 'css').length,
  initialJavaScriptBytes: sum('js', true, 'bytes'),
  initialJavaScriptGzipBytes: sum('js', true, 'gzipBytes'),
  totalJavaScriptBytes: sum('js', undefined, 'bytes'),
  totalJavaScriptGzipBytes: sum('js', undefined, 'gzipBytes'),
  initialCssBytes: sum('css', true, 'bytes'),
  initialCssGzipBytes: sum('css', true, 'gzipBytes'),
  totalCssBytes: sum('css', undefined, 'bytes'),
  totalCssGzipBytes: sum('css', undefined, 'gzipBytes'),
  files: rows,
};
const output = JSON.stringify(summary, null, 2);
console.log(output);
if (process.env.GITHUB_STEP_SUMMARY) {
  const kb = (value) => (value / 1024).toFixed(1);
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `## Client bundle\n\n| Metric | Raw KiB | Gzip KiB |\n|---|---:|---:|\n| Initial JavaScript | ${kb(summary.initialJavaScriptBytes)} | ${kb(summary.initialJavaScriptGzipBytes)} |\n| Total JavaScript | ${kb(summary.totalJavaScriptBytes)} | ${kb(summary.totalJavaScriptGzipBytes)} |\n| Initial CSS | ${kb(summary.initialCssBytes)} | ${kb(summary.initialCssGzipBytes)} |\n| Total CSS | ${kb(summary.totalCssBytes)} | ${kb(summary.totalCssGzipBytes)} |\n\n${summary.javascriptChunks} JavaScript chunks; ${summary.cssChunks} CSS chunks.\n`,
  );
}
