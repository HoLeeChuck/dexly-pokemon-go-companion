export const CATEGORY_IDS = [
  'normal',
  'shiny',
  'lucky',
  'hundo',
  'xxl',
  'xxs',
  'shadow',
  'purified',
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export const TRADE_REQUEST_TRAIT_IDS = ['normal', 'shiny', 'xxl', 'xxs', 'costume'] as const;
export type TradeRequestTrait = (typeof TRADE_REQUEST_TRAIT_IDS)[number];

export const TRADE_OFFER_TRAIT_IDS = ['shiny', 'xxl', 'xxs', 'costume'] as const;
export type TradeOfferTrait = (typeof TRADE_OFFER_TRAIT_IDS)[number];

export const RULE_STATES = ['released', 'unreleased', 'ineligible', 'unknown'] as const;

export type RuleState = (typeof RULE_STATES)[number];

export type CollectionState = 'collected' | 'missing' | Exclude<RuleState, 'released'>;

export const CATALOG_VARIANT_KINDS = [
  'standard',
  'regional',
  'costume',
  'gender',
  'alternate',
  'mega',
  'primal',
  'gigantamax',
  'fusion',
  'other',
] as const;

export type CatalogVariantKind = (typeof CATALOG_VARIANT_KINDS)[number];

export interface CatalogItem {
  /** Stable application-owned form identifier. */
  id: string;
  speciesId: string;
  dexNumber: number;
  name: string;
  formName?: string;
  formKey: string;
  generation: number;
  region: string;
  types: readonly string[];
  isDefault: boolean;
  /** Collector-facing variant classification; independent from National Dex species progress. */
  variantKind: CatalogVariantKind;
  /** Stable group used to organize related forms without changing their collection IDs. */
  collectorGroupId: string;
  isReleased: boolean;
  isTradeable: boolean;
  formSortOrder: number;
  regionalOrigin?: string;
  costumeFamily?: string;
  genderCode?: string;
  transformationGroup?: string;
  /** Catalog-retired mappings remain readable so existing collection history is never orphaned. */
  retiredAt?: string;
  /** False when Pokemon GO search syntax can only narrow to candidates. */
  searchExact: boolean;
  spriteUrl?: string;
  shinySpriteUrl?: string;
  rules: Readonly<Partial<Record<CategoryId, RuleState>>>;
}

export interface Category {
  id: CategoryId;
  label: string;
  shortLabel?: string;
  sortOrder: number;
  searchKeyword: string | null;
  tradeSearchSupported: boolean;
}

export interface CollectionEntry {
  profileId?: string;
  formId: string;
  categoryId: CategoryId;
  collected: boolean;
  updatedAt?: string;
}

export interface WantedEntry {
  id?: string;
  profileId?: string;
  formId: string;
  categoryId?: TradeRequestTrait;
  wanted: boolean;
  notes?: string;
  updatedAt?: string;
}

export interface TradeSpecimen {
  id: string;
  profileId?: string;
  formId: string;
  traits: readonly TradeOfferTrait[];
  quantity: number;
  notes?: string;
  verifiedAt?: string;
}

export interface BootstrapPayload {
  catalogVersion: string;
  profileId: string;
  categories: readonly Category[];
  catalog: readonly CatalogItem[];
  collectionEntries: readonly CollectionEntry[];
  wantedEntries: readonly WantedEntry[];
  tradeSpecimens: readonly TradeSpecimen[];
}

/** Public, cacheable catalog data. It intentionally contains no profile-shaped fields. */
export interface PublicCatalogPayload {
  catalogVersion: string;
  categories: readonly Category[];
  catalog: readonly CatalogItem[];
}
