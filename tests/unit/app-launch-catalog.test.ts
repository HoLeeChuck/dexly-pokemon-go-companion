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

  it('releases Bramblin from its October 13 debut without Shiny, and keeps Brambleghast unavailable', () => {
    expect(species(946).rules).toMatchObject({
      normal: 'released',
      lucky: 'released',
      hundo: 'released',
      xxl: 'released',
      xxs: 'released',
    });
    for (const c of ['shiny', 'shadow', 'purified'] as const)
      expect(species(946).rules[c]).not.toBe('released');
    expect(ledger.entries.find((e) => e.dex === 946)?.date).toBe('2026-10-13');
    expect(species(947).rules.normal).toBe('unreleased');
    expect(species(947).rules.shiny).toBe('unreleased');
    expect(species(947).rules.lucky).toBe('unreleased');
    expect(ledger.entries.some((e) => e.dex === 947)).toBe(false);
  });

  it('includes the Sinistea, September shiny and October 2 Rocket corrections', () => {
    for (const dex of [854, 855]) {
      expect(species(dex).rules).toMatchObject({ normal: 'released', shiny: 'released' });
    }
    for (const dex of [840, 841, 842, 1011, 1019, 973, 944]) {
      expect(species(dex).rules.shiny).toBe('released');
    }
    for (const dex of [644, 767, 753, 769]) {
      // Purified follows a sourced Shadow debut, as for every Shadow species in the catalog.
      expect(species(dex).rules.shadow).toBe('released');
      expect(species(dex).rules.purified).toBe('released');
      expect(ledger.entries.find((e) => e.dex === dex)?.date).toBe('2026-10-02');
    }
    expect(species(944).rules.shadow).not.toBe('released');
    expect(species(132).rules.shadow).not.toBe('released');
    expect(species(866).rules.shiny).toBe('unreleased');
  });

  it('imports only the five officially sourced species from the original 73', () => {
    expect(audited).toHaveLength(73);
    const rows = [
      'Number\tPokémon\tNormal',
      ...audited.map((p) => `${p.dex}\t${p.name}\tYes`),
    ].join('\n');
    const { entries, summary } = interpretSheets(readText(rows), catalog);
    expect(entries.map((e) => e.formId).sort()).toEqual(
      [848, 854, 942, 943, 946].map((dex) => species(dex).id).sort(),
    );
    expect(summary.notEligible).toBe(68);
    expect(summary.notTracked).toBe(0);
    expect(summary.unmatched).toHaveLength(0);
    expect(catalog.filter((p) => p.isDefault && p.rules.normal !== 'released')).toHaveLength(68);
  });
});
