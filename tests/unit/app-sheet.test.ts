import { describe, expect, it } from 'vitest';
import { catalog } from '../../app/catalog.js';
import {
  readWorkbook,
  readText,
  interpretSheets,
  writeWorkbook,
  collectionWorkbook,
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
