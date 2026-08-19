#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const manifestPath = fileURLToPath(new URL('../catalog/catalog.v1.json', import.meta.url));
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const errors = [];
const byId = new Map();
const bySpecies = new Map();

for (const form of manifest.forms) {
  if (byId.has(form.formId)) errors.push(`Duplicate form ID: ${form.formId}`);
  byId.set(form.formId, form);
  const family = bySpecies.get(form.speciesId) ?? [];
  family.push(form);
  bySpecies.set(form.speciesId, family);

  if (form.rules.purified === 'released' && form.rules.shadow !== 'released') {
    errors.push(`${form.formId}: Purified is released without Shadow.`);
  }
  if (form.variantKind === 'costume' && !form.costumeFamily) {
    errors.push(`${form.formId}: costume is missing costumeFamily.`);
  }
  if (['mega', 'primal', 'gigantamax'].includes(form.variantKind) && !form.transformationGroup) {
    errors.push(`${form.formId}: transformation is missing transformationGroup.`);
  }
  if (form.rules.shiny === 'released' && !form.assets.shiny?.upstreamPath) {
    errors.push(`${form.formId}: released Shiny is missing an exact asset.`);
  }
}

for (const [speciesId, forms] of bySpecies) {
  if (forms.filter((form) => form.isDefault).length !== 1) {
    errors.push(`${speciesId}: expected exactly one default form.`);
  }
}

const unownA = manifest.forms.filter(
  (form) => form.dex === 201 && (/unown a$/i.test(form.formName ?? '') || form.formKey === 'a'),
);
if (unownA.length !== 1) {
  errors.push(`Unown A must appear exactly once in collector forms; found ${unownA.length}.`);
}

for (const id of ['form-0026-mega-x', 'form-0026-mega-y']) {
  if (!byId.has(id)) errors.push(`Missing independent Mega Raichu transformation: ${id}`);
}
if (manifest.forms.filter((form) => /^form-0026-mega-[xy]$/.test(form.formId)).length !== 2) {
  errors.push('Mega Raichu X/Y must each exist exactly once.');
}

const requiredShadowDex = [
  16, 17, 18, 56, 57, 979, 72, 73, 77, 78, 86, 87, 92, 93, 94, 95, 208, 98, 99,
];
for (const dex of requiredShadowDex) {
  const form = byId.get(`form-${String(dex).padStart(4, '0')}-standard`);
  if (form?.rules.shadow !== 'released' || form?.rules.purified !== 'released') {
    errors.push(`#${dex}: required historical Shadow/Purified eligibility is missing.`);
  }
}

for (const regional of manifest.forms.filter((form) => form.variantKind === 'regional')) {
  const standard = byId.get(`form-${String(regional.dex).padStart(4, '0')}-standard`);
  if (
    regional.rules.shadow === 'released' &&
    standard?.rules.shadow === 'released' &&
    !regional.sourceIds.includes('historical-shadow-database')
  ) {
    errors.push(`${regional.formId}: regional Shadow propagation lacks form-specific evidence.`);
  }
}

const pikachuForms = bySpecies.get('species-0025') ?? [];
if (!pikachuForms.some((form) => form.variantKind === 'costume')) {
  errors.push('Pikachu must expose reviewed costume records.');
}
if (!pikachuForms.some((form) => form.variantKind === 'gigantamax')) {
  errors.push('Gigantamax Pikachu must remain a transformation record.');
}

if (errors.length) {
  console.error(`Pokémon data validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `Pokémon data valid: ${manifest.forms.length} forms, ${manifest.forms.filter((form) => form.variantKind === 'costume').length} costumes, ${manifest.forms.filter((form) => ['mega', 'primal', 'gigantamax'].includes(form.variantKind)).length} transformations.`,
  );
}
