// Community Pokédex spreadsheet: read .xlsx workbooks or pasted rows, and write the same layout.
// Layout (one tab per region): Number | Pokémon | Gender (M, F; merged Male/Female/Neutral for
// single-gender species) | Shiny | 100% | Lucky | XXL | XXS | Shadow | Purified.
// A filled cell means registered, an empty cell means missing, N/A means not available.
// No DOM access and no dependencies: zip handling uses the platform's DecompressionStream.

const SHEET_CATEGORIES = [
  ['shiny', 'Shiny'],
  ['hundo', '100%'],
  ['lucky', 'Lucky'],
  ['xxl', 'XXL'],
  ['xxs', 'XXS'],
  ['shadow', 'Shadow'],
  ['purified', 'Purified'],
];
const HEADER_ALIASES = {
  shiny: ['shiny'],
  hundo: ['100%', '100', 'hundo', 'perfect', '4*'],
  lucky: ['lucky'],
  xxl: ['xxl'],
  xxs: ['xxs'],
  shadow: ['shadow'],
  purified: ['purified'],
  normal: ['normal', 'registered', 'caught'],
};
/** Tab names used by the spreadsheet, mapped to CatchGrid regions. */
export const SHEET_REGIONS = [
  ['Kanto', 'Kanto'],
  ['Johto', 'Johto'],
  ['Hoenn', 'Hoenn'],
  ['Sinnoh', 'Sinnoh'],
  ['Unova', 'Unova'],
  ['Kalos', 'Kalos'],
  ['Alola', 'Alola'],
  ['Galar', 'Galar'],
  ['Hisui', 'Hisui'],
  ['Paldea', 'Paldea'],
  ['Unidentified', 'Unknown'],
];
const NOT_HAVE = new Set(['', 'n/a', 'na', 'false', '0', 'no', '-', '–', '—', '✗', '✘']);
const GENDERLESS = new Set(['neutral', 'genderless', 'none', 'unknown', 'registered', 'yes']);

const norm = (s) =>
  String(s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ️]/g, '')
    .replace(/♀/g, 'f')
    .replace(/♂/g, 'm')
    .toLowerCase()
    .replace(/[^a-z0-9%*]/g, '');
const has = (value) =>
  !NOT_HAVE.has(
    String(value ?? '')
      .trim()
      .toLowerCase(),
  );

// ── Reading ──────────────────────────────────────────────────────────────

const u16 = (b, i) => b[i] | (b[i + 1] << 8);
const u32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

async function inflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** The files inside a zip archive, as a map of path to bytes. */
async function unzip(buffer) {
  const b = new Uint8Array(buffer);
  let end = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i -= 1)
    if (u32(b, i) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0) throw new Error('This file isn’t an Excel workbook (.xlsx).');
  const count = u16(b, end + 10);
  let p = u32(b, end + 16);
  const files = new Map();
  const decoder = new TextDecoder();
  for (let k = 0; k < count; k += 1) {
    if (u32(b, p) !== 0x02014b50) throw new Error('The workbook is damaged.');
    const method = u16(b, p + 10);
    const size = u32(b, p + 20);
    const nameLength = u16(b, p + 28);
    const skip = nameLength + u16(b, p + 30) + u16(b, p + 32);
    const local = u32(b, p + 42);
    const name = decoder.decode(b.subarray(p + 46, p + 46 + nameLength));
    const start = local + 30 + u16(b, local + 26) + u16(b, local + 28);
    const data = b.subarray(start, start + size);
    files.set(name, method === 8 ? await inflate(data) : data);
    p += 46 + skip;
  }
  return files;
}

const unescapeXml = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
const texts = (xml) =>
  [...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => unescapeXml(m[1])).join('');
const colIndex = (ref) =>
  [...ref.replace(/\d+/g, '')].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
const rowIndex = (ref) => Number(ref.replace(/[A-Z]+/g, '')) - 1;

/** Sheets in a workbook: { name, rows: string[][], merged: Set<"row,col"> of cells merged left }. */
export async function readWorkbook(buffer) {
  const files = await unzip(buffer);
  const read = (path) => (files.has(path) ? new TextDecoder().decode(files.get(path)) : '');
  const workbook = read('xl/workbook.xml');
  if (!workbook) throw new Error('This file isn’t an Excel workbook (.xlsx).');
  const rels = Object.fromEntries(
    [...read('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b([^>]*)>/g)].map((m) => [
      (m[1].match(/Id="([^"]+)"/) || [])[1],
      (m[1].match(/Target="([^"]+)"/) || [])[1],
    ]),
  );
  const shared = [...read('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    texts(m[1]),
  );
  return [...workbook.matchAll(/<sheet\b([^>]*)\/?>/g)].map((m) => {
    const name = unescapeXml((m[1].match(/name="([^"]*)"/) || [])[1] || '');
    const rid = (m[1].match(/r:id="([^"]+)"/) || [])[1];
    const target = (rels[rid] || '').replace(/^\/?(xl\/)?/, '');
    const xml = read(`xl/${target}`);
    const rows = [];
    for (const c of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = (c[1].match(/r="([A-Z]+\d+)"/) || [])[1];
      if (!ref) continue;
      const type = (c[1].match(/t="([^"]+)"/) || [])[1];
      const body = c[2] || '';
      const v = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      const value =
        type === 's'
          ? (shared[Number(v)] ?? '')
          : type === 'inlineStr'
            ? texts(body)
            : v === undefined
              ? ''
              : unescapeXml(v);
      const r = rowIndex(ref);
      (rows[r] ??= [])[colIndex(ref)] = value;
    }
    const merged = new Set();
    for (const mc of xml.matchAll(/<mergeCell ref="([A-Z]+\d+):([A-Z]+\d+)"/g)) {
      const r = rowIndex(mc[1]);
      for (let col = colIndex(mc[1]) + 1; col <= colIndex(mc[2]); col += 1)
        merged.add(`${r},${col}`);
    }
    return { name, rows: Array.from(rows, (row) => Array.from(row || [], (x) => x ?? '')), merged };
  });
}

/** Rows pasted from a spreadsheet (tab-separated) or a CSV file, as one untitled sheet. */
export function readText(text) {
  const delimiter = text.includes('\t') ? '\t' : ',';
  const rows = [];
  let row = [''];
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        row[row.length - 1] += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else row[row.length - 1] += ch;
    } else if (ch === '"' && row[row.length - 1] === '') quoted = true;
    else if (ch === delimiter) row.push('');
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      rows.push(row);
      row = [''];
    } else row[row.length - 1] += ch;
  }
  if (row.length > 1 || row[0] !== '') rows.push(row);
  return [{ name: '', rows, merged: new Set() }];
}

// ── Interpreting ─────────────────────────────────────────────────────────

/** Column positions from a header row, or the standard layout when there is no header. */
function layout(rows) {
  for (let r = 0; r < Math.min(rows.length, 15); r += 1) {
    // A "100%" header is often the number 1 formatted as a percentage (stored as 1 or 1.0).
    const cells = rows[r].map((c) => (/^1(\.0+)?$/.test(String(c).trim()) ? '100%' : norm(c)));
    const number = cells.findIndex((c) => ['number', 'no', 'dex', 'dexno', '#'].includes(c));
    const name = cells.findIndex((c) => ['pokemon', 'name', 'species'].includes(c));
    if (number < 0 || name < 0) continue;
    const find = (aliases) => cells.findIndex((c) => aliases.map(norm).includes(c));
    const gender = find(['gender', 'm', 'male']);
    const female = find(['f', 'female']);
    const columns = Object.fromEntries(
      Object.entries(HEADER_ALIASES).map(([id, aliases]) => [id, find(aliases)]),
    );
    return {
      headerRow: r,
      number,
      name,
      male: gender,
      female: female >= 0 ? female : gender >= 0 ? gender + 1 : -1,
      columns,
    };
  }
  return {
    headerRow: -1,
    number: 0,
    name: 1,
    male: 2,
    female: 3,
    columns: { shiny: 4, hundo: 5, lucky: 6, xxl: 7, xxs: 8, shadow: 9, purified: 10, normal: -1 },
  };
}

function regionForTab(name) {
  const tab = norm(name);
  const match = SHEET_REGIONS.find(
    ([sheet, region]) => norm(sheet) === tab || norm(region) === tab,
  );
  return match ? match[1] : null;
}

/**
 * Turn spreadsheet rows into CatchGrid entries to add.
 * Returns { entries: [{ formId, categoryId }], summary } — nothing is saved here.
 */
export function interpretSheets(sheets, catalog) {
  const species = catalog.filter((p) => p.isDefault);
  const byDex = new Map(species.map((p) => [p.n, p]));
  const found = new Map();
  const summary = {
    rows: 0,
    pokemon: 0,
    entries: 0,
    unmatched: [],
    notTracked: 0,
    notEligible: 0,
    skipped: [],
  };
  const matchedIds = new Set();
  const add = (p, categoryId) => {
    if (p.rules[categoryId] !== 'released') {
      const reason =
        p.isDefault || ['normal', 'shiny'].includes(categoryId) ? 'notEligible' : 'notTracked';
      summary[reason] += 1;
      summary.skipped.push({ formId: p.id, name: p.name, n: p.n, categoryId, reason });
      return;
    }
    found.set(`${p.id}:${categoryId}`, { formId: p.id, categoryId });
  };
  const regional = sheets.some((s) => regionForTab(s.name));
  for (const sheet of sheets) {
    const tabRegion = regionForTab(sheet.name);
    if (regional && !tabRegion) continue; // Summary tabs such as Trade Search Strings.
    const at = layout(sheet.rows);
    sheet.rows.forEach((row, r) => {
      if (r <= at.headerRow) return;
      const n = Number(String(row[at.number] ?? '').trim());
      const name = String(row[at.name] ?? '').trim();
      if (!Number.isInteger(n) || n < 1 || !name || !Number.isNaN(Number(name))) return;
      summary.rows += 1;
      let p = byDex.get(n);
      if (p && tabRegion && p.region !== tabRegion) {
        // A regional form listed under its region's tab (Galarian Meowth under Galar).
        p =
          catalog.find(
            (q) => q.n === n && q.variantKind === 'regional' && q.regionalOrigin === tabRegion,
          ) || (norm(p.speciesName) === norm(name) ? p : null);
      }
      if (!p) {
        summary.unmatched.push(`${n} ${name}`);
        return;
      }
      matchedIds.add(p.id);
      const cell = (col) => (col >= 0 ? String(row[col] ?? '').trim() : '');
      const maleCell = cell(at.male);
      const femaleMerged = sheet.merged.has(`${r},${at.female}`);
      const femaleCell = femaleMerged ? '' : cell(at.female);
      const single = norm(maleCell);
      let normal = at.columns.normal >= 0 && has(cell(at.columns.normal));
      if (has(maleCell)) {
        normal = true;
        if (['female', 'f'].includes(single) && (femaleMerged || !femaleCell)) add(p, 'female');
        else if (!GENDERLESS.has(single)) add(p, 'male');
      }
      if (has(femaleCell)) {
        normal = true;
        add(p, 'female');
      }
      if (normal) add(p, 'normal');
      for (const [id] of SHEET_CATEGORIES) if (has(cell(at.columns[id]))) add(p, id);
    });
  }
  summary.entries = found.size;
  summary.pokemon = matchedIds.size;
  return { entries: [...found.values()], summary };
}

// ── Writing ──────────────────────────────────────────────────────────────

const escapeXml = (s) =>
  String(s)
    // XML 1.0 forbids these control characters; a stray one would make Excel reject the file.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const colName = (i) => {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26))
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (bytes) => {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/** A stored (uncompressed) zip archive from { path: string } entries. */
function zip(files) {
  const encoder = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;
  for (const [path, content] of Object.entries(files)) {
    const name = encoder.encode(path);
    const data = encoder.encode(content);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    [
      [0, 0x04034b50, 4],
      [4, 20, 2],
      [6, 0x0800, 2],
      [8, 0, 2],
      [10, 0, 2],
      [12, 0x21, 2],
      [14, crc, 4],
      [18, data.length, 4],
      [22, data.length, 4],
      [26, name.length, 2],
      [28, 0, 2],
    ].forEach(([at, v, size]) =>
      size === 4 ? local.setUint32(at, v, true) : local.setUint16(at, v, true),
    );
    const entry = new DataView(new ArrayBuffer(46));
    [
      [0, 0x02014b50, 4],
      [4, 20, 2],
      [6, 20, 2],
      [8, 0x0800, 2],
      [10, 0, 2],
      [12, 0, 2],
      [14, 0x21, 2],
      [16, crc, 4],
      [20, data.length, 4],
      [24, data.length, 4],
      [28, name.length, 2],
      [42, offset, 4],
    ].forEach(([at, v, size]) =>
      size === 4 ? entry.setUint32(at, v, true) : entry.setUint16(at, v, true),
    );
    parts.push(new Uint8Array(local.buffer), name, data);
    central.push(new Uint8Array(entry.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const size = central.reduce((n, part) => n + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, Object.keys(files).length, true);
  end.setUint16(10, Object.keys(files).length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((n, part) => n + part.length, 0));
  let at = 0;
  for (const part of all) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

// Styles: 0 plain, 1 header (bold, grey), 2 N/A (grey), 3 centred, 4 bold.
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><name val="Arial"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEFEFEF"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFCCCCCC"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="5"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/><xf fillId="3" applyFill="1"/><xf applyAlignment="1"><alignment horizontal="center"/></xf><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>`;

/**
 * Build an .xlsx from sheets: [{ name, rows: (string | { v, s })[][], merges: ["C4:D4"], widths, freeze }].
 */
export function writeWorkbook(sheets) {
  const strings = [];
  const index = new Map();
  const stringId = (s) => {
    if (!index.has(s)) {
      index.set(s, strings.length);
      strings.push(s);
    }
    return index.get(s);
  };
  const files = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId${sheets.length + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`,
    'xl/styles.xml': STYLES,
  };
  sheets.forEach((sheet, i) => {
    const rows = sheet.rows
      .map((row, r) => {
        const cells = row
          .map((cell, c) => {
            if (cell === null || cell === undefined || cell === '') return '';
            const { v, s = 0 } = typeof cell === 'object' ? cell : { v: cell };
            if (v === '' || v === undefined)
              return s ? `<c r="${colName(c)}${r + 1}" s="${s}"/>` : '';
            return `<c r="${colName(c)}${r + 1}" s="${s}" t="s"><v>${stringId(String(v))}</v></c>`;
          })
          .join('');
        return cells ? `<row r="${r + 1}">${cells}</row>` : '';
      })
      .join('');
    const cols = sheet.widths
      ? `<cols>${sheet.widths.map((w, c) => `<col min="${c + 1}" max="${c + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
      : '';
    const freeze = sheet.freeze
      ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${sheet.freeze}" topLeftCell="A${sheet.freeze + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
      : '';
    const merges = sheet.merges?.length
      ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`
      : '';
    files[`xl/worksheets/sheet${i + 1}.xml`] =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${freeze}${cols}<sheetData>${rows}</sheetData>${merges}</worksheet>`;
  });
  files['xl/sharedStrings.xml'] =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">${strings.map((s) => `<si><t xml:space="preserve">${escapeXml(s)}</t></si>`).join('')}</sst>`;
  return zip(files);
}

/**
 * The collection as the community spreadsheet: a Trade Search Strings tab, then one tab per region.
 * `searchFor(categoryId)` returns the missing-entries search string for that category.
 */
export function collectionWorkbook(catalog, owned, searchFor, labels) {
  const isOwned = (p, c) => owned.has(`${p.id}:${c}`);
  const released = (p, c) => p.rules[c] === 'released';
  const trade = {
    name: 'Trade Search Strings',
    widths: [16, 110, 12],
    freeze: 1,
    rows: [
      [
        { v: 'Category', s: 1 },
        { v: 'Search string (missing, not traded)', s: 1 },
        { v: 'Remaining', s: 1 },
      ],
      ...['normal', 'male', 'female', ...SHEET_CATEGORIES.map(([id]) => id)].map((id) => {
        const { value, missing } = searchFor(id);
        return [{ v: labels[id], s: 4 }, value || 'Complete', String(missing)];
      }),
    ],
  };
  const regionTabs = SHEET_REGIONS.map(([tab, region]) => {
    const list = [
      ...catalog.filter((p) => p.isDefault && p.region === region),
      ...catalog.filter((p) => p.variantKind === 'regional' && p.regionalOrigin === region),
    ];
    const merges = ['C3:D3'];
    const rows = list.map((p, i) => {
      const r = i + 4;
      const both = released(p, 'male') && released(p, 'female');
      let gender;
      if (both) gender = [isOwned(p, 'male') ? 'M' : '', isOwned(p, 'female') ? 'F' : ''];
      else {
        merges.push(`C${r}:D${r}`);
        // Regional forms track Normal and Shiny only, so their gender isn't known here.
        const label = !p.isDefault
          ? 'Registered'
          : released(p, 'male')
            ? 'Male'
            : released(p, 'female')
              ? 'Female'
              : 'Neutral';
        gender = [isOwned(p, 'normal') ? label : '', ''];
      }
      // Normal without a recorded gender still needs to survive a round trip.
      if (both && isOwned(p, 'normal') && !gender[0] && !gender[1]) {
        merges.push(`C${r}:D${r}`);
        gender = ['Registered', ''];
      }
      if (!released(p, 'normal'))
        gender = [
          { v: 'N/A', s: 2 },
          { v: '', s: 2 },
        ];
      const cells = SHEET_CATEGORIES.map(([id, name]) =>
        released(p, id) ? (isOwned(p, id) ? name : '') : { v: 'N/A', s: 2 },
      );
      return [
        String(p.n),
        p.speciesName,
        ...gender.map((g) => (typeof g === 'object' ? g : { v: g, s: 3 })),
        ...cells,
      ];
    });
    const eligible = (id) => list.filter((p) => released(p, id));
    const counts = SHEET_CATEGORIES.map(([id]) => {
      const e = eligible(id);
      return `${e.filter((p) => isOwned(p, id)).length}/${e.length}`;
    });
    const registered = eligible('normal').filter((p) => isOwned(p, 'normal')).length;
    return {
      name: tab,
      widths: [8, 16, 7, 7, 9, 9, 9, 9, 9, 9, 10],
      freeze: 3,
      merges,
      rows: [
        [{ v: 'CatchGrid export', s: 4 }, `${new Date().toISOString().slice(0, 10)}`],
        [
          { v: 'Registered', s: 4 },
          `${registered}/${eligible('normal').length}`,
          '',
          '',
          ...counts,
        ],
        [
          { v: 'Number', s: 1 },
          { v: 'Pokémon', s: 1 },
          { v: 'Gender', s: 1 },
          { v: '', s: 1 },
          ...SHEET_CATEGORIES.map(([, name]) => ({ v: name, s: 1 })),
        ],
        ...rows,
      ],
    };
  });
  return writeWorkbook([trade, ...regionTabs]);
}
