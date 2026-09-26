export interface AppPokemon {
  id: string;
  speciesId: string;
  n: number;
  name: string;
  speciesName: string;
  generation: number;
  region: string;
  types: string[];
  isDefault: boolean;
  variantKind: string;
  regionalOrigin?: string;
  rules: Record<string, string>;
  art: string;
  shiny: string;
  artworkIsFallback?: boolean;
}
export const catalogVersion: string;
export const catalogDate: string;
export const ledgerDate: string | null;
export const catalogSources: readonly { key: string; kind: string; url: string }[];
export const fullCatalog: readonly AppPokemon[];
export const catalog: readonly AppPokemon[];
