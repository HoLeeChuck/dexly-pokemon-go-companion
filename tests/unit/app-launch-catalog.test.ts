import { describe, expect, it } from 'vitest';
import source from '../../catalog/catalog.v1.json';
import ledger from '../../catalog/releases.v1.json';
import { catalog } from '../../app/catalog.js';
import { interpretSheets, readText } from '../../app/sheet.js';

const species = (dex: number) => catalog.find((p) => p.isDefault && p.n === dex)!;
const audited = source.forms.filter((p) => p.isDefault && p.rules.normal !== 'released');

describe('the real launch catalog', () => {
  it('allows released Toxel categories and genders without inventing a Rocket release', () => {
    expect(species(848).rules).toMatchObject({
      normal: 'released',
      male: 'released',
      female: 'released',
      shiny: 'released',
      lucky: 'released',
      hundo: 'released',
      xxl: 'released',
      xxs: 'released',
    });
    expect(species(848).rules.shadow).not.toBe('released');
    expect(species(848).rules.purified).not.toBe('released');
    expect(ledger.entries.find((e) => e.dex === 848)?.date).toBe('2024-11-18');
  });

  it('keeps future Bramblin and Brambleghast unavailable even though their artwork exists', () => {
    for (const dex of [946, 947]) {
      expect(species(dex).rules.normal).toBe('unreleased');
      expect(species(dex).rules.shiny).toBe('unreleased');
      expect(species(dex).rules.lucky).toBe('unreleased');
      expect(ledger.entries.some((e) => e.dex === dex)).toBe(false);
    }
  });

  it('includes the Sinistea and September shiny corrections, but no future Rocket debut', () => {
    for (const dex of [854, 855]) {
      expect(species(dex).rules).toMatchObject({ normal: 'released', shiny: 'released' });
    }
    for (const dex of [840, 841, 842, 1011, 1019, 973]) {
      expect(species(dex).rules.shiny).toBe('released');
    }
    expect(species(944).rules.shiny).toBe('unreleased');
    expect(species(644).rules.shadow).not.toBe('released');
    expect(species(132).rules.shadow).not.toBe('released');
    expect(species(866).rules.shiny).toBe('unreleased');
  });

  it('imports only the four officially sourced species from the original 73', () => {
    expect(audited).toHaveLength(73);
    const rows = [
      'Number\tPokémon\tNormal',
      ...audited.map((p) => `${p.dex}\t${p.name}\tYes`),
    ].join('\n');
    const { entries, summary } = interpretSheets(readText(rows), catalog);
    expect(entries.map((e) => e.formId).sort()).toEqual(
      [848, 854, 942, 943].map((dex) => species(dex).id).sort(),
    );
    expect(summary.notEligible).toBe(69);
    expect(summary.notTracked).toBe(0);
    expect(summary.unmatched).toHaveLength(0);
    expect(catalog.filter((p) => p.isDefault && p.rules.normal !== 'released')).toHaveLength(69);
  });
});
