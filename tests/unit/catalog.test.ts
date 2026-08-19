import { describe, expect, it } from 'vitest';

import manifestJson from '../../catalog/catalog.v1.json';
import medalJson from '../../catalog/region-medals.v1.json';
import changeReport from '../../catalog/CHANGE_REPORT_2026-08-19.md?raw';
import catalogMigration from '../../migrations/0010_pokemon_data_detail_audit.sql?raw';
import type { CatalogVariantKind, CategoryId, RuleState } from '../../shared/types';

interface ManifestForm {
  formId: string;
  formKey: string;
  dex: number;
  region: string;
  isDefault: boolean;
  isReleased: boolean;
  tradeable: boolean;
  variantKind: CatalogVariantKind;
  collectorGroupId: string;
  release: { normal: boolean | null; shiny: boolean | null };
  rules: Record<CategoryId, RuleState>;
  assets: { shiny?: { upstreamPath: string } };
}

const manifest = manifestJson as unknown as {
  schemaVersion: number;
  catalogVersion: string;
  forms: ManifestForm[];
};
const medals = medalJson as unknown as {
  schemaVersion: number;
  nationalDexMax: number;
  categoryIds: CategoryId[];
  regions: Array<{
    label: string;
    thresholds: { bronze: number; silver: number; gold: number; platinum: number };
    categoryThresholds: Record<
      CategoryId,
      { bronze: number; silver: number; gold: number; platinum: number }
    >;
  }>;
};
const byId = new Map(manifest.forms.map((form) => [form.formId, form]));

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

describe('Phase B catalog snapshot', () => {
  it('has one stable representative for every National Dex species', () => {
    const defaults = manifest.forms.filter((form) => form.isDefault);
    expect(manifest.schemaVersion).toBe(2);
    expect(manifest.catalogVersion).toBe('2026-08-19.1');
    expect(defaults).toHaveLength(1025);
    expect(defaults.map((form) => form.dex)).toEqual(
      Array.from({ length: 1025 }, (_, index) => index + 1),
    );
    for (const form of defaults) {
      expect(form.formId).toBe(`form-${String(form.dex).padStart(4, '0')}-standard`);
      expect(form.formKey).toBe('standard');
      expect(form.variantKind).toBe('standard');
    }
  });

  it('binds the generated migration and report to this exact manifest snapshot', async () => {
    const manifestHash = await sha256(JSON.stringify(manifestJson));
    expect(catalogMigration).toContain(`'${manifestHash}'`);
    expect(catalogMigration).toContain("'2026-08-19.1'");
    expect(changeReport).toContain('# Pokémon availability audit — 2026-08-19.1');
    expect(changeReport).toContain('- National Dex placeholders: 1025');
    expect(changeReport).toContain('- Reviewed collector forms: 179');
  });

  it('contains the reviewed regional, gender, Rotom, costume, and transformation families', () => {
    expect(byId.get('form-0038-alola')).toMatchObject({
      variantKind: 'regional',
      collectorGroupId: 'regional-alola',
    });
    expect(byId.get('form-0678-female')).toMatchObject({ variantKind: 'gender' });
    expect(byId.get('form-0479-heat')).toMatchObject({ collectorGroupId: 'rotom' });
    expect(byId.get('form-0006-mega-x')).toMatchObject({ variantKind: 'mega' });
    expect(byId.get('form-0026-mega-x')).toMatchObject({
      variantKind: 'mega',
      formName: 'Mega Raichu X',
    });
    expect(byId.get('form-0026-mega-y')).toMatchObject({
      variantKind: 'mega',
      formName: 'Mega Raichu Y',
    });
    expect(byId.get('form-0382-primal')).toMatchObject({ variantKind: 'primal' });
    expect(byId.get('form-0812-gigantamax')).toMatchObject({
      variantKind: 'gigantamax',
      isReleased: true,
    });
    expect(byId.get('form-0646-black')).toMatchObject({ variantKind: 'fusion' });
    expect(byId.get('form-0025-party-hat-2017')).toMatchObject({ variantKind: 'costume' });
  });

  it('tracks all 28 Unown forms only for Normal and Shiny', () => {
    const unown = manifest.forms.filter((form) => form.collectorGroupId === 'unown');
    expect(unown).toHaveLength(28);
    for (const form of unown) {
      expect(form.rules.normal).toBe('released');
      expect(form.rules.shiny).toBe('released');
      expect(form.rules.lucky).toBe('ineligible');
      expect(form.rules.hundo).toBe('ineligible');
      expect(form.rules.xxl).toBe('ineligible');
      expect(form.rules.xxs).toBe('ineligible');
      expect(form.rules.shadow).toBe('ineligible');
      expect(form.rules.purified).toBe('ineligible');
    }
  });

  it('preserves Solgaleo and advances the completed Nickit release', () => {
    expect(byId.get('form-0791-standard')).toMatchObject({
      release: { shiny: true },
      rules: { shiny: 'released' },
      assets: { shiny: { upstreamPath: 'pm791.s.icon.png' } },
    });
    expect(byId.get('form-0827-standard')).toMatchObject({
      release: { shiny: true },
      rules: { shiny: 'released' },
    });
    expect(byId.get('form-0828-standard')?.rules.shiny).toBe('released');
  });

  it('applies the historical Shadow audit and derives Purified eligibility', () => {
    for (const dex of [
      16, 17, 18, 56, 57, 979, 72, 73, 77, 78, 86, 87, 92, 93, 94, 95, 208, 98, 99,
    ]) {
      expect(byId.get(`form-${String(dex).padStart(4, '0')}-standard`)?.rules).toMatchObject({
        shadow: 'released',
        purified: 'released',
      });
    }
    expect(byId.get('form-0084-standard')?.rules.shadow).toBe('ineligible');
    expect(byId.get('form-0077-galar')?.rules).toMatchObject({
      shadow: 'released',
      purified: 'released',
    });
  });

  it('preserves Hisui regions and mythical trade restrictions from migrations 0006-0007', () => {
    for (let dex = 899; dex <= 905; dex += 1) {
      expect(byId.get(`form-${String(dex).padStart(4, '0')}-standard`)?.region).toBe('Hisui');
    }
    expect(byId.get('form-0151-standard')).toMatchObject({
      tradeable: false,
      rules: { lucky: 'ineligible' },
    });
    expect(byId.get('form-1025-standard')).toMatchObject({
      tradeable: false,
      rules: { lucky: 'ineligible' },
    });
    for (const dex of [808, 809]) {
      expect(byId.get(`form-${String(dex).padStart(4, '0')}-standard`)).toMatchObject({
        region: 'Unknown',
        tradeable: true,
        rules: { lucky: 'released' },
      });
    }
  });

  it('keeps regional medal denominators tied only to default National Dex entries', () => {
    expect(medals.schemaVersion).toBe(2);
    expect(medals.nationalDexMax).toBe(1025);
    expect(medals.categoryIds).toEqual([
      'normal',
      'shiny',
      'lucky',
      'hundo',
      'xxl',
      'xxs',
      'shadow',
      'purified',
    ]);
    const defaults = manifest.forms.filter((form) => form.isDefault);
    for (const region of medals.regions) {
      const fullSpeciesTotal = defaults.filter((form) => form.region === region.label).length;
      expect(fullSpeciesTotal).toBe(region.thresholds.platinum);
      expect(Object.keys(region.categoryThresholds).sort()).toEqual([...medals.categoryIds].sort());
      for (const category of medals.categoryIds) {
        const thresholds = region.categoryThresholds[category];
        expect(thresholds.platinum).toBe(fullSpeciesTotal);
        expect(thresholds.bronze).toBeLessThanOrEqual(thresholds.silver);
        expect(thresholds.silver).toBeLessThanOrEqual(thresholds.gold);
        expect(thresholds.gold).toBeLessThanOrEqual(thresholds.platinum);

        const currentlyReleased = defaults.filter(
          (form) => form.region === region.label && form.rules[category] === 'released',
        ).length;
        expect(thresholds.platinum).toBeGreaterThanOrEqual(currentlyReleased);
      }
    }
  });
});
