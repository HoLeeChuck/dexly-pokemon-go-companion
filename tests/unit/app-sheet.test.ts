import { describe, expect, it } from 'vitest';
import { deflateRawSync } from 'node:zlib';
import { catalog } from '../../app/catalog.js';
import {
  readWorkbook,
  readText,
  interpretSheets,
  writeWorkbook,
  collectionWorkbook,
  MAX_WORKBOOK_BYTES,
} from '../../app/sheet.js';

const species = (n: number) => catalog.find((p) => p.isDefault && p.n === n)!;
const key = (n: number, c: string) => `${species(n).id}:${c}`;
const labels: Record<string, string> = {
  normal: 'Normal',
  male: 'Male',
  female: 'Female',
  shiny: 'Shiny',
  hundo: '100%',
  lucky: 'Lucky',
  xxl: 'XXL',
  xxs: 'XXS',
  shadow: 'Shadow',
  purified: 'Purified',
};
const keys = (entries: { formId: string; categoryId: string }[]) =>
  new Set(entries.map((e) => `${e.formId}:${e.categoryId}`));

describe('gender rules from the reviewed gender list', () => {
  it('marks single-gender and genderless species', () => {
    expect(species(1).rules).toMatchObject({ male: 'released', female: 'released' });
    expect(species(29).rules).toMatchObject({ male: 'ineligible', female: 'released' });
    expect(species(128).rules).toMatchObject({ male: 'released', female: 'ineligible' });
    expect(species(81).rules).toMatchObject({ male: 'ineligible', female: 'ineligible' });
  });
  it('keeps alternate forms to Normal and Shiny', () => {
    const galarMeowth = catalog.find((p) => p.id === 'form-0052-galar')!;
    expect(galarMeowth.rules).toMatchObject({ male: 'ineligible', female: 'ineligible' });
  });
});

describe('spreadsheet round trip', () => {
  const owned = new Set([
    key(1, 'normal'),
    key(1, 'male'),
    key(1, 'shiny'),
    key(1, 'hundo'),
    key(4, 'normal'),
    key(4, 'female'),
    key(29, 'normal'),
    key(29, 'female'),
    key(81, 'normal'),
    key(81, 'lucky'),
    key(7, 'normal'), // Normal with no gender recorded
    key(25, 'xxl'),
    'form-0052-galar:normal',
    'form-0052-galar:shiny',
  ]);

  it('exports a workbook that imports back to the same collection', async () => {
    const bytes = collectionWorkbook(catalog, owned, () => ({ value: '1,2', missing: 2 }), labels);
    const sheets = await readWorkbook(bytes);
    expect(sheets.map((s) => s.name)).toEqual([
      'Trade Search Strings',
      'Kanto',
      'Johto',
      'Hoenn',
      'Sinnoh',
      'Unova',
      'Kalos',
      'Alola',
      'Galar',
      'Hisui',
      'Paldea',
      'Unidentified',
    ]);
    const kanto = sheets[1]!;
    expect(kanto.rows[2]!.slice(0, 5)).toEqual(['Number', 'Pokémon', 'Gender', '', 'Shiny']);
    expect(kanto.rows[3]!.slice(0, 6)).toEqual(['1', 'Bulbasaur', 'M', '', 'Shiny', '100%']);
    const { entries, summary } = interpretSheets(sheets, catalog);
    expect(keys(entries)).toEqual(owned);
    expect(summary.unmatched).toEqual([]);
  });

  it('writes merged gender cells for single-gender and genderless species', async () => {
    const sheets = await readWorkbook(
      collectionWorkbook(catalog, owned, () => ({ value: '', missing: 0 }), labels),
    );
    const kanto = sheets[1]!;
    const row = (n: number) => kanto.rows.findIndex((r) => r[0] === String(n));
    expect(kanto.rows[row(29)]![2]).toBe('Female');
    expect(kanto.merged.has(`${row(29)},3`)).toBe(true);
    expect(kanto.rows[row(81)]![2]).toBe('Neutral');
    expect(kanto.rows[row(151)]![5]).toBe('100%'.replace('100%', '')); // Mew: not registered
  });
});

describe('reading the community spreadsheet layout', () => {
  // Rows as they appear in the shared spreadsheet, including its extra summary rows.
  const header = [
    'Number',
    'Pokémon',
    'Gender',
    '',
    'Shiny',
    '100%',
    'Lucky',
    'XXL',
    'XXS',
    'Shadow',
    'Purified',
  ];
  const sheet = (name: string, rows: string[][], merged: string[] = []) => ({
    name,
    rows: [['COPY/PASTE', '!traded&…'], ['151', '151', '150'], header, ...rows],
    merged: new Set(merged),
  });

  it('reads gender, categories, N/A and empty cells', () => {
    const { entries, summary } = interpretSheets(
      [
        sheet(
          'Kanto',
          [
            [
              '1',
              'Bulbasaur',
              'M',
              'F',
              'Shiny',
              '100%',
              'Lucky',
              'XXL',
              'XXS',
              'Shadow',
              'Purified',
            ],
            ['10', 'Caterpie', 'M', '', 'Shiny', '', '', '', '', 'Shadow', ''],
            ['29', 'Nidoran♀️', 'Female', '', '', '', '', '', '', '', ''],
            ['81', 'Magnemite', 'Neutral', '', '', '', 'Lucky', '', '', '', ''],
            ['122', 'Mr. Mime', 'M', 'F', 'Shiny', '100%', 'Lucky', '', 'XXS', 'N/A', 'N/A'],
            ['133', 'Eevee', '', '', '', '', '', '', '', '', ''],
          ],
          ['5,3', '6,3'],
        ),
        sheet('Galar', [['52', 'Meowth', 'M', 'F', 'Shiny', '100%', '', '', '', 'N/A', 'N/A']]),
        {
          name: 'Trade Search Strings',
          rows: [['XXL', '!traded&XXL&1,2']],
          merged: new Set<string>(),
        },
      ],
      catalog,
    );
    const got = keys(entries);
    for (const k of [
      'normal',
      'male',
      'female',
      'shiny',
      'hundo',
      'lucky',
      'xxl',
      'xxs',
      'shadow',
      'purified',
    ])
      expect(got.has(key(1, k)), `Bulbasaur ${k}`).toBe(true);
    expect(got.has(key(10, 'male')) && !got.has(key(10, 'female'))).toBe(true);
    expect(got.has(key(10, 'purified'))).toBe(false);
    expect(got.has(key(29, 'female')) && got.has(key(29, 'normal'))).toBe(true);
    expect(got.has(key(81, 'normal')) && got.has(key(81, 'lucky'))).toBe(true);
    expect(got.has(key(81, 'male')) || got.has(key(81, 'female'))).toBe(false);
    expect(got.has(key(122, 'xxl')) || got.has(key(122, 'shadow'))).toBe(false);
    expect([...got].some((k) => k.startsWith(species(133).id))).toBe(false);
    // Galarian Meowth under the Galar tab: Normal and Shiny kept, the rest isn't tracked for forms.
    expect(got.has('form-0052-galar:normal') && got.has('form-0052-galar:shiny')).toBe(true);
    expect(got.has(key(52, 'normal'))).toBe(false);
    // Galarian Meowth's M, F and 100% cells: forms track Normal and Shiny only.
    expect(summary.notTracked).toBe(3);
    expect(summary.pokemon).toBe(7);
  });

  it('reads a 100% column stored as the number 1 formatted as a percentage', () => {
    // Exported workbooks store "100%" as 1.0, both in the header and in registered cells.
    const numeric = [
      [
        'Number',
        'Pokémon',
        'Gender',
        '',
        'Shiny',
        '1.0',
        'Lucky',
        'XXL',
        'XXS',
        'Shadow',
        'Purified',
      ],
      ['4.0', 'Charmander', 'M', 'F', '', '1.0', '', '', '', '', ''],
      ['7.0', 'Squirtle', 'M', '', 'Shiny', '', '', '', '', '', ''],
    ];
    const { entries, summary } = interpretSheets(
      [{ name: 'Kanto', rows: numeric, merged: new Set<string>() }],
      catalog,
    );
    const got = keys(entries);
    expect(got.has(key(4, 'hundo')) && !got.has(key(7, 'hundo'))).toBe(true);
    expect(got.has(key(7, 'shiny'))).toBe(true);
    expect(summary.skipped).toEqual([]);
  });

  it('lists skipped cells with the reason', () => {
    const { summary } = interpretSheets(
      [
        {
          name: 'Kanto',
          rows: [
            ['Number', 'Pokémon', 'Gender', '', 'Shiny', '100%', 'Lucky', 'XXL', 'XXS', 'Shadow'],
            ['132', 'Ditto', 'Neutral', '', '', '', '', '', '', 'Shadow'],
          ],
          merged: new Set<string>(['1,3']),
        },
      ],
      catalog,
    );
    expect(summary.skipped).toEqual([
      expect.objectContaining({ n: 132, categoryId: 'shadow', reason: 'notEligible' }),
    ]);
  });

  it('reads rows pasted from a spreadsheet without a header', () => {
    const pasted =
      '25\tPikachu\tM\t\tShiny\t\tLucky\t\t\t\t\n150\tMewtwo\tNeutral\t\t\t100%\t\t\t\tShadow\t\n';
    const got = keys(interpretSheets(readText(pasted), catalog).entries);
    expect(got).toEqual(
      new Set([
        key(25, 'normal'),
        key(25, 'male'),
        key(25, 'shiny'),
        key(25, 'lucky'),
        key(150, 'normal'),
        key(150, 'hundo'),
        key(150, 'shadow'),
      ]),
    );
  });

  it('reads CSV with quoted cells', () => {
    const csv = 'Number,Pokémon,Gender,,Shiny\n"4","Charmander","M","F","Shiny"\n';
    const got = keys(interpretSheets(readText(csv), catalog).entries);
    expect(got.has(key(4, 'female')) && got.has(key(4, 'shiny'))).toBe(true);
  });

  it('rejects files that are not workbooks', async () => {
    await expect(readWorkbook(new TextEncoder().encode('not a zip'))).rejects.toThrow(/Excel/);
  });

  it('writes a valid zip that reads back cell for cell', async () => {
    const bytes = writeWorkbook([
      { name: 'A & B', rows: [['x', { v: 'y', s: 1 }], [], ['', 'z <1>']], merges: ['A1:B1'] },
    ]);
    const [sheet] = await readWorkbook(bytes);
    expect(sheet!.name).toBe('A & B');
    expect(sheet!.rows).toEqual([['x', 'y'], [], ['', 'z <1>']]);
    expect(sheet!.merged.has('0,1')).toBe(true);
  });
});

describe('hostile or damaged workbooks', () => {
  // A deflate-compressed zip, as Excel writes, so the reader's inflate path is exercised.
  function deflatedZip(files: Record<string, Uint8Array | string>): Uint8Array {
    const crcTable = Array.from({ length: 256 }, (_, n) => {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      return c >>> 0;
    });
    const crc32 = (bytes: Uint8Array) => {
      let c = 0xffffffff;
      for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8);
      return (c ^ 0xffffffff) >>> 0;
    };
    const parts: Buffer[] = [];
    const central: Buffer[] = [];
    let offset = 0;
    for (const [path, content] of Object.entries(files)) {
      const raw = Buffer.from(content);
      const data = deflateRawSync(raw);
      const name = Buffer.from(path);
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(8, 8);
      local.writeUInt32LE(crc32(raw), 14);
      local.writeUInt32LE(data.length, 18);
      local.writeUInt32LE(raw.length, 22);
      local.writeUInt16LE(name.length, 26);
      const entry = Buffer.alloc(46);
      entry.writeUInt32LE(0x02014b50, 0);
      entry.writeUInt16LE(8, 10);
      entry.writeUInt32LE(crc32(raw), 16);
      entry.writeUInt32LE(data.length, 20);
      entry.writeUInt32LE(raw.length, 24);
      entry.writeUInt16LE(name.length, 28);
      entry.writeUInt32LE(offset, 42);
      parts.push(local, name, data);
      central.push(entry, name);
      offset += 30 + name.length + data.length;
    }
    const directory = Buffer.concat(central);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(Object.keys(files).length, 8);
    end.writeUInt16LE(Object.keys(files).length, 10);
    end.writeUInt32LE(directory.length, 12);
    end.writeUInt32LE(offset, 16);
    return new Uint8Array(Buffer.concat([...parts, directory, end]));
  }
  const workbookXml =
    '<workbook xmlns:r="r"><sheets><sheet name="Kanto" sheetId="1" r:id="rId1"/></sheets></workbook>';
  const relsXml =
    '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>';
  const parts = (sheet: string | Uint8Array) => ({
    'xl/workbook.xml': workbookXml,
    'xl/_rels/workbook.xml.rels': relsXml,
    'xl/worksheets/sheet1.xml': sheet,
  });

  it('explains a workbook whose compressed data is damaged', async () => {
    const bytes = deflatedZip(parts('<worksheet><sheetData/></worksheet>'.repeat(50)));
    // Overwrite the middle of the first deflate stream.
    bytes.fill(0xff, 40, 60);
    await expect(readWorkbook(bytes)).rejects.toThrow(/damaged/);
  });

  it('refuses a workbook that inflates far beyond a plausible size', async () => {
    const bomb = deflatedZip(parts(new Uint8Array(MAX_WORKBOOK_BYTES + 1024 * 1024)));
    expect(bomb.length).toBeLessThan(200_000);
    await expect(readWorkbook(bomb)).rejects.toThrow(/too large/);
  });

  it('reads Excel error cells as empty, never as a registered mark', async () => {
    const sheet =
      '<worksheet><sheetData>' +
      '<row r="1"><c r="A1" t="inlineStr"><is><t>Number</t></is></c><c r="B1" t="inlineStr"><is><t>Pokémon</t></is></c><c r="C1" t="inlineStr"><is><t>Shiny</t></is></c></row>' +
      '<row r="2"><c r="A2"><v>1</v></c><c r="B2" t="inlineStr"><is><t>Bulbasaur</t></is></c><c r="C2" t="e"><v>#N/A</v></c></row>' +
      '<row r="3"><c r="A3"><v>2</v></c><c r="B3" t="inlineStr"><is><t>Ivysaur</t></is></c><c r="C3" t="inlineStr"><is><t>Shiny</t></is></c></row>' +
      '</sheetData></worksheet>';
    const sheets = await readWorkbook(deflatedZip(parts(sheet)));
    expect(sheets[0]!.rows[1]).toEqual(['1', 'Bulbasaur', '']);
    expect(keys(interpretSheets(sheets, catalog).entries)).toEqual(new Set([key(2, 'shiny')]));
  });
});
