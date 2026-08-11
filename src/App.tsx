import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react';
import { deriveCollectionState, progressForCategory } from '../shared/domain';
import type {
  CatalogItem,
  CategoryId,
  CollectionEntry,
  TradeOfferTrait,
  TradeRequestTrait,
  TradeSpecimen,
  WantedEntry,
} from '../shared/types';
import { DataPage } from './components/DataPage';
import { DetailSheet } from './components/DetailSheet';
import { Icon, type IconName } from './components/Icon';
import { PokemonGrid } from './components/PokemonGrid';
import { SearchLab } from './components/SearchLab';
import { TradePage } from './components/TradePage';
import {
  ApiClientError,
  api,
  saveAccessToken,
  storedAccessToken,
  type BootstrapResponse,
} from './lib/api';

type RouteId = 'dex' | 'trade' | 'search' | 'profile';
type CollectionFilter = 'all' | 'missing' | 'collected' | 'available';

const routes: Array<{ id: RouteId; label: string; icon: IconName }> = [
  { id: 'dex', label: 'Dex', icon: 'grid' },
  { id: 'trade', label: 'Trade', icon: 'swap' },
  { id: 'search', label: 'Search Lab', icon: 'flask' },
  { id: 'profile', label: 'Profile', icon: 'user' },
];

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

function routeFromHash(): RouteId {
  const value = window.location.hash.replace(/^#\/?/, '');
  return routes.some((route) => route.id === value) ? (value as RouteId) : 'dex';
}

function collectionKey(formId: string, categoryId: CategoryId): string {
  return `${formId}:${categoryId}`;
}

function setEntryLocally(
  entries: readonly CollectionEntry[],
  formId: string,
  categoryId: CategoryId,
  collected: boolean,
): CollectionEntry[] {
  const rest = entries.filter(
    (entry) => !(entry.formId === formId && entry.categoryId === categoryId),
  );
  return collected ? [...rest, { formId, categoryId, collected: true }] : rest;
}

interface ToastState {
  tone: 'success' | 'error' | 'info';
  message: string;
  batchId?: string;
}

function AppBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`app-brand${compact ? ' app-brand--compact' : ''}`}>
      <span className="app-brand__mark" aria-hidden="true">
        <span />
      </span>
      <span>
        <strong>dexly</strong>
        {!compact && <small>collection companion</small>}
      </span>
    </div>
  );
}

function AccessDialog({
  open,
  message,
  onClose,
  onSubmit,
}: {
  open: boolean;
  message?: string;
  onClose?: () => void;
  onSubmit: (token: string) => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [token, setToken] = useState(storedAccessToken());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await onSubmit(token.trim());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'That access key did not work.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <dialog
      ref={ref}
      className="access-dialog"
      onCancel={(event) => {
        if (!onClose) event.preventDefault();
      }}
    >
      <form onSubmit={submit}>
        <span className="access-dialog__mark">
          <Icon name="lock" />
        </span>
        <span className="eyebrow">Private collection</span>
        <h2>Unlock Dexly</h2>
        <p>
          {message ??
            'Enter the access key configured for this deployed Worker. It stays in this browser tab only.'}
        </p>
        <label>
          Collection access key
          <input
            type="password"
            autoComplete="current-password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Paste access key"
            autoFocus
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="button button--primary button--full"
          disabled={!token.trim() || submitting}
        >
          <Icon name="lock" />
          {submitting ? 'Checking…' : 'Unlock collection'}
        </button>
        {onClose && (
          <button type="button" className="button button--ghost button--full" onClick={onClose}>
            Cancel
          </button>
        )}
      </form>
    </dialog>
  );
}

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <AppBrand />
      <div className="loading-orbit">
        <span />
        <span />
        <span />
      </div>
      <p>Opening your Pokédex…</p>
    </div>
  );
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="error-screen">
      <span>
        <Icon name="wifi-off" />
      </span>
      <h1>Dexly couldn’t load your collection.</h1>
      <p>{message}</p>
      <button className="button button--primary" type="button" onClick={onRetry}>
        <Icon name="refresh" /> Try again
      </button>
      <small>Run the local D1 migrations before the first development start.</small>
    </div>
  );
}

export default function App() {
  const [route, setRoute] = useState<RouteId>(routeFromHash);
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'locked' | 'error'>('loading');
  const [loadMessage, setLoadMessage] = useState('');
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryId>(() => {
    const saved = localStorage.getItem('dexly:active-category') as CategoryId | null;
    return saved &&
      ['normal', 'shiny', 'lucky', 'hundo', 'xxl', 'xxs', 'shadow', 'purified'].includes(saved)
      ? saved
      : 'normal';
  });
  const [query, setQuery] = useState('');
  const [generation, setGeneration] = useState('all');
  const [region, setRegion] = useState('all');
  const [type, setType] = useState('all');
  const [collectionFilter, setCollectionFilter] = useState<CollectionFilter>('all');
  const [quickCheck, setQuickCheck] = useState(false);
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [collectionEntries, setCollectionEntries] = useState<CollectionEntry[]>([]);
  const [wantedEntries, setWantedEntries] = useState<WantedEntry[]>([]);
  const [tradeSpecimens, setTradeSpecimens] = useState<TradeSpecimen[]>([]);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<ToastState | null>(null);
  const revisionRef = useRef(0);
  const collectionRef = useRef<CollectionEntry[]>([]);
  const wantedRef = useRef<WantedEntry[]>([]);
  const mutationQueue = useRef<Promise<void>>(Promise.resolve());
  const wantedMutationQueue = useRef<Promise<void>>(Promise.resolve());
  const scrollPositions = useRef<Record<RouteId, number>>({
    dex: 0,
    trade: 0,
    search: 0,
    profile: 0,
  });

  function adoptPayload(payload: BootstrapResponse) {
    setBootstrap(payload);
    setCollectionEntries([...payload.collectionEntries]);
    collectionRef.current = [...payload.collectionEntries];
    setWantedEntries([...payload.wantedEntries]);
    wantedRef.current = [...payload.wantedEntries];
    setTradeSpecimens([...payload.tradeSpecimens]);
    revisionRef.current = payload.revision;
    setStatus('ready');
  }

  async function load(token = storedAccessToken()) {
    setStatus('loading');
    setLoadMessage('');
    try {
      adoptPayload(await api.bootstrap(token));
    } catch (error) {
      if (
        error instanceof ApiClientError &&
        ['AUTH_REQUIRED', 'PRIVATE_API_NOT_CONFIGURED'].includes(error.code)
      ) {
        setStatus('locked');
        setLoadMessage(error.message);
      } else {
        setStatus('error');
        setLoadMessage(
          error instanceof Error ? error.message : 'An unexpected loading error occurred.',
        );
      }
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
    // The first load intentionally runs once; later retries are user initiated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onHashChange = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  function navigate(next: RouteId) {
    scrollPositions.current[route] = window.scrollY;
    setRoute(next);
    window.history.pushState(null, '', `#/${next}`);
  }

  useLayoutEffect(() => {
    const frame = window.requestAnimationFrame(() =>
      window.scrollTo({ top: scrollPositions.current[route], behavior: 'auto' }),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [route]);

  function changeCategory(value: CategoryId) {
    setActiveCategory(value);
    localStorage.setItem('dexly:active-category', value);
  }

  function updateLocalCollection(formId: string, categoryId: CategoryId, collected: boolean) {
    const next = setEntryLocally(collectionRef.current, formId, categoryId, collected);
    collectionRef.current = next;
    setCollectionEntries(next);
  }

  function updateLocalWanted(formId: string, categoryId: TradeRequestTrait, wanted: boolean) {
    const rest = wantedRef.current.filter(
      (entry) => !(entry.formId === formId && entry.categoryId === categoryId),
    );
    const next = wanted ? [...rest, { formId, categoryId, wanted: true }] : rest;
    wantedRef.current = next;
    setWantedEntries(next);
  }

  function changeCollection(item: CatalogItem, categoryId: CategoryId, desired: boolean) {
    const key = collectionKey(item.id, categoryId);
    if (pendingKeys.has(key)) return;
    const previous = collectionRef.current.some(
      (entry) => entry.formId === item.id && entry.categoryId === categoryId && entry.collected,
    );
    updateLocalCollection(item.id, categoryId, desired);
    setPendingKeys((current) => new Set(current).add(key));

    mutationQueue.current = mutationQueue.current.then(async () => {
      try {
        const result = await api.setCollection({
          formId: item.id,
          categoryId,
          collected: desired,
          operationId: `op:${crypto.randomUUID()}`,
          expectedRevision: revisionRef.current,
        });
        revisionRef.current = Math.max(revisionRef.current, result.revision);
        if (
          desired &&
          (categoryId === 'xxl' || categoryId === 'xxs') &&
          wantedRef.current.some(
            (entry) => entry.formId === item.id && entry.categoryId === categoryId && entry.wanted,
          )
        ) {
          updateLocalWanted(item.id, categoryId, false);
        }
        setToast({
          tone: 'success',
          message: `${item.name} marked ${desired ? 'collected' : 'missing'} in ${categoryId}.`,
          batchId: result.batchId ?? undefined,
        });
      } catch (error) {
        updateLocalCollection(item.id, categoryId, previous);
        setToast({
          tone: 'error',
          message: error instanceof Error ? error.message : 'The change was not saved.',
        });
        if (
          error instanceof ApiClientError &&
          ['REVISION_CONFLICT', 'OPERATION_SUPERSEDED'].includes(error.code)
        )
          void load();
      } finally {
        setPendingKeys((current) => {
          const next = new Set(current);
          next.delete(key);
          return next;
        });
      }
    });
  }

  async function undoLatest(batchId: string) {
    await mutationQueue.current;
    try {
      const result = await api.undo(batchId);
      revisionRef.current = result.revision;
      for (const change of result.changes)
        updateLocalCollection(change.formId, change.categoryId, change.collected);
      setToast({ tone: 'info', message: 'Last checklist change undone.' });
    } catch (error) {
      setToast({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Undo was not available.',
      });
    }
  }

  async function changeWanted(item: CatalogItem, categoryId: TradeRequestTrait, wanted: boolean) {
    const previous = wantedRef.current.some(
      (entry) => entry.formId === item.id && entry.categoryId === categoryId && entry.wanted,
    );
    updateLocalWanted(item.id, categoryId, wanted);
    const operation = wantedMutationQueue.current.then(async () => {
      try {
        await api.setWanted({ formId: item.id, traitId: categoryId, wanted });
      } catch (error) {
        const current = wantedRef.current.some(
          (entry) => entry.formId === item.id && entry.categoryId === categoryId && entry.wanted,
        );
        if (current === wanted) updateLocalWanted(item.id, categoryId, previous);
        setToast({
          tone: 'error',
          message: error instanceof Error ? error.message : 'Wanted list was not changed.',
        });
      }
    });
    wantedMutationQueue.current = operation;
    await operation;
  }

  async function addTrade(input: {
    formId: string;
    traits: TradeOfferTrait[];
    quantity: number;
    notes: string;
  }) {
    try {
      const saved = await api.addTrade(input);
      setTradeSpecimens((current) => [saved, ...current]);
      setToast({ tone: 'success', message: 'Trade specimen saved with its combined traits.' });
    } catch (error) {
      setToast({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Trade specimen was not saved.',
      });
      throw error;
    }
  }

  async function deleteTrade(id: string) {
    try {
      await api.deleteTrade(id);
      setTradeSpecimens((current) => current.filter((trade) => trade.id !== id));
      setToast({ tone: 'info', message: 'Trade specimen removed.' });
    } catch (error) {
      setToast({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Trade specimen was not removed.',
      });
    }
  }

  async function applyImport(input: {
    csv: string;
    fileName: string;
    policy: import('../shared/csv').CsvImportPolicy;
  }) {
    const authoritative = await api.previewImport({
      csv: input.csv,
      sourceName: input.fileName,
      policy: input.policy,
    });
    if (!authoritative.jobId || authoritative.preview.summary.rejected > 0) {
      throw new Error(
        authoritative.preview.issues.find((issue) => issue.severity === 'error')?.message ??
          'The Worker rejected this import preview.',
      );
    }
    const result = await api.applyImport(authoritative.jobId);
    const refreshed = await api.bootstrap();
    adoptPayload(refreshed);
    setToast({
      tone: 'success',
      message: `Import applied: ${result.added} added, ${result.removed} removed.`,
      batchId: result.batchId ?? undefined,
    });
  }

  async function unlock(token: string) {
    saveAccessToken(token);
    const payload = await api.bootstrap(token);
    adoptPayload(payload);
    setAccessDialogOpen(false);
  }

  const collectedKeys = useMemo(
    () =>
      new Set(
        collectionEntries
          .filter((entry) => entry.collected)
          .map((entry) => collectionKey(entry.formId, entry.categoryId)),
      ),
    [collectionEntries],
  );
  const wantedFormIds = useMemo(
    () => new Set(wantedEntries.filter((entry) => entry.wanted).map((entry) => entry.formId)),
    [wantedEntries],
  );

  if (status === 'loading') return <LoadingScreen />;
  if (status === 'locked')
    return (
      <>
        <div className="locked-screen">
          <AppBrand />
          <p>Private collection access is required.</p>
        </div>
        <AccessDialog open message={loadMessage} onSubmit={unlock} />
      </>
    );
  if (status === 'error' || !bootstrap)
    return <ErrorScreen message={loadMessage} onRetry={() => void load()} />;

  const progress = progressForCategory(bootstrap.catalog, collectionEntries, activeCategory);
  const defaultCatalog = bootstrap.catalog.filter((item) => item.isDefault);
  const regions = [...new Set(defaultCatalog.map((item) => item.region))];
  const generations = [...new Set(defaultCatalog.map((item) => item.generation))].sort(
    (a, b) => a - b,
  );
  const types = [...new Set(defaultCatalog.flatMap((item) => item.types))].sort();
  const filtered = defaultCatalog.filter((item) => {
    const normalizedQuery = query.trim().toLowerCase();
    if (
      normalizedQuery &&
      !item.name.toLowerCase().includes(normalizedQuery) &&
      !String(item.dexNumber).includes(normalizedQuery)
    )
      return false;
    if (generation !== 'all' && item.generation !== Number(generation)) return false;
    if (region !== 'all' && item.region !== region) return false;
    if (type !== 'all' && !item.types.includes(type)) return false;
    const state = deriveCollectionState(
      item.rules[activeCategory] ?? 'unknown',
      collectedKeys.has(collectionKey(item.id, activeCategory)),
    );
    if (collectionFilter === 'missing' && state !== 'missing') return false;
    if (collectionFilter === 'collected' && state !== 'collected') return false;
    if (collectionFilter === 'available' && !['missing', 'collected'].includes(state)) return false;
    return true;
  });
  const activeCategoryLabel =
    bootstrap.categories.find((category) => category.id === activeCategory)?.label ??
    activeCategory;

  return (
    <div className="app-shell">
      <aside className="desktop-sidebar">
        <AppBrand />
        <nav aria-label="Primary navigation">
          {routes.map((item) => (
            <button
              type="button"
              key={item.id}
              className={route === item.id ? 'is-active' : ''}
              onClick={() => navigate(item.id)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {route === item.id && <i />}
            </button>
          ))}
        </nav>
        <div className="sidebar-card">
          <span>
            <Icon name="shield" />
          </span>
          <strong>Private by default</strong>
          <p>{bootstrap.authMode === 'local' ? 'Local D1 session' : 'Access-key session'}</p>
        </div>
        <p className="sidebar-foot">
          Unofficial fan project
          <br />
          Catalog {bootstrap.catalogVersion}
        </p>
      </aside>

      <div className="app-stage">
        <header className="mobile-topbar">
          <AppBrand compact />
          <button
            type="button"
            className="avatar-button"
            onClick={() => navigate('profile')}
            aria-label="Open profile"
          >
            <span>LT</span>
            <i />
          </button>
        </header>
        <main>
          {route === 'dex' && (
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

              <section
                className="progress-card"
                style={{ '--progress': `${progress.percentage * 3.6}deg` } as CSSProperties}
              >
                <div className="progress-ring">
                  <div>
                    <strong>{progress.percentage}%</strong>
                    <span>complete</span>
                  </div>
                </div>
                <div className="progress-copy">
                  <span className="eyebrow">{activeCategoryLabel} Dex</span>
                  <h2>
                    {progress.collected}
                    <span> / {progress.total}</span>
                  </h2>
                  <p>
                    {progress.missing} missing ·{' '}
                    {progress.unreleased + progress.ineligible + progress.unknown} unavailable or
                    uncataloged
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Open Search Lab for this category"
                  onClick={() => navigate('search')}
                >
                  <Icon name="search" />
                  <span>Find missing</span>
                  <Icon name="chevron-right" />
                </button>
              </section>

              <div className="category-scroller" role="toolbar" aria-label="Collection category">
                {bootstrap.categories.map((category) => (
                  <button
                    type="button"
                    key={category.id}
                    className={activeCategory === category.id ? 'is-active' : ''}
                    aria-pressed={activeCategory === category.id}
                    onClick={() => changeCategory(category.id)}
                  >
                    <span>{categoryGlyphs[category.id]}</span>
                    {category.shortLabel ?? category.label}
                  </button>
                ))}
              </div>

              {quickCheck && (
                <div className="quick-banner" role="status">
                  <span>
                    <Icon name="check" />
                  </span>
                  <div>
                    <strong>Quick Check is on</strong>
                    <p>
                      Card taps now change {activeCategoryLabel} state. Every saved tap can be
                      undone.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setQuickCheck(false)}
                    aria-label="Turn off Quick Check"
                  >
                    <Icon name="close" />
                  </button>
                </div>
              )}

              <section className="dex-controls" aria-label="Pokédex filters">
                <label className="search-field">
                  <Icon name="search" />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Name or Pokédex number"
                    aria-label="Search Pokémon"
                  />
                  {query && (
                    <button type="button" onClick={() => setQuery('')} aria-label="Clear search">
                      <Icon name="close" />
                    </button>
                  )}
                </label>
                <div className="filter-row">
                  <label>
                    <Icon name="filter" />
                    <select
                      aria-label="Generation"
                      value={generation}
                      onChange={(event) => setGeneration(event.target.value)}
                    >
                      <option value="all">All generations</option>
                      {generations.map((value) => (
                        <option value={value} key={value}>
                          Gen {value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <select
                      aria-label="Region"
                      value={region}
                      onChange={(event) => setRegion(event.target.value)}
                    >
                      <option value="all">All regions</option>
                      {regions.map((value) => (
                        <option value={value} key={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <select
                      aria-label="Type"
                      value={type}
                      onChange={(event) => setType(event.target.value)}
                    >
                      <option value="all">All types</option>
                      {types.map((value) => (
                        <option value={value} key={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="state-filter" aria-label="Collection state">
                  {(['all', 'missing', 'collected', 'available'] as const).map((value) => (
                    <button
                      type="button"
                      key={value}
                      aria-pressed={collectionFilter === value}
                      onClick={() => setCollectionFilter(value)}
                    >
                      {value === 'all' ? 'All' : value[0]?.toUpperCase() + value.slice(1)}
                    </button>
                  ))}
                </div>
              </section>

              <div className="grid-heading">
                <div>
                  <h2>{activeCategoryLabel} collection</h2>
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
                onOpen={setSelected}
                onToggle={(item, value) => changeCollection(item, activeCategory, value)}
              />
            </section>
          )}
          {route === 'trade' && (
            <TradePage
              catalog={bootstrap.catalog}
              collectionEntries={collectionEntries}
              wantedEntries={wantedEntries}
              tradeSpecimens={tradeSpecimens}
              onOpen={setSelected}
              onCollectionChange={(item, categoryId, value) =>
                changeCollection(item, categoryId, value)
              }
              onWantedChange={changeWanted}
            />
          )}
          {route === 'search' && (
            <SearchLab
              catalog={bootstrap.catalog}
              entries={collectionEntries}
              wantedEntries={wantedEntries}
              categories={bootstrap.categories}
              activeCategory={activeCategory}
              onCategoryChange={changeCategory}
            />
          )}
          {route === 'profile' && (
            <DataPage
              catalog={bootstrap.catalog}
              collectionEntries={collectionEntries}
              catalogVersion={bootstrap.catalogVersion}
              authMode={bootstrap.authMode}
              onUnlock={() => setAccessDialogOpen(true)}
              onImport={applyImport}
            />
          )}
        </main>

        <nav className="bottom-nav" aria-label="Primary navigation">
          {routes.map((item) => (
            <button
              type="button"
              key={item.id}
              className={route === item.id ? 'is-active' : ''}
              aria-current={route === item.id ? 'page' : undefined}
              onClick={() => navigate(item.id)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {selected && (
        <DetailSheet
          item={selected}
          catalog={bootstrap.catalog}
          categories={bootstrap.categories}
          collectionEntries={collectionEntries}
          wantedEntries={wantedEntries}
          tradeSpecimens={tradeSpecimens}
          pendingKeys={pendingKeys}
          onClose={() => setSelected(null)}
          onNavigate={setSelected}
          onCollectionChange={changeCollection}
          onWantedChange={changeWanted}
          onAddTrade={addTrade}
          onDeleteTrade={deleteTrade}
        />
      )}
      {toast && (
        <div className={`toast toast--${toast.tone}`} role="status">
          <span>
            <Icon
              name={
                toast.tone === 'error' ? 'wifi-off' : toast.tone === 'success' ? 'check' : 'undo'
              }
            />
          </span>
          <p>{toast.message}</p>
          {toast.batchId && (
            <button type="button" onClick={() => void undoLatest(toast.batchId!)}>
              <Icon name="undo" /> Undo
            </button>
          )}
          <button
            type="button"
            className="toast__close"
            onClick={() => setToast(null)}
            aria-label="Dismiss"
          >
            <Icon name="close" />
          </button>
        </div>
      )}
      <AccessDialog
        open={accessDialogOpen}
        onClose={() => setAccessDialogOpen(false)}
        onSubmit={unlock}
      />
    </div>
  );
}
