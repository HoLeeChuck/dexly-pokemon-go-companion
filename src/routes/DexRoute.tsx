import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { deriveCollectionState } from '../../shared/domain';
import type {
  CatalogItem,
  Category,
  CategoryId,
  CollectionEntry,
  WantedEntry,
} from '../../shared/types';
import { createCatalogIndex, titleCase } from '../catalog/catalogIndex';
import { collectionCategoryLabel } from '../catalog/capabilities';
import { regionMedalProgresses, type MedalTier } from '../catalog/regionMedals';
import { catalogDisplayName } from '../lib/catalogDisplay';
import { Icon } from '../components/Icon';
import { PokemonGrid } from '../components/PokemonGrid';

type CollectionFilter = 'all' | 'missing' | 'collected';
type DexView = 'species' | 'mega' | 'gigantamax';

const DEX_WORKSPACE_KEY = 'catchgrid:dex-workspace:v1';
const DEFAULT_RENDER_COUNT = 48;

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

interface DexWorkspaceState {
  query: string;
  region: string;
  collectionFilter: CollectionFilter;
  dexView: DexView;
  searchOpen: boolean;
  quickCheck: boolean;
  scrollTop: number;
  renderCount: number;
  categoryId?: CategoryId;
}

function isCategoryId(value: string | null): value is CategoryId {
  return Boolean(
    value &&
    ['normal', 'shiny', 'lucky', 'hundo', 'xxl', 'xxs', 'shadow', 'purified'].includes(value),
  );
}

function readDexWorkspace(): DexWorkspaceState {
  const fallback: DexWorkspaceState = {
    query: '',
    region: 'all',
    collectionFilter: 'all',
    dexView: 'species',
    searchOpen: false,
    quickCheck: false,
    scrollTop: 0,
    renderCount: DEFAULT_RENDER_COUNT,
  };
  let stored: Partial<DexWorkspaceState> = {};
  try {
    stored = JSON.parse(
      sessionStorage.getItem(DEX_WORKSPACE_KEY) ?? '{}',
    ) as Partial<DexWorkspaceState>;
  } catch {
    // A damaged temporary workspace must never prevent the Dex from opening.
  }
  const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  const collection = params.get('collection') ?? stored.collectionFilter;
  const view = params.get('view') ?? stored.dexView;
  const category = params.get('category') ?? stored.categoryId ?? null;
  return {
    query: params.get('q') ?? stored.query ?? fallback.query,
    region: params.get('region') ?? stored.region ?? fallback.region,
    collectionFilter:
      collection === 'missing' || collection === 'collected'
        ? collection
        : fallback.collectionFilter,
    dexView: view === 'mega' || view === 'gigantamax' ? view : fallback.dexView,
    searchOpen: Boolean(stored.searchOpen || params.get('q')),
    quickCheck: Boolean(stored.quickCheck),
    scrollTop: Number.isFinite(stored.scrollTop) ? Math.max(0, stored.scrollTop ?? 0) : 0,
    renderCount: Number.isFinite(stored.renderCount)
      ? Math.max(DEFAULT_RENDER_COUNT, stored.renderCount ?? DEFAULT_RENDER_COUNT)
      : DEFAULT_RENDER_COUNT,
    categoryId: isCategoryId(category) ? category : undefined,
  };
}

function collectionKey(formId: string, categoryId: CategoryId): string {
  return `${formId}:${categoryId}`;
}

function formSearchText(item: CatalogItem): string {
  const value = [item.formName, item.formKey.replace(/[-_]+/g, ' '), catalogDisplayName(item)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return `${value} ${value
    .replace(/\balola\b/g, 'alolan')
    .replace(/\bgalar\b/g, 'galarian')
    .replace(/\bhisui\b/g, 'hisuian')
    .replace(/\bpaldea\b/g, 'paldean')}`;
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
  onOpen: (item: CatalogItem, context: readonly CatalogItem[]) => void;
  onCollectionChange: (item: CatalogItem, desired: boolean) => void;
}) {
  const [initialWorkspace] = useState<DexWorkspaceState>(readDexWorkspace);
  const [query, setQuery] = useState(initialWorkspace.query);
  const [region, setRegion] = useState(initialWorkspace.region);
  const [collectionFilter, setCollectionFilter] = useState<CollectionFilter>(
    initialWorkspace.collectionFilter,
  );
  const [dexView, setDexView] = useState<DexView>(initialWorkspace.dexView);
  const [searchOpen, setSearchOpen] = useState(initialWorkspace.searchOpen);
  const [quickCheck, setQuickCheck] = useState(initialWorkspace.quickCheck);
  const [renderCount, setRenderCount] = useState(initialWorkspace.renderCount);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef(initialWorkspace);
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
    const searchCatalog = normalizedQuery
      ? [
          ...viewedCatalog,
          ...catalog.filter((item) => {
            if (item.isDefault) return false;
            return (
              formSearchText(item).includes(normalizedQuery) &&
              normalizedQuery !== item.name.toLowerCase()
            );
          }),
        ]
      : viewedCatalog;
    return [...new Map(searchCatalog.map((item) => [item.id, item])).values()].filter((item) => {
      if (
        normalizedQuery &&
        !item.name.toLowerCase().includes(normalizedQuery) &&
        !formSearchText(item).includes(normalizedQuery) &&
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
  }, [activeCategory, catalog, collectedKeys, collectionFilter, query, region, viewedCatalog]);
  const selectedRegionMedal = region === 'all' ? null : regionMedals.get(region);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (initialWorkspace.categoryId && initialWorkspace.categoryId !== activeCategory) {
      onCategoryChange(initialWorkspace.categoryId);
    }
  }, [activeCategory, initialWorkspace.categoryId, onCategoryChange]);

  useEffect(() => {
    workspaceRef.current = {
      query,
      region,
      collectionFilter,
      dexView,
      searchOpen,
      quickCheck,
      scrollTop: resultsRef.current?.scrollTop ?? workspaceRef.current.scrollTop,
      renderCount,
      categoryId: activeCategory,
    };
    try {
      sessionStorage.setItem(DEX_WORKSPACE_KEY, JSON.stringify(workspaceRef.current));
    } catch {
      // Session persistence is an enhancement; the Dex remains usable without it.
    }
    if (window.location.hash.replace(/^#\/?/, '').split('?')[0] !== 'dex') return;
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (region !== 'all') params.set('region', region);
    if (collectionFilter !== 'all') params.set('collection', collectionFilter);
    if (dexView !== 'species') params.set('view', dexView);
    if (activeCategory !== 'normal') params.set('category', activeCategory);
    const suffix = params.size ? `?${params.toString()}` : '';
    window.history.replaceState(null, '', `/#/dex${suffix}`);
  }, [
    activeCategory,
    collectionFilter,
    dexView,
    query,
    quickCheck,
    region,
    renderCount,
    searchOpen,
  ]);

  useLayoutEffect(() => {
    let frame = 0;
    let attempts = 0;
    const restore = () => {
      const results = resultsRef.current;
      if (!results || initialWorkspace.scrollTop <= 0) return;
      results.scrollTop = initialWorkspace.scrollTop;
      attempts += 1;
      if (Math.abs(results.scrollTop - initialWorkspace.scrollTop) > 2 && attempts < 8) {
        frame = window.requestAnimationFrame(restore);
      }
    };
    frame = window.requestAnimationFrame(restore);
    return () => window.cancelAnimationFrame(frame);
  }, [initialWorkspace.scrollTop]);

  useEffect(
    () => () => {
      workspaceRef.current.scrollTop =
        resultsRef.current?.scrollTop ?? workspaceRef.current.scrollTop;
      try {
        sessionStorage.setItem(DEX_WORKSPACE_KEY, JSON.stringify(workspaceRef.current));
      } catch {
        // Ignore unavailable session storage during teardown.
      }
    },
    [],
  );

  function resetResults() {
    setRenderCount(DEFAULT_RENDER_COUNT);
    if (resultsRef.current) resultsRef.current.scrollTop = 0;
  }

  return (
    <section className="page page--dex">
      <header className="dex-header">
        <h1>Pokédex</h1>
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
            <label className="standard-filter-select region-standard-select">
              <span className="sr-only">Region</span>
              <RegionMedal
                region={region === 'all' ? undefined : region}
                tier={selectedRegionMedal?.tier ?? 'all'}
              />
              <select
                aria-label="Region"
                value={region}
                onChange={(event) => {
                  resetResults();
                  setRegion(event.target.value);
                }}
              >
                <option value="all">All</option>
                {index.regions.map((regionName) => (
                  <option key={regionName} value={regionName}>
                    {regionName}
                  </option>
                ))}
              </select>
              <Icon name="chevron-right" />
            </label>
            <label className="standard-filter-select collection-standard-select">
              <span className="sr-only">Collection category</span>
              <span className="collection-filter-glyph" aria-hidden="true">
                {categoryGlyphs[activeCategory]}
              </span>
              <select
                aria-label="Collection category"
                value={activeCategory}
                onChange={(event) => {
                  resetResults();
                  onCategoryChange(event.target.value as CategoryId);
                }}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {collectionCategoryLabel(category)}
                  </option>
                ))}
              </select>
              <Icon name="chevron-right" />
            </label>
            <label className="standard-filter-select view-standard-select">
              <span className="sr-only">Form view</span>
              <span className="collection-filter-glyph form-view-glyph" aria-hidden="true">
                {dexView === 'species' ? 'S' : dexView === 'mega' ? 'M' : 'G'}
              </span>
              <select
                aria-label="Form view"
                value={dexView}
                onChange={(event) => {
                  resetResults();
                  setDexView(event.target.value as DexView);
                }}
              >
                <option value="species">Species</option>
                <option value="mega">Mega / Primal</option>
                <option value="gigantamax">Gigantamax</option>
              </select>
              <Icon name="chevron-right" />
            </label>
            <div className={`collapsible-search${searchOpen || query ? ' is-open' : ''}`}>
              <button
                type="button"
                className="collapsible-search__trigger"
                aria-label="Open Pokémon search"
                onClick={() => setSearchOpen(true)}
              >
                <Icon name="search" />
              </button>
              <label className="search-field">
                <Icon name="search" />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={query}
                  onChange={(event) => {
                    resetResults();
                    setQuery(event.target.value);
                  }}
                  placeholder="Species, form, alias, or number"
                  aria-label="Search Pokémon"
                />
                <button
                  type="button"
                  onClick={() => {
                    resetResults();
                    setQuery('');
                    setSearchOpen(false);
                  }}
                  aria-label="Close search"
                >
                  <Icon name="close" />
                </button>
              </label>
            </div>
          </div>
          <div className="state-filter" role="group" aria-label="Collection state">
            {(['all', 'missing', 'collected'] as const).map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={collectionFilter === value}
                onClick={() => {
                  resetResults();
                  setCollectionFilter(value);
                }}
              >
                {value === 'all' ? 'All' : titleCase(value)}
              </button>
            ))}
          </div>
        </section>
        <div
          ref={resultsRef}
          className="dex-results"
          onScroll={(event) => {
            workspaceRef.current.scrollTop = event.currentTarget.scrollTop;
            try {
              sessionStorage.setItem(DEX_WORKSPACE_KEY, JSON.stringify(workspaceRef.current));
            } catch {
              // Keep scrolling normally when temporary storage is unavailable.
            }
          }}
        >
          <PokemonGrid
            items={filtered}
            categoryId={activeCategory}
            quickCheck={quickCheck}
            collectedKeys={collectedKeys}
            wantedFormIds={wantedFormIds}
            pendingKeys={pendingKeys}
            renderCount={renderCount}
            onRenderCountChange={setRenderCount}
            onOpen={(item) => onOpen(item, filtered)}
            onToggle={(item, value) => onCollectionChange(item, value)}
          />
        </div>
      </section>
    </section>
  );
}
