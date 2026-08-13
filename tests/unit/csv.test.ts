import { describe, expect, it } from 'vitest';

import {
  CsvParseError,
  exportCollectionCsv,
  makeSpreadsheetFormulaSafe,
  parseCsv,
  parseTruthToken,
  previewCanonicalWideCsv,
  serializeCsv,
} from '../../shared/csv';
import type { CatalogItem, CategoryId, CollectionEntry, RuleState } from '../../shared/types';

function catalogItem(
  id: string,
  dexNumber: number,
  name: string,
  overrides: Partial<CatalogItem> = {},
): CatalogItem {
  const allReleased = {
    normal: 'released',
    shiny: 'released',
    lucky: 'released',
    hundo: 'released',
    xxl: 'released',
    xxs: 'released',
    shadow: 'released',
    purified: 'released',
  } satisfies Record<CategoryId, RuleState>;

  return {
    id,
    speciesId: `species:${dexNumber}`,
    dexNumber,
    name,
    formKey: 'standard',
    generation: 1,
    region: 'kanto',
    types: ['grass'],
    isDefault: true,
    variantKind: 'standard',
    collectorGroupId: `species:${dexNumber}`,
    isReleased: true,
    isTradeable: true,
    formSortOrder: 0,
    searchExact: true,
    rules: allReleased,
    ...overrides,
  };
}

const catalog = [
  catalogItem('001_STANDARD', 1, 'Bulbasaur'),
  catalogItem('004_STANDARD', 4, 'Charmander', { types: ['fire'] }),
];

function entry(formId: string, categoryId: CategoryId): CollectionEntry {
  return { formId, categoryId, collected: true };
}

describe('parseCsv', () => {
  it('handles a BOM, CRLF, commas, escaped quotes, and quoted newlines', () => {
    const input = '\uFEFFdex_number,name,notes\r\n' + '1,"Bulba,saur","line 1\r\nline ""2"""\r\n';

    expect(parseCsv(input)).toEqual([
      ['dex_number', 'name', 'notes'],
      ['1', 'Bulba,saur', 'line 1\nline "2"'],
    ]);
  });

  it('preserves final empty fields and accepts a custom delimiter', () => {
    expect(parseCsv('a;b;\nb;c;', ';')).toEqual([
      ['a', 'b', ''],
      ['b', 'c', ''],
    ]);
  });

  it('rejects malformed quoting with location information', () => {
    expect(() => parseCsv('name\n"Bulbasaur')).toThrow(CsvParseError);
    expect(() => parseCsv('na"me')).toThrow('Quote must begin');
    expect(() => parseCsv('"name"oops')).toThrow('Unexpected character');
  });
});

describe('parseTruthToken', () => {
  it.each(['true', ' TRUE ', 'yes', 'Y', '1', 'x', 'checked'])('parses %s as true', (value) =>
    expect(parseTruthToken(value)).toBe(true),
  );

  it.each(['', ' ', 'false', 'NO', 'n', '0', 'unchecked'])('parses %s as false', (value) =>
    expect(parseTruthToken(value)).toBe(false),
  );

  it('returns null for an invalid token', () => {
    expect(parseTruthToken('perhaps')).toBeNull();
  });
});

describe('previewCanonicalWideCsv', () => {
  const current = [entry('001_STANDARD', 'normal'), entry('001_STANDARD', 'shiny')];

  it('uses additive merge semantics without clearing false or blank cells', () => {
    const input = [
      'form_id,dex_number,name,normal,shiny',
      '001_STANDARD,1,Bulbasaur,x,false',
      '004_STANDARD,4,Charmander,,yes',
    ].join('\n');

    const preview = previewCanonicalWideCsv(input, catalog, current, 'merge');

    expect(preview.issues).toEqual([]);
    expect(preview.summary).toMatchObject({
      sourceRows: 2,
      resolvedRows: 2,
      added: 1,
      removed: 0,
      unchanged: 1,
      ignored: 2,
      rejected: 0,
    });
    expect(
      preview.changes.find(
        (change) => change.formId === '004_STANDARD' && change.categoryId === 'shiny',
      ),
    ).toMatchObject({ before: false, after: true, disposition: 'add' });
  });

  it('uses explicit false as a removal and ignores blank in update mode', () => {
    const input = ['form_id,normal,shiny', '001_STANDARD,false,'].join('\n');

    const preview = previewCanonicalWideCsv(input, catalog, current, 'update');
    expect(preview.summary.removed).toBe(1);
    expect(preview.summary.ignored).toBe(1);
  });

  it('treats blank as false for the resolved scope in replace mode', () => {
    const input = ['form_id,normal', '001_STANDARD,'].join('\n');
    const preview = previewCanonicalWideCsv(input, catalog, current, 'replace');

    expect(preview.changes).toEqual([
      {
        row: 2,
        formId: '001_STANDARD',
        categoryId: 'normal',
        before: true,
        after: false,
        disposition: 'remove',
      },
    ]);
  });

  it('reports unmatched forms and invalid truth values without changes', () => {
    const input = ['form_id,normal', 'DOES_NOT_EXIST,x', '001_STANDARD,perhaps'].join('\n');
    const preview = previewCanonicalWideCsv(input, catalog, [], 'update');

    expect(preview.changes).toEqual([]);
    expect(preview.issues.map((issue) => issue.code)).toEqual([
      'unmatched_form',
      'invalid_boolean',
    ]);
    expect(preview.summary.rejected).toBe(2);
  });

  it('collapses identical duplicates but rejects conflicting duplicates', () => {
    const same = previewCanonicalWideCsv(
      ['form_id,normal', '001_STANDARD,yes', '001_STANDARD,x'].join('\n'),
      catalog,
      [],
      'update',
    );
    expect(same.summary.added).toBe(1);
    expect(same.issues[0]?.code).toBe('duplicate_value');

    const conflict = previewCanonicalWideCsv(
      ['form_id,normal', '001_STANDARD,yes', '001_STANDARD,no'].join('\n'),
      catalog,
      [],
      'update',
    );
    expect(conflict.changes).toEqual([]);
    expect(conflict.issues[0]?.code).toBe('conflicting_duplicate');
    expect(conflict.summary.rejected).toBe(1);
  });

  it('requires form_id when a dex number could silently select the wrong form', () => {
    const costume = catalogItem('001_PARTY', 1, 'Bulbasaur', {
      formKey: 'party',
      formName: 'Party Hat',
      isDefault: false,
      searchExact: false,
    });
    const expandedCatalog = [...catalog, costume];

    const byDex = previewCanonicalWideCsv(
      ['dex_number,normal', '1,x'].join('\n'),
      expandedCatalog,
      [],
      'merge',
    );
    expect(byDex.changes).toEqual([]);
    expect(byDex.issues[0]?.code).toBe('ambiguous_pokemon');

    const byForm = previewCanonicalWideCsv(
      ['form_id,dex_number,normal', '001_STANDARD,1,x'].join('\n'),
      expandedCatalog,
      [],
      'merge',
    );
    expect(byForm.changes[0]?.formId).toBe('001_STANDARD');

    const conflict = previewCanonicalWideCsv(
      ['form_id,dex_number,name,normal', '001_STANDARD,4,Charmander,x'].join('\n'),
      expandedCatalog,
      [],
      'merge',
    );
    expect(conflict.changes).toEqual([]);
    expect(conflict.issues[0]?.code).toBe('identity_conflict');
  });

  it('applies the same release and eligibility rules during every preview', () => {
    const restricted = catalogItem('150_STANDARD', 150, 'Mewtwo', {
      rules: {
        normal: 'released',
        shiny: 'unreleased',
        lucky: 'ineligible',
        hundo: 'released',
        xxl: 'released',
        xxs: 'released',
        shadow: 'unknown',
        purified: 'released',
      },
    });
    const preview = previewCanonicalWideCsv(
      ['form_id,normal,shiny,lucky,shadow', '150_STANDARD,true,true,true,true'].join('\n'),
      [restricted],
      [],
      'merge',
    );

    expect(preview.changes).toEqual([
      expect.objectContaining({ categoryId: 'normal', disposition: 'add', after: true }),
      expect.objectContaining({ categoryId: 'shiny', disposition: 'ignored', after: false }),
      expect.objectContaining({ categoryId: 'lucky', disposition: 'ignored', after: false }),
      expect.objectContaining({ categoryId: 'shadow', disposition: 'ignored', after: false }),
    ]);
    expect(preview.issues.map((issue) => [issue.code, issue.column])).toEqual([
      ['category_not_collectible', 'shiny'],
      ['category_not_collectible', 'lucky'],
      ['category_not_collectible', 'shadow'],
    ]);
    expect(preview.summary).toMatchObject({ added: 1, ignored: 3, rejected: 3 });
  });

  it('allows an import to remove a stale collected state after eligibility changes', () => {
    const mythical = catalogItem('151_STANDARD', 151, 'Mew', {
      rules: { normal: 'released', lucky: 'ineligible' },
    });
    const preview = previewCanonicalWideCsv(
      'form_id,lucky\n151_STANDARD,false',
      [mythical],
      [entry('151_STANDARD', 'lucky')],
      'update',
    );

    expect(preview.issues).toEqual([]);
    expect(preview.changes[0]).toMatchObject({ disposition: 'remove', after: false });
  });

  it('returns actionable header and empty-file errors', () => {
    expect(previewCanonicalWideCsv('', catalog, [], 'merge').issues[0]?.code).toBe('empty_file');

    const missingHeaders = previewCanonicalWideCsv('notes\nhello', catalog, [], 'merge');
    expect(missingHeaders.issues.map((issue) => issue.code)).toEqual([
      'missing_identity_header',
      'missing_category_header',
      'missing_identity',
    ]);
  });
});

describe('CSV serialization and export', () => {
  it('quotes special fields and neutralizes spreadsheet formulas', () => {
    const csv = serializeCsv([
      ['name', 'note'],
      ['Bulbasaur, large', '=HYPERLINK("https://example.test")'],
      ['Charmander', 'line 1\nline 2'],
    ]);

    expect(csv).toContain('"Bulbasaur, large"');
    expect(csv).toContain("'=HYPERLINK");
    expect(parseCsv(csv)[2]?.[1]).toBe('line 1\nline 2');
  });

  it.each(['=1+1', '+cmd', '-cmd', '@sum', '\tformula', '\rformula'])(
    'makes %s formula safe',
    (value) => expect(makeSpreadsheetFormulaSafe(value)).toBe(`'${value}`),
  );

  it('exports a sorted, portable canonical collection', () => {
    const reversed = [...catalog].reverse();
    const csv = exportCollectionCsv(reversed, [
      entry('001_STANDARD', 'normal'),
      entry('004_STANDARD', 'shiny'),
    ]);
    const rows = parseCsv(csv);

    expect(rows[0]).toEqual([
      'dex_number',
      'form_id',
      'name',
      'normal',
      'shiny',
      'lucky',
      'hundo',
      'xxl',
      'xxs',
      'shadow',
      'purified',
    ]);
    expect(rows[1]?.slice(0, 5)).toEqual(['1', '001_STANDARD', 'Bulbasaur', 'true', 'false']);
    expect(rows[2]?.slice(0, 5)).toEqual(['4', '004_STANDARD', 'Charmander', 'false', 'true']);
  });
});
