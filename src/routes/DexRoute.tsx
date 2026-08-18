import { useEffect, useMemo, useRef, useState } from 'react';
import { deriveCollectionState } from '../../shared/domain';
import type {
  CatalogItem,
  Category,
  CategoryId,
  CollectionEntry,
  WantedEntry,
} from '../../shared/types';
import { createCatalogIndex, titleCase } from '../catalog/catalogIndex';
import { regionMedalProgresses, type MedalTier } from '../catalog/regionMedals';
import { catalogDisplayName } from '../lib/catalogDisplay';
import { Icon } from '../components/Icon';
import { PokemonGrid } from '../components/PokemonGrid';

type CollectionFilter = 'all' | 'missing' | 'collected';
type DexView = 'species' | 'mega' | 'gigantamax';

const REGION_MEDAL_ASSET_IDS: Record<string, number> = {
  Kanto: 2,
  Johto: 39,
  Hoenn: 45,
  Sinnoh: 51,
  Unova: 56,
  Kalos: 61,
  Alola: 62,
  Galar: 63,
  Hisui: 79,
  Paldea: 82,
};

const categoryGlyphs: Record<CategoryId, string> = {
  normal: '◒',
  shiny: '✦',
  lucky: '♢',
  hundo: '100',
  xxl: 'XL',
  xxs: 'XS',
  shadow: '◐',
  purified: '◇',
};

function collectionKey(formId: string, categoryId: CategoryId): string {
  return `${formId}:${categoryId}`;
}

function RegionMedal({ region, tier }: { region?: string; tier: MedalTier | 'all' }) {
  const assetId = region ? REGION_MEDAL_ASSET_IDS[region] : undefined;
  return (
    <span
      className={`region-medal region-medal--${tier}${assetId ? ` region-medal--asset-${assetId}` : ''}`}
      aria-hidden="true"
    >
      {assetId ? <i /> : '◎'}
    </span>
  );
}

export default function DexRoute({
  catalog,
  categories,
  entries,
  wantedEntries,
  activeCategory,
  pendingKeys,
  onCategoryChange,
  onOpen,
  onCollectionChange,
}: {
  catalog: readonly CatalogItem[];
  categories: readonly Category[];
  entries: readonly CollectionEntry[];
  wantedEntries: readonly WantedEntry[];
  activeCategory: CategoryId;
  pendingKeys: ReadonlySet<string>;
  onCategoryChange: (categoryId: CategoryId) => void;
  onOpen: (item: CatalogItem) => void;
  onCollectionChange: (item: CatalogItem, desired: boolean) => void;
}) {
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('all');
  const [collectionFilter, setCollectionFilter] = useState<CollectionFilter>('all');
  const [dexView, setDexView] = useState<DexView>('species');
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [regionPickerOpen, setRegionPickerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickCheck, setQuickCheck] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const index = useMemo(() => createCatalogIndex(catalog), [catalog]);
  const collectedKeys = useMemo(
    () =>
      new Set(
        entries
          .filter((entry) => entry.collected)
          .map((entry) => collectionKey(entry.formId, entry.categoryId)),
      ),
    [entries],
  );
  const wantedFormIds = useMemo(
    () => new Set(wantedEntries.filter((entry) => entry.wanted).map((entry) => entry.formId)),
    [wantedEntries],
  );
  const regionMedals = useMemo(
    () => regionMedalProgresses(index, entries, activeCategory),
    [index, entries, activeCategory],
  );
  const viewedCatalog = useMemo(() => {
    if (dexView === 'species') return index.defaultForms;
    if (dexView === 'mega')
      return [
        ...(index.formsByVariant.get('mega') ?? []),
        ...(index.formsByVariant.get('primal') ?? []),
      ];
    return index.formsByVariant.get('gigantamax') ?? [];
  }, [dexView, index]);
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return viewedCatalog.filter((item) => {
      if (
        normalizedQuery &&
        !item.name.toLowerCase().includes(normalizedQuery) &&
        !catalogDisplayName(item).toLowerCase().includes(normalizedQuery) &&
        !String(item.dexNumber).includes(normalizedQuery)
      )
        return false;
      if (region !== 'all' && titleCase(item.region) !== region) return false;
      const state = deriveCollectionState(
        item.rules[activeCategory] ?? 'unknown',
        collectedKeys.has(collectionKey(item.id, activeCategory)),
      );
      if (collectionFilter === 'missing' && state !== 'missing') return false;
      if (collectionFilter === 'collected' && state !== 'collected') return false;
      return true;
    });
  }, [activeCategory, collectedKeys, collectionFilter, query, region, viewedCatalog]);
  const activeCategoryLabel =
    categories.find((category) => category.id === activeCategory)?.label ?? activeCategory;
  const selectedRegionMedal = region === 'all' ? null : regionMedals.get(region);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  function changeRegion(value: string) {
    setRegion(value);
    setRegionPickerOpen(false);
  }

  return (
    <section className="page page--dex">
      <header className="dex-header">
        <div>
          <span className="eyebrow">Your collection</span>
          <h1>Pokédex</h1>
        </div>
        <button
          type="button"
          className={`quick-toggle${quickCheck ? ' is-active' : ''}`}
          aria-pressed={quickCheck}
          onClick={() => setQuickCheck((value) => !value)}
        >
          <Icon name={quickCheck ? 'check' : 'grid'} />
          <span>
            <strong>Quick Check</strong>
            <small>{quickCheck ? 'Tap cards to mark' : 'Browse safely'}</small>
          </span>
        </button>
      </header>
      <section className="dex-browser" aria-label="Collection browser">
        <section className="dex-controls" aria-label="Pokédex filters">
          <div className={`dex-compact-bar${searchOpen || query ? ' is-searching' : ''}`}>
            <div className={`collapsible-search${searchOpen || query ? ' is-open' : ''}`}>
              <button
                type="button"
                className="collapsible-search__trigger"
                aria-label="Open Pokémon search"
                onClick={() => {
                  setCategoryPickerOpen(false);
                  setRegionPickerOpen(false);
                  setSearchOpen(true);
                }}
              >
                <Icon name="search" />
              </button>
              <label className="search-field">
                <Icon name="search" />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Name or Pokédex number"
                  aria-label="Search Pokémon"
                />
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setSearchOpen(false);
                  }}
                  aria-label="Close search"
                >
                  <Icon name="close" />
                </button>
              </label>
            </div>
            <label className="standard-filter-select region-standard-select">
              <span className="sr-only">Region</span>
              <select value={region} onChange={(event) => changeRegion(event.target.value)}>
                <option value="all">All regions</option>
                {index.regions.map((regionName) => (
                  <option key={regionName} value={regionName}>
                    {regionName}
                  </option>
                ))}
              </select>
            </label>
            <label className="standard-filter-select collection-standard-select">
              <span className="sr-only">Collection form</span>
              <select
                value={dexView === 'species' ? activeCategory : dexView}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === 'mega' || value === 'gigantamax') {
                    setDexView(value);
                    onCategoryChange('normal');
                  } else {
                    setDexView('species');
                    onCategoryChange(value as CategoryId);
                  }
                }}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
                <option value="mega">Mega &amp; Primal</option>
                <option value="gigantamax">Gigantamax</option>
              </select>
            </label>
            <div className={`region-picker${regionPickerOpen ? ' is-open' : ''}`}>
              <button
                type="button"
                className="region-picker__toggle"
                aria-expanded={regionPickerOpen}
                aria-controls="region-options"
                onClick={() => {
                  setCategoryPickerOpen(false);
                  setRegionPickerOpen((value) => !value);
                }}
              >
                <RegionMedal
                  region={region === 'all' ? undefined : region}
                  tier={selectedRegionMedal?.tier ?? 'all'}
                />
                <span className="picker-copy">
                  <strong>{region === 'all' ? 'All regions' : region}</strong>
                  <small>
                    {selectedRegionMedal
                      ? `${selectedRegionMedal.collected}/${selectedRegionMedal.total} ${activeCategoryLabel}`
                      : 'Regional medals'}
                  </small>
                </span>
                <Icon name="chevron-right" />
              </button>
              <div
                id="region-options"
                className="region-options"
                role="listbox"
                aria-label="Region"
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={region === 'all'}
                  onClick={() => changeRegion('all')}
                >
                  <RegionMedal tier="all" />
                  <span>
                    <strong>All regions</strong>
                    <small>Show the complete Pokédex</small>
                  </span>
                </button>
                {index.regions.map((regionName) => {
                  const medal = regionMedals.get(regionName)!;
                  return (
                    <button
                      type="button"
                      role="option"
                      aria-selected={region === regionName}
                      key={regionName}
                      onClick={() => changeRegion(regionName)}
                    >
                      <RegionMedal region={regionName} tier={medal.tier} />
                      <span>
                        <strong>{regionName}</strong>
                        <small>
                          {medal.collected}/{medal.total} · {titleCase(medal.tier)}
                        </small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className={`category-picker${categoryPickerOpen ? ' is-open' : ''}`}>
              <button
                type="button"
                className="category-picker__toggle"
                aria-expanded={categoryPickerOpen}
                aria-controls="collection-category-options"
                onClick={() => {
                  setRegionPickerOpen(false);
                  setCategoryPickerOpen((value) => !value);
                }}
              >
                <span>{categoryGlyphs[activeCategory]}</span>
                <span className="picker-copy">
                  <strong>{activeCategoryLabel}</strong>
                  <small>Collection form</small>
                </span>
                <Icon name="chevron-right" />
              </button>
              <div
                id="collection-category-options"
                className="category-scroller"
                role="toolbar"
                aria-label="Collection category"
              >
                {categories
                  .filter(
                    (category) =>
                      dexView === 'species' || category.id === 'normal' || category.id === 'shiny',
                  )
                  .map((category) => (
                    <button
                      type="button"
                      key={category.id}
                      className={activeCategory === category.id ? 'is-active' : ''}
                      aria-pressed={activeCategory === category.id}
                      onClick={() => {
                        onCategoryChange(category.id);
                        setCategoryPickerOpen(false);
                      }}
                    >
                      <span>{categoryGlyphs[category.id]}</span>
                      {category.shortLabel ?? category.label}
                    </button>
                  ))}
              </div>
            </div>
          </div>
          <div className="state-filter" role="group" aria-label="Collection state">
            {(['all', 'missing', 'collected'] as const).map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={collectionFilter === value}
                onClick={() => setCollectionFilter(value)}
              >
                {value === 'all' ? 'All' : titleCase(value)}
              </button>
            ))}
          </div>
        </section>
        <div className="dex-results">
          <div className="grid-heading">
            <div>
              <h2>
                {dexView === 'species'
                  ? `${activeCategoryLabel} collection`
                  : dexView === 'mega'
                    ? `Mega & Primal · ${activeCategoryLabel}`
                    : `Gigantamax · ${activeCategoryLabel}`}
              </h2>
              <span>{filtered.length} shown</span>
            </div>
            <div className="state-legend">
              <span>
                <i className="is-collected" />
                Collected
              </span>
              <span>
                <i className="is-missing" />
                Missing
              </span>
              <span>
                <i className="is-unavailable" />
                Unavailable
              </span>
            </div>
          </div>
          <PokemonGrid
            items={filtered}
            categoryId={activeCategory}
            quickCheck={quickCheck}
            collectedKeys={collectedKeys}
            wantedFormIds={wantedFormIds}
            pendingKeys={pendingKeys}
            onOpen={onOpen}
            onToggle={(item, value) => onCollectionChange(item, value)}
          />
        </div>
      </section>
    </section>
  );
}
