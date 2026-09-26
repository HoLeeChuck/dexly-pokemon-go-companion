import { describe, expect, it, vi } from 'vitest';
import source from '../../catalog/catalog.v1.json';
import ledgerFile from '../../catalog/releases.v1.json';
import { reviewedForms } from '../../app/catalog-review';
import { applyLedger, validateLedger, ledgerSources, ledgerUpdatedAt } from '../../app/releases.js';
import type { Ledger, LedgerEntry } from '../../app/releases.js';

const forms = reviewedForms(source.forms) as {
  formId: string;
  dex: number;
  isDefault: boolean;
  rules: Record<string, string>;
}[];
const toxel = () => forms.find((p) => p.isDefault && p.dex === 848)!;
const today = new Date('2026-09-26T12:00:00Z');
const entry = (overrides: Partial<LedgerEntry> = {}): LedgerEntry => ({
  date: '2026-09-20',
  dex: 848,
  categories: ['normal', 'shiny'],
  source: 'https://pokemongo.com/news/example',
  ...overrides,
});
const ledger = (...entries: LedgerEntry[]): Ledger => ({ schemaVersion: 1, entries });

describe('the release ledger file', () => {
  it('is valid: official sources, past dates, known Pokémon and categories', () => {
    expect(validateLedger(ledgerFile, forms)).toEqual([]);
  });
});

describe('applyLedger', () => {
  it('releases the listed categories for a default species', () => {
    expect(toxel().rules.normal).toBe('unreleased');
    const applied = applyLedger(forms, ledger(entry()));
    const updated = applied.find((p) => p.formId === toxel().formId)!;
    expect(updated.rules).toMatchObject({
      normal: 'released',
      shiny: 'released',
      lucky: 'unreleased',
    });
    expect(toxel().rules.normal).toBe('unreleased'); // input unchanged
  });

  it('lets the newest entry win, whatever the file order', () => {
    const applied = applyLedger(
      forms,
      ledger(
        entry({ date: '2026-09-21', categories: ['shiny'], status: 'unreleased' }),
        entry({ date: '2026-09-20' }),
      ),
    );
    expect(applied.find((p) => p.dex === 848 && p.isDefault)!.rules.shiny).toBe('unreleased');
  });

  it('can target a single form by formId', () => {
    const galar = 'form-0052-galar';
    const applied = applyLedger(
      forms,
      ledger(entry({ dex: undefined, formId: galar, categories: ['shiny'], status: 'ineligible' })),
    );
    expect(applied.find((p) => p.formId === galar)!.rules.shiny).toBe('ineligible');
    expect(applied.find((p) => p.formId === 'form-0052-standard')!.rules.shiny).toBe(
      forms.find((p) => p.formId === 'form-0052-standard')!.rules.shiny,
    );
  });

  it('leaves the catalog untouched when the ledger is empty', () => {
    expect(applyLedger(forms, ledger())).toBe(forms);
  });
});

describe('validateLedger', () => {
  const problems = (...entries: LedgerEntry[]) => validateLedger(ledger(...entries), forms, today);

  it('accepts a well-formed entry', () => {
    expect(problems(entry())).toEqual([]);
  });

  it.each([
    ['a future date', entry({ date: '2026-10-01' }), /in the future/],
    ['a malformed date', entry({ date: '20/09/2026' }), /YYYY-MM-DD/],
    ['a community source', entry({ source: 'https://leekduck.com/events/x' }), /source must be/],
    ['an http link', entry({ source: 'http://pokemongo.com/news/x' }), /source must be/],
    ['an unknown Pokémon', entry({ dex: 9999 }), /no catalog form/],
    ['an unknown form', entry({ dex: undefined, formId: 'form-9999-x' }), /no catalog form/],
    ['a gender category', entry({ categories: ['male'] }), /unknown category "male"/],
    ['no categories', entry({ categories: [] }), /at least one category/],
    ['a bad status', entry({ status: 'maybe' as never }), /status must be/],
  ])('rejects %s', (_, bad, message) => {
    expect(problems(bad).join(' ')).toMatch(message);
  });

  it('rejects duplicate entries for the same day and category', () => {
    expect(problems(entry(), entry()).join(' ')).toMatch(/duplicates/);
  });

  it('rejects a file without the right shape', () => {
    expect(validateLedger({ schemaVersion: 2, entries: [] }, forms, today)).toEqual([
      'schemaVersion must be 1.',
    ]);
    expect(validateLedger({ schemaVersion: 1 }, forms, today)).toContain('entries must be a list.');
  });
});

describe('ledger-added forms', () => {
  const mega = (overrides = {}) => ({
    date: '2026-08-31',
    formId: 'form-0658-mega',
    dex: 658,
    formName: 'Mega Greninja',
    variantKind: 'mega' as const,
    types: ['water', 'dark'],
    categories: ['normal', 'shiny'] as ('normal' | 'shiny')[],
    source: 'https://pokemongo.com/gofest/megafinale',
    ...overrides,
  });

  it('adds a form built from its species, tracking Normal and Shiny only', () => {
    const applied = applyLedger(forms, { schemaVersion: 1, forms: [mega()], entries: [] });
    const p = applied.find((q) => q.formId === 'form-0658-mega') as unknown as Record<
      string,
      unknown
    > & { rules: Record<string, string> };
    expect(p).toMatchObject({
      dex: 658,
      isDefault: false,
      variantKind: 'mega',
      formName: 'Mega Greninja',
    });
    expect(p.types).toEqual(['water', 'dark']);
    expect(p.rules).toMatchObject({
      normal: 'released',
      shiny: 'released',
      lucky: 'ineligible',
      shadow: 'ineligible',
    });
    expect(p.artworkIsFallback).toBe(true);
    // Sorted with its species, after the default form.
    const i = applied.findIndex((q) => q.formId === 'form-0658-mega');
    expect(applied[i - 1]!.dex).toBe(658);
  });

  it('lets later entries change an added form', () => {
    const applied = applyLedger(forms, {
      schemaVersion: 1,
      forms: [mega()],
      entries: [
        {
          date: '2026-09-01',
          formId: 'form-0658-mega',
          categories: ['shiny'],
          status: 'unreleased',
          source: 'https://pokemongo.com/news/x',
        },
      ],
    });
    expect(applied.find((q) => q.formId === 'form-0658-mega')!.rules.shiny).toBe('unreleased');
  });

  it.each([
    ['an existing formId', mega({ formId: 'form-0006-mega-x', dex: 6 }), /already exists/],
    [
      'a formId for another species',
      mega({ formId: 'form-0001-mega' }),
      /must start with form-0658-/,
    ],
    ['a bad type', mega({ types: ['cosmic'] }), /types must be/],
    [
      'a category forms do not track',
      mega({ categories: ['lucky'] as never }),
      /Normal and Shiny only/,
    ],
    ['an unknown kind', mega({ variantKind: 'dynamax' as never }), /variantKind must be/],
    ['a community source', mega({ source: 'https://leekduck.com/x' }), /source must be/],
  ])('rejects %s', (_, bad, message) => {
    expect(
      validateLedger({ schemaVersion: 1, forms: [bad], entries: [] }, forms, today).join(' '),
    ).toMatch(message);
  });

  it('rejects the same new form twice', () => {
    expect(
      validateLedger({ schemaVersion: 1, forms: [mega(), mega()], entries: [] }, forms, today).join(
        ' ',
      ),
    ).toMatch(/already exists/);
  });
});

describe('the app catalog with a ledger entry', () => {
  it('makes a released species markable, including its genders', async () => {
    vi.resetModules();
    vi.doMock('../../catalog/releases.v1.json', () => ({
      default: ledger(entry({ categories: ['normal', 'shiny'] })),
    }));
    const { catalog, ledgerDate, catalogVersion, catalogSources } =
      await import('../../app/catalog.js');
    const p = catalog.find((q) => q.isDefault && q.n === 848)!;
    expect(p.rules).toMatchObject({
      normal: 'released',
      shiny: 'released',
      male: 'released',
      female: 'released',
      lucky: 'unreleased',
    });
    expect(ledgerDate).toBe('2026-09-20');
    expect(catalogVersion).toMatch(/-ledger\.2026-09-20$/);
    expect(catalogSources.some((s) => s.url === 'https://pokemongo.com/news/example')).toBe(true);
    vi.doUnmock('../../catalog/releases.v1.json');
    vi.resetModules();
  });
});

describe('ledger metadata', () => {
  it('reports its newest date and lists its links as official sources', () => {
    const l = ledger(entry({ date: '2026-09-02' }), entry({ date: '2026-09-20', dex: 1 }));
    expect(ledgerUpdatedAt(l)).toBe('2026-09-20');
    expect(ledgerUpdatedAt(ledger())).toBeNull();
    expect(ledgerSources(l).every((s) => s.kind === 'official')).toBe(true);
  });
});
