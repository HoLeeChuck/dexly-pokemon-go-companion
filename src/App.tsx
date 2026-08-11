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
import {
  ApiClientError,
  api,
  saveAccessToken,
  storedAccessToken,
  type BootstrapResponse,
} from './lib/api';

type RouteId = 'dex' | 'search' | 'profile';
type CollectionFilter = 'all' | 'missing' | 'collected';
type MedalTier = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum';

const REGION_MEDAL_REQUIREMENTS: Record<
  string,
  { bronze: number; silver: number; gold: number; platinum: number; mark: string }
> = {
  Kanto: { bronze: 20, silver: 50, gold: 100, platinum: 151, mark: 'K' },
  Johto: { bronze: 5, silver: 30, gold: 70, platinum: 100, mark: 'J' },
  Hoenn: { bronze: 5, silver: 40, gold: 90, platinum: 135, mark: 'H' },
  Sinnoh: { bronze: 5, silver: 30, gold: 80, platinum: 107, mark: 'S' },
  Unova: { bronze: 5, silver: 50, gold: 100, platinum: 156, mark: 'U' },
  Kalos: { bronze: 5, silver: 20, gold: 50, platinum: 72, mark: 'K' },
  Alola: { bronze: 5, silver: 25, gold: 50, platinum: 86, mark: 'A' },
  Galar: { bronze: 5, silver: 25, gold: 50, platinum: 89, mark: 'G' },
  Hisui: { bronze: 1, silver: 3, gold: 5, platinum: 7, mark: 'H' },
  Paldea: { bronze: 5, silver: 30, gold: 80, platinum: 104, mark: 'P' },
};

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
const REGION_MEDAL_ASSET_ROOT =
  'https://raw.githubusercontent.com/PokeMiners/pogo_assets/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Badges/Achievements/';

const routes: Array<{ id: RouteId; label: string; icon: IconName }> = [
  { id: 'dex', label: 'Dex', icon: 'grid' },
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

function titleCase(value: string): string {
  return value.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (letter) => letter.toUpperCase());
}

function medalTier(
  count: number,
  requirements: (typeof REGION_MEDAL_REQUIREMENTS)[string],
): MedalTier {
  if (count >= requirements.platinum) return 'platinum';
  if (count >= requirements.gold) return 'gold';
  if (count >= requirements.silver) return 'silver';
  if (count >= requirements.bronze) return 'bronze';
  return 'none';
}

function RegionMedal({ region, tier }: { region?: string; tier: MedalTier | 'all' }) {
  const assetId = region ? REGION_MEDAL_ASSET_IDS[region] : undefined;
  const style = assetId
    ? ({
        '--region-medal-icon': `url("${REGION_MEDAL_ASSET_ROOT}Badge_${assetId}.png")`,
      } as CSSProperties)
    : undefined;
  return (
    <span className={`region-medal region-medal--${tier}`} style={style} aria-hidden="true">
      {assetId ? <i /> : '◎'}
    </span>
  );
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

function MobileNavigationHeader({
  route,
  onNavigate,
}: {
  route: RouteId;
  onNavigate: (route: RouteId) => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  function navigate(nextRoute: RouteId) {
    setOpen(false);
    onNavigate(nextRoute);
  }

  return (
    <>
      <header className="mobile-topbar">
        <AppBrand compact />
        <div className="mobile-topbar__actions">
          <button
            type="button"
            className="avatar-button"
            onClick={() => navigate('profile')}
            aria-label="Open profile"
          >
            <span>LT</span>
            <i />
          </button>
          <button
            type="button"
            className="mobile-menu-button"
            aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={open}
            aria-controls="mobile-primary-menu"
            onClick={() => setOpen((value) => !value)}
          >
            <Icon name={open ? 'close' : 'menu'} />
          </button>
        </div>
      </header>
      {open && (
        <div className="mobile-nav-overlay" onClick={() => setOpen(false)}>
          <nav
            id="mobile-primary-menu"
            className="mobile-nav-panel"
            aria-label="Primary navigation"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mobile-nav-panel__heading">
              <span className="eyebrow">South Minneapolis Nokomis Area</span>
              <strong>Explore Dexly</strong>
            </div>
            {routes.map((item) => (
              <button
                type="button"
                key={item.id}
                className={route === item.id ? 'is-active' : ''}
                aria-current={route === item.id ? 'page' : undefined}
                onClick={() => navigate(item.id)}
              >
                <span>
                  <Icon name={item.icon} />
                </span>
                <strong>{item.label}</strong>
                <Icon name="chevron-right" />
              </button>
            ))}
          </nav>
        </div>
      )}
    </>
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
  const [region, setRegion] = useState('all');
  const [collectionFilter, setCollectionFilter] = useState<CollectionFilter>('all');
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [regionPickerOpen, setRegionPickerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
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
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollPositions = useRef<Record<RouteId, number>>({
    dex: 0,
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

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  function changeCategory(value: CategoryId) {
    setActiveCategory(value);
    setCategoryPickerOpen(false);
    localStorage.setItem('dexly:active-category', value);
  }

  function changeRegion(value: string) {
    setRegion(value);
    setRegionPickerOpen(false);
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
  const regions = [...new Set(defaultCatalog.map((item) => titleCase(item.region)))];
  const regionMedals = new Map(
    regions.map((regionName) => {
      const requirements = REGION_MEDAL_REQUIREMENTS[regionName];
      const regionItems = defaultCatalog.filter((item) => titleCase(item.region) === regionName);
      const collected = new Set(
        regionItems
          .filter((item) => collectedKeys.has(collectionKey(item.id, activeCategory)))
          .map((item) => item.dexNumber),
      ).size;
      return [
        regionName,
        {
          collected,
          total: requirements?.platinum ?? regionItems.length,
          tier: requirements ? medalTier(collected, requirements) : ('none' as MedalTier),
          mark: requirements?.mark ?? regionName.slice(0, 1),
        },
      ] as const;
    }),
  );
  const filtered = defaultCatalog.filter((item) => {
    const normalizedQuery = query.trim().toLowerCase();
    if (
      normalizedQuery &&
      !item.name.toLowerCase().includes(normalizedQuery) &&
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
  const activeCategoryLabel =
    bootstrap.categories.find((category) => category.id === activeCategory)?.label ??
    activeCategory;
  const selectedRegionMedal = region === 'all' ? null : regionMedals.get(region);

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
        <MobileNavigationHeader route={route} onNavigate={navigate} />
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
                          <strong>{region === 'all' ? 'All regions' : titleCase(region)}</strong>
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
                        {regions.map((regionName) => {
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
                                <strong>{titleCase(regionName)}</strong>
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
                        {value === 'all' ? 'All' : value[0]?.toUpperCase() + value.slice(1)}
                      </button>
                    ))}
                  </div>
                </section>

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

                <div className="dex-results">
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
                </div>
              </section>
            </section>
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
