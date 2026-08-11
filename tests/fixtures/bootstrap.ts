import type { BootstrapResponse } from '../../src/lib/api';
import type { CatalogItem, Category } from '../../shared/types';

const categories: Category[] = [
  {
    id: 'normal',
    label: 'Normal',
    shortLabel: 'Normal',
    sortOrder: 10,
    searchKeyword: null,
    tradeSearchSupported: true,
  },
  {
    id: 'shiny',
    label: 'Shiny',
    shortLabel: 'Shiny',
    sortOrder: 20,
    searchKeyword: 'shiny',
    tradeSearchSupported: true,
  },
  {
    id: 'lucky',
    label: 'Lucky',
    shortLabel: 'Lucky',
    sortOrder: 30,
    searchKeyword: 'lucky',
    tradeSearchSupported: false,
  },
  {
    id: 'hundo',
    label: 'Hundo',
    shortLabel: 'Hundo',
    sortOrder: 40,
    searchKeyword: '4*',
    tradeSearchSupported: false,
  },
  {
    id: 'xxl',
    label: 'XXL',
    shortLabel: 'XXL',
    sortOrder: 50,
    searchKeyword: 'xxl',
    tradeSearchSupported: true,
  },
  {
    id: 'xxs',
    label: 'XXS',
    shortLabel: 'XXS',
    sortOrder: 60,
    searchKeyword: 'xxs',
    tradeSearchSupported: true,
  },
  {
    id: 'shadow',
    label: 'Shadow',
    shortLabel: 'Shadow',
    sortOrder: 70,
    searchKeyword: 'shadow',
    tradeSearchSupported: false,
  },
  {
    id: 'purified',
    label: 'Purified',
    shortLabel: 'Purified',
    sortOrder: 80,
    searchKeyword: 'purified',
    tradeSearchSupported: true,
  },
];

function catalogItem(
  dexNumber: number,
  name: string,
  generation: number,
  region: string,
  types: string[],
): CatalogItem {
  const dex = String(dexNumber).padStart(4, '0');
  const auditedRocketStarter = [1, 4, 7].includes(dexNumber);

  return {
    id: `form-${dex}-standard`,
    speciesId: `species-${dex}`,
    dexNumber,
    name,
    formKey: 'standard',
    generation,
    region,
    types,
    isDefault: true,
    searchExact: true,
    rules: {
      normal: 'released',
      shiny: 'released',
      lucky: 'released',
      hundo: 'released',
      xxl: 'released',
      xxs: 'released',
      shadow: auditedRocketStarter ? 'released' : 'unknown',
      purified: auditedRocketStarter ? 'released' : 'unknown',
    },
  };
}

const catalog: CatalogItem[] = [
  catalogItem(1, 'Bulbasaur', 1, 'kanto', ['grass', 'poison']),
  catalogItem(2, 'Ivysaur', 1, 'kanto', ['grass', 'poison']),
  catalogItem(3, 'Venusaur', 1, 'kanto', ['grass', 'poison']),
  catalogItem(4, 'Charmander', 1, 'kanto', ['fire']),
  catalogItem(7, 'Squirtle', 1, 'kanto', ['water']),
  catalogItem(25, 'Pikachu', 1, 'kanto', ['electric']),
  catalogItem(133, 'Eevee', 1, 'kanto', ['normal']),
  catalogItem(152, 'Chikorita', 2, 'johto', ['grass']),
  catalogItem(155, 'Cyndaquil', 2, 'johto', ['fire']),
  catalogItem(158, 'Totodile', 2, 'johto', ['water']),
  catalogItem(252, 'Treecko', 3, 'hoenn', ['grass']),
];

const baseline: BootstrapResponse = {
  catalogVersion: 'e2e-fixture-v1',
  profileId: 'profile:e2e-ephemeral',
  revision: 12,
  authMode: 'local',
  categories,
  catalog,
  collectionEntries: [
    {
      profileId: 'profile:e2e-ephemeral',
      formId: 'form-0001-standard',
      categoryId: 'normal',
      collected: true,
    },
    {
      profileId: 'profile:e2e-ephemeral',
      formId: 'form-0025-standard',
      categoryId: 'normal',
      collected: true,
    },
    {
      profileId: 'profile:e2e-ephemeral',
      formId: 'form-0004-standard',
      categoryId: 'shiny',
      collected: true,
    },
    {
      profileId: 'profile:e2e-ephemeral',
      formId: 'form-0002-standard',
      categoryId: 'normal',
      collected: true,
    },
    {
      profileId: 'profile:e2e-ephemeral',
      formId: 'form-0002-standard',
      categoryId: 'shiny',
      collected: true,
    },
    {
      profileId: 'profile:e2e-ephemeral',
      formId: 'form-0003-standard',
      categoryId: 'normal',
      collected: true,
    },
    {
      profileId: 'profile:e2e-ephemeral',
      formId: 'form-0003-standard',
      categoryId: 'shiny',
      collected: true,
    },
    {
      profileId: 'profile:e2e-ephemeral',
      formId: 'form-0001-standard',
      categoryId: 'xxl',
      collected: true,
    },
  ],
  wantedEntries: [
    {
      id: 'wanted:e2e-squirtle-xxl',
      profileId: 'profile:e2e-ephemeral',
      formId: 'form-0007-standard',
      categoryId: 'xxl',
      wanted: true,
    },
  ],
  tradeSpecimens: [],
};

export function createBootstrapFixture(): BootstrapResponse {
  return structuredClone(baseline);
}
