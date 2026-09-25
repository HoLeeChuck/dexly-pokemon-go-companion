import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
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
import './dex-enhancements.css';
import './dex-refresh.css';

type CollectionFilter = 'all' | 'missing' | 'collected' | 'wanted';
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

const categoryNotes: Record<CategoryId, string> = {
  normal: 'Build your core species Pokédex and spot every gap.',
  shiny: 'Track the rare color variants worth hunting next.',
  lucky: 'Plan trades and finish your Lucky Pokédex.',
  hundo: 'Keep a clean record of your perfect-IV catches.',
  xxl: 'Collect showcase-ready giants across the National Dex.',
  xxs: 'Track the tiniest specimens in your collection.',
  shadow: 'Map the Shadow Pokémon still missing from your roster.',
  purified: 'Follow your purified collection without mixing categories.',
};

interface DexWorkspaceState {
  query: string;
  region: string;
  collectionFilter: CollectionFilter;
  dexView: DexView;
  quickCheck: boolean;
  filtersOpen: boolean;
  typeFilter: string;
  generationFilter: string;
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
    quickCheck: false,
    filtersOpen: false,
    typeFilter: 'all',
    generationFilter: 'all',
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
  // A dashboard shortcut starts a focused view, without old search or region filters.
  if (params.get('section') === 'missing') {
    stored = {};
    params.set('collection', 'missing');
    params.set('category', 'normal');
  }
  const collection = params.get('collection') ?? stored.collectionFilter;
  const view = params.get('view') ?? stored.dexView;
  const category = params.get('category') ?? stored.categoryId ?? null;
  return {
    query: params.get('q') ?? stored.query ?? fallback.query,
    region: params.get('region') ?? stored.region ?? fallback.region,
    collectionFilter:
      collection === 'missing' || collection === 'collected' || collection === 'wanted'
        ? collection
        : fallback.collectionFilter,
    dexView: view === 'mega' || view === 'gigantamax' ? view : fallback.dexView,
    quickCheck: Boolean(stored.quickCheck),
    filtersOpen: Boolean(stored.filtersOpen || params.get('type') || params.get('generation')),
    typeFilter: params.get('type') ?? stored.typeFilter ?? fallback.typeFilter,
    generationFilter:
      params.get('generation') ?? stored.generationFilter ?? fallback.generationFilter,
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
  const [quickCheck, setQuickCheck] = useState(initialWorkspace.quickCheck);
  const [filtersOpen, setFiltersOpen] = useState(initialWorkspace.filtersOpen);
  const [typeFilter, setTypeFilter] = useState(initialWorkspace.typeFilter);
  const [generationFilter, setGenerationFilter] = useState(initialWorkspace.generationFilter);
  const [renderCount, setRenderCount] = useState(initialWorkspace.renderCount);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef(initialWorkspace);
  const didApplyInitialCategoryRef = useRef(false);
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
  const availableTypes = useMemo(
    () =>
      [...new Set(catalog.flatMap((item) => item.types.map((type) => type.toLowerCase())))].sort(),
    [catalog],
  );
  const availableGenerations = useMemo(
    () => [...new Set(catalog.map((item) => item.generation))].sort((left, right) => left - right),
    [catalog],
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
      if (
        typeFilter !== 'all' &&
        !item.types.some((itemType) => itemType.toLowerCase() === typeFilter)
      )
        return false;
      if (generationFilter !== 'all' && item.generation !== Number(generationFilter)) return false;
      const state = deriveCollectionState(
        item.rules[activeCategory] ?? 'unknown',
        collectedKeys.has(collectionKey(item.id, activeCategory)),
      );
      if (collectionFilter === 'missing' && state !== 'missing') return false;
      if (collectionFilter === 'collected' && state !== 'collected') return false;
      if (collectionFilter === 'wanted' && !wantedFormIds.has(item.id)) return false;
      return true;
    });
  }, [
    activeCategory,
    catalog,
    collectedKeys,
    collectionFilter,
    generationFilter,
    query,
    region,
    typeFilter,
    viewedCatalog,
    wantedFormIds,
  ]);
  const selectedRegionMedal = region === 'all' ? null : regionMedals.get(region);
  const advancedFilterCount = Number(typeFilter !== 'all') + Number(generationFilter !== 'all');
  const categoryProgress = useMemo(
    () =>
      categories.map((category) => {
        const available = viewedCatalog.filter((item) => item.rules[category.id] === 'released');
        const collected = available.filter((item) =>
          collectedKeys.has(collectionKey(item.id, category.id)),
        ).length;
        return {
          category,
          available: available.length,
          collected,
          percentage: available.length ? Math.round((collected / available.length) * 100) : 0,
        };
      }),
    [categories, collectedKeys, viewedCatalog],
  );
  const activeProgress =
    categoryProgress.find(({ category }) => category.id === activeCategory) ?? categoryProgress[0];
  const activeAvailable = activeProgress?.available ?? 0;
  const activeCollected = activeProgress?.collected ?? 0;
  const activePercentage = activeProgress?.percentage ?? 0;
  const activeMissing = Math.max(0, activeAvailable - activeCollected);
  const activeCategoryLabel = activeProgress
    ? collectionCategoryLabel(activeProgress.category)
    : titleCase(activeCategory);
  const scopedRegionLabel = region === 'all' ? 'Every region' : region;

  useEffect(() => {
    if (didApplyInitialCategoryRef.current) return;
    didApplyInitialCategoryRef.current = true;
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
      quickCheck,
      filtersOpen,
      typeFilter,
      generationFilter,
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
    if (typeFilter !== 'all') params.set('type', typeFilter);
    if (generationFilter !== 'all') params.set('generation', generationFilter);
    const suffix = params.size ? `?${params.toString()}` : '';
    window.history.replaceState(null, '', `/#/dex${suffix}`);
  }, [
    activeCategory,
    collectionFilter,
    dexView,
    filtersOpen,
    generationFilter,
    query,
    quickCheck,
    region,
    renderCount,
    typeFilter,
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
      <header className="dex-header dex-command-header">
        <div className="dex-command-header__intro">
          <span className="dex-command-header__eyebrow">
            <Icon name="grid" /> Dex command center
          </span>
          <h1>Pokédex</h1>
          <p>{categoryNotes[activeCategory]}</p>
        </div>
        <div className="dex-command-header__status">
          <div
            className="dex-command-ring"
            style={{ '--dex-progress': `${activePercentage * 3.6}deg` } as CSSProperties}
            aria-label={`${activeCategoryLabel} ${activePercentage}% complete`}
          >
            <span>
              <strong>{activePercentage}%</strong>
              <small>{activeCategoryLabel}</small>
            </span>
          </div>
          <div className="dex-command-stats" aria-label="Current Dex progress">
            <span>
              <strong>{activeCollected.toLocaleString()}</strong>
              <small>Caught</small>
            </span>
            <span>
              <strong>{activeMissing.toLocaleString()}</strong>
              <small>Missing</small>
            </span>
            <span>
              <strong>{filtered.length.toLocaleString()}</strong>
              <small>Results</small>
            </span>
          </div>
        </div>
      </header>
      <div className="dex-mode-bar">
        <div className="dex-mode-switch" role="group" aria-label="Card interaction">
          <button type="button" aria-pressed={!quickCheck} onClick={() => setQuickCheck(false)}>
            <Icon name="grid" /> Browse
          </button>
          <button type="button" aria-pressed={quickCheck} onClick={() => setQuickCheck(true)}>
            <Icon name="check" /> Mark collected
          </button>
        </div>
        <p>{quickCheck ? 'Tap a card to mark or unmark it.' : 'Tap a card to view its details.'}</p>
      </div>
      <section className="dex-browser" aria-label="Collection browser">
        <div className="dex-category-rail" aria-label="Collection lanes">
          <div className="dex-category-rail__lead" aria-hidden="true">
            <span>{scopedRegionLabel}</span>
            <strong>Choose a lane</strong>
          </div>
          <div className="dex-category-rail__track">
            {categoryProgress.map(({ category, available, collected, percentage }) => (
              <button
                type="button"
                key={category.id}
                className={category.id === activeCategory ? 'is-active' : ''}
                aria-pressed={category.id === activeCategory}
                aria-label={`${collectionCategoryLabel(category)}: ${collected} of ${available} caught`}
                onClick={() => {
                  resetResults();
                  onCategoryChange(category.id);
                }}
              >
                <span className="dex-category-rail__glyph" aria-hidden="true">
                  {categoryGlyphs[category.id]}
                </span>
                <span className="dex-category-rail__copy">
                  <strong>{collectionCategoryLabel(category)}</strong>
                  <small>
                    {percentage}% · {collected}/{available}
                  </small>
                </span>
              </button>
            ))}
          </div>
        </div>
        <section className="dex-controls" aria-label="Pokédex filters">
          <div className="dex-compact-bar dex-compact-bar--visible-search">
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
            <div className="collapsible-search is-open">
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
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      resetResults();
                      setQuery('');
                      searchInputRef.current?.focus();
                    }}
                    aria-label="Clear search"
                  >
                    <Icon name="close" />
                  </button>
                )}
              </label>
            </div>
          </div>
          <div className="dex-filter-toolbar">
            <div className="state-filter" role="group" aria-label="Collection state">
              {(['all', 'missing', 'collected', 'wanted'] as const).map((value) => (
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
            <button
              type="button"
              className={`advanced-filter-trigger${filtersOpen ? ' is-active' : ''}`}
              aria-expanded={filtersOpen}
              aria-controls="dex-advanced-filters"
              onClick={() => setFiltersOpen((value) => !value)}
            >
              <Icon name="sliders" />
              Filters
              {advancedFilterCount > 0 && <span>{advancedFilterCount}</span>}
            </button>
          </div>
          {filtersOpen && (
            <div className="dex-advanced-filters" id="dex-advanced-filters">
              <label>
                <span>Pokémon type</span>
                <select
                  value={typeFilter}
                  onChange={(event) => {
                    resetResults();
                    setTypeFilter(event.target.value);
                  }}
                >
                  <option value="all">All types</option>
                  {availableTypes.map((type) => (
                    <option key={type} value={type}>
                      {titleCase(type)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Generation</span>
                <select
                  value={generationFilter}
                  onChange={(event) => {
                    resetResults();
                    setGenerationFilter(event.target.value);
                  }}
                >
                  <option value="all">All generations</option>
                  {availableGenerations.map((generation) => (
                    <option key={generation} value={generation}>
                      Generation {generation}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={advancedFilterCount === 0}
                onClick={() => {
                  resetResults();
                  setTypeFilter('all');
                  setGenerationFilter('all');
                }}
              >
                <Icon name="refresh" /> Reset filters
              </button>
              <p>{filtered.length.toLocaleString()} matching entries</p>
            </div>
          )}
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
