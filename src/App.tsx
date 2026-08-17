import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { deriveCollectionState } from '../shared/domain';
import type {
  CatalogItem,
  CategoryId,
  CollectionEntry,
  PublicCatalogPayload,
  TradeRequestTrait,
  TradeSpecimen,
  WantedEntry,
} from '../shared/types';
import { DataPage } from './components/DataPage';
import { DetailSheet } from './components/DetailSheet';
import { Icon, type IconName } from './components/Icon';
import { PokemonGrid } from './components/PokemonGrid';
import { HomeDashboard } from './components/HomeDashboard';
import { SearchLab } from './components/SearchLab';
import {
  ApiClientError,
  api,
  saveAccessToken,
  storedAccessToken,
  type BootstrapResponse,
} from './lib/api';
import {
  applyLocalCsvImport,
  emptyLocalProfile,
  listLocalProfileSnapshots,
  loadLocalProfileResult,
  resetCorruptLocalProfile,
  restoreLocalProfileSnapshot,
  saveLocalProfileSafely,
  updateLocalProfileSettings,
  type LocalProfile,
  type LocalProfileLoadResult,
} from './lib/localProfile';
import { createPortableProfileBackupJson, restorePortableProfileBackup } from './lib/profileBackup';
import { catalogDisplayName } from './lib/catalogDisplay';
import type { AccentTheme } from './lib/theme';
import { previewCanonicalWideCsv } from '../shared/csv';
import regionMedalPolicy from '../catalog/region-medals.v1.json';

type PublicRouteId = 'home' | 'dex' | 'search' | 'profile';
type RouteId = PublicRouteId | 'owner';
type CollectionFilter = 'all' | 'missing' | 'collected';
type DexView = 'species' | 'mega' | 'gigantamax';
type MedalTier = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum';
type StorageMode = 'browser' | 'cloud';
type Theme = 'light' | 'dark';

const REGION_MEDAL_REQUIREMENTS = Object.fromEntries(
  regionMedalPolicy.regions.map((region) => [
    region.label,
    { categoryThresholds: region.categoryThresholds, mark: region.mark },
  ]),
) as Record<
  string,
  {
    categoryThresholds: Record<
      CategoryId,
      { bronze: number; silver: number; gold: number; platinum: number }
    >;
    mark: string;
  }
>;

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
const routes: Array<{ id: PublicRouteId; label: string; icon: IconName }> = [
  { id: 'home', label: 'Home', icon: 'home' },
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

function routeFromLocation(): RouteId {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/cody') return 'owner';
  const value = window.location.hash.replace(/^#\/?/, '');
  return routes.some((route) => route.id === value) ? (value as RouteId) : 'home';
}

function urlForRoute(route: RouteId): string {
  return route === 'owner' ? '/cody' : `/#/${route}`;
}

function collectionKey(formId: string, categoryId: CategoryId): string {
  return `${formId}:${categoryId}`;
}

function titleCase(value: string): string {
  return value.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (letter) => letter.toUpperCase());
}

function readLocalSetting(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function medalTier(
  count: number,
  requirements: { bronze: number; silver: number; gold: number; platinum: number },
): MedalTier {
  if (count >= requirements.platinum) return 'platinum';
  if (count >= requirements.gold) return 'gold';
  if (count >= requirements.silver) return 'silver';
  if (count >= requirements.bronze) return 'bronze';
  return 'none';
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

function AppBrand({ compact = false, onHome }: { compact?: boolean; onHome?: () => void }) {
  const content = (
    <>
      <span className="app-brand__mark" aria-hidden="true">
        <span />
      </span>
      <span>
        <strong>CatchGrid</strong>
        {!compact && <small>collection companion</small>}
      </span>
    </>
  );
  if (onHome) {
    return (
      <button
        type="button"
        className={`app-brand app-brand--link${compact ? ' app-brand--compact' : ''}`}
        onClick={onHome}
        aria-label="Go to home page"
      >
        {content}
      </button>
    );
  }
  return <div className={`app-brand${compact ? ' app-brand--compact' : ''}`}>{content}</div>;
}

function MobileNavigationHeader({
  route,
  onNavigate,
}: {
  route: RouteId;
  onNavigate: (route: RouteId) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!open) {
      if (dialog.open) dialog.close();
      return;
    }
    if (!dialog.open) dialog.showModal();
    document.body.classList.add('scroll-locked');
    window.requestAnimationFrame(() =>
      dialog.querySelector<HTMLButtonElement>('nav button')?.focus(),
    );
    return () => {
      document.body.classList.remove('scroll-locked');
    };
  }, [open]);

  function closeMenu() {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function navigate(nextRoute: RouteId) {
    closeMenu();
    onNavigate(nextRoute);
  }

  return (
    <>
      <header className="mobile-topbar">
        <AppBrand compact onHome={() => navigate('home')} />
        <button
          ref={triggerRef}
          type="button"
          className="mobile-menu-button"
          aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
          aria-hidden={open || undefined}
          tabIndex={open ? -1 : 0}
          aria-expanded={open}
          aria-controls="mobile-primary-menu"
          onClick={() => setOpen((value) => !value)}
        >
          <Icon name={open ? 'close' : 'menu'} />
        </button>
      </header>
      <dialog
        ref={dialogRef}
        className="mobile-nav-overlay"
        aria-label="CatchGrid navigation"
        onCancel={(event) => {
          event.preventDefault();
          closeMenu();
        }}
        onClick={(event) => {
          if (event.target === dialogRef.current) closeMenu();
        }}
      >
        {open && (
          <>
            <button
              type="button"
              className="mobile-menu-button mobile-nav-close"
              aria-label="Close navigation menu"
              onClick={closeMenu}
            >
              <Icon name="close" />
            </button>
            <nav
              id="mobile-primary-menu"
              className="mobile-nav-panel"
              aria-label="Primary navigation"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mobile-nav-panel__heading">
                <span className="eyebrow">Pokémon GO collection companion</span>
                <strong>Explore CatchGrid</strong>
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
          </>
        )}
      </dialog>
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
        <span className="eyebrow">Cody Cloud</span>
        <h2>Sign in to Cody Cloud</h2>
        <p>
          {message ??
            'Enter your private cloud access key. Public browser collections never require this key.'}
        </p>
        <label>
          <span className="visually-hidden">Username</span>
          <input
            className="visually-hidden"
            type="text"
            name="username"
            autoComplete="username"
            value="cody-cloud-owner"
            readOnly
            tabIndex={-1}
          />
          Cloud access key
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
          {submitting ? 'Checking…' : 'Connect Cody Cloud'}
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
      <h1>CatchGrid couldn’t load your collection.</h1>
      <p>{message}</p>
      <button className="button button--primary" type="button" onClick={onRetry}>
        <Icon name="refresh" /> Try again
      </button>
      <small>
        Your browser collection has not been erased. Retry when the catalog is available.
      </small>
    </div>
  );
}

function downloadText(name: string, value: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function RecoveryScreen({
  result,
  onRestored,
}: {
  result: LocalProfileLoadResult;
  onRestored: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const snapshots = listLocalProfileSnapshots();

  async function restore(file: File) {
    const restored = restorePortableProfileBackup(await file.text());
    if (!restored.ok) {
      setMessage(restored.error.message);
      return;
    }
    onRestored();
  }

  return (
    <main className="recovery-screen">
      <AppBrand />
      <span className="recovery-screen__icon">
        <Icon name="shield" />
      </span>
      <span className="eyebrow">Your data was preserved</span>
      <h1>CatchGrid found a damaged browser profile.</h1>
      <p>
        CatchGrid did not replace it with an empty collection. Download the preserved data for
        support, or restore a known-good CatchGrid JSON backup.
      </p>
      {result.recovery && (
        <button
          type="button"
          className="button button--secondary"
          onClick={() =>
            downloadText(
              `catchgrid-recovery-${new Date().toISOString().slice(0, 10)}.json`,
              result.recovery!.rawPayload,
            )
          }
        >
          <Icon name="download" /> Download preserved data
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void restore(file);
        }}
      />
      <button
        type="button"
        className="button button--primary"
        onClick={() => inputRef.current?.click()}
      >
        <Icon name="upload" /> Restore portable backup
      </button>
      {snapshots.length > 0 && (
        <section className="recovery-screen__snapshots" aria-labelledby="recovery-snapshots-title">
          <h2 id="recovery-snapshots-title">Browser recovery snapshots</h2>
          {snapshots.map((snapshot) => (
            <article key={snapshot.id}>
              <span>
                <strong>{new Date(snapshot.createdAt).toLocaleString()}</strong>
                <small>{snapshot.reason}</small>
              </span>
              <button
                type="button"
                className="button button--secondary"
                onClick={() => {
                  const restored = restoreLocalProfileSnapshot(snapshot.id);
                  if (!restored.ok) setMessage(restored.error.message);
                  else onRestored();
                }}
              >
                Restore
              </button>
            </article>
          ))}
        </section>
      )}
      <details className="recovery-reset">
        <summary>Start over only if recovery is impossible</summary>
        <p>This permanently replaces the damaged primary profile with an empty collection.</p>
        <button
          type="button"
          className="button button--danger"
          onClick={() => {
            const reset = resetCorruptLocalProfile();
            if (!reset.ok) setMessage(reset.error.message);
            else onRestored();
          }}
        >
          Reset browser collection
        </button>
      </details>
      {message && <p role="alert">{message}</p>}
      <small>{result.recovery?.reason}</small>
    </main>
  );
}

export default function App() {
  const [route, setRoute] = useState<RouteId>(routeFromLocation);
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'locked' | 'error' | 'recovery'>(
    'loading',
  );
  const [localLoadResult, setLocalLoadResult] = useState<LocalProfileLoadResult | null>(null);
  const [loadMessage, setLoadMessage] = useState('');
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [storageMode, setStorageMode] = useState<StorageMode>(() =>
    storedAccessToken() ? 'cloud' : 'browser',
  );
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = readLocalSetting('dexly:theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [accentTheme, setAccentTheme] = useState<AccentTheme>(() => {
    const saved = readLocalSetting('dexly:accent-theme');
    return ['green', 'blue', 'purple', 'red', 'orange', 'pink'].includes(saved ?? '')
      ? (saved as AccentTheme)
      : 'green';
  });
  const [activeCategory, setActiveCategory] = useState<CategoryId>(() => {
    const saved = readLocalSetting('dexly:active-category') as CategoryId | null;
    return saved &&
      ['normal', 'shiny', 'lucky', 'hundo', 'xxl', 'xxs', 'shadow', 'purified'].includes(saved)
      ? saved
      : 'normal';
  });
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('all');
  const [collectionFilter, setCollectionFilter] = useState<CollectionFilter>('all');
  const [dexView, setDexView] = useState<DexView>('species');
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [regionPickerOpen, setRegionPickerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickCheck, setQuickCheck] = useState(false);
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [collectionEntries, setCollectionEntries] = useState<CollectionEntry[]>([]);
  const [updateReady, setUpdateReady] = useState(false);
  const [wantedEntries, setWantedEntries] = useState<WantedEntry[]>([]);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<ToastState | null>(null);
  const revisionRef = useRef(0);
  const collectionRef = useRef<CollectionEntry[]>([]);
  const wantedRef = useRef<WantedEntry[]>([]);
  const tradeRef = useRef<TradeSpecimen[]>([]);
  const localProfileRef = useRef<LocalProfile>(emptyLocalProfile());
  const undoRef = useRef(
    new Map<string, { formId: string; categoryId: CategoryId; previous: boolean }>(),
  );
  const mutationQueue = useRef<Promise<void>>(Promise.resolve());
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollPositions = useRef<Record<RouteId, number>>({
    home: 0,
    dex: 0,
    search: 0,
    profile: 0,
    owner: 0,
  });

  function adoptPayload(payload: PublicCatalogPayload, result = loadLocalProfileResult()) {
    setLocalLoadResult(result);
    const local = result.profile;
    const localEntries = [...local.collectionEntries, ...local.formCollectionEntries];
    const hydrated: BootstrapResponse = {
      ...payload,
      profileId: 'profile:browser-local',
      authMode: 'browser' as const,
      revision: local.revision,
      collectionEntries: localEntries,
      wantedEntries: local.wantedEntries,
      tradeSpecimens: local.tradeSpecimens,
    };
    if (result.status === 'corrupt') {
      setBootstrap(hydrated);
      setStatus('recovery');
      return;
    }
    setBootstrap(hydrated);
    localProfileRef.current = local;
    setCollectionEntries(localEntries);
    collectionRef.current = localEntries;
    setWantedEntries([...local.wantedEntries]);
    wantedRef.current = [...local.wantedEntries];
    tradeRef.current = [...local.tradeSpecimens];
    revisionRef.current = local.revision;
    if (local.settings.theme) setTheme(local.settings.theme);
    if (local.settings.accentTheme) setAccentTheme(local.settings.accentTheme);
    if (local.settings.activeCategory) setActiveCategory(local.settings.activeCategory);
    if (result.status === 'migrated') {
      setToast({ tone: 'info', message: 'Your browser collection was upgraded safely.' });
    } else if (result.status === 'unavailable') {
      setToast({
        tone: 'error',
        message: result.warnings[0] ?? 'Browser storage is unavailable. Changes cannot be saved.',
      });
    }
    setStatus('ready');
  }

  function adoptCloudPayload(payload: BootstrapResponse) {
    setBootstrap(payload);
    setCollectionEntries([...payload.collectionEntries]);
    collectionRef.current = [...payload.collectionEntries];
    setWantedEntries([...payload.wantedEntries]);
    wantedRef.current = [...payload.wantedEntries];
    tradeRef.current = [...payload.tradeSpecimens];
    revisionRef.current = payload.revision;
    const local = loadLocalProfileResult();
    if (local.status !== 'corrupt') {
      localProfileRef.current = local.profile;
    }
    setStorageMode('cloud');
    setStatus('ready');
  }

  function localProfileWithEntries(entries: readonly CollectionEntry[], revision: number) {
    const defaultFormIds = new Set(
      bootstrap?.catalog.filter((item) => item.isDefault).map((item) => item.id) ?? [],
    );
    return {
      ...localProfileRef.current,
      revision,
      catalogVersion: bootstrap?.catalogVersion,
      collectionEntries: entries.filter((entry) => defaultFormIds.has(entry.formId)),
      formCollectionEntries: entries
        .filter((entry) => !defaultFormIds.has(entry.formId))
        .filter(
          (entry): entry is typeof entry & { categoryId: 'normal' | 'shiny' } =>
            entry.categoryId === 'normal' || entry.categoryId === 'shiny',
        ),
      wantedEntries: wantedRef.current,
      tradeSpecimens: tradeRef.current,
    } satisfies LocalProfile;
  }

  function persistLocalState(
    entries = collectionRef.current,
    revision = revisionRef.current,
    reason = 'Before a collection update',
  ) {
    const saved = saveLocalProfileSafely(localProfileWithEntries(entries, revision), {
      snapshotReason: reason,
    });
    if (!saved.ok) return saved;
    localProfileRef.current = saved.profile;
    return saved;
  }

  async function load(token = storedAccessToken()) {
    setStatus('loading');
    setLoadMessage('');
    try {
      if (storageMode === 'cloud' && token) {
        adoptCloudPayload(await api.bootstrap(token));
        return;
      }
      const catalogPayload = await api.catalog();
      const localResult = loadLocalProfileResult();
      const local = localResult.profile;
      const hasLocalState =
        local.revision > 0 ||
        local.collectionEntries.length > 0 ||
        local.formCollectionEntries.length > 0 ||
        local.savedSearches.length > 0 ||
        local.wantedEntries.length > 0 ||
        local.tradeSpecimens.length > 0;
      if (!hasLocalState && token) {
        try {
          const legacy = await api.bootstrap(token);
          const migrated = {
            ...local,
            revision: legacy.revision,
            collectionEntries: [...legacy.collectionEntries],
            wantedEntries: [...legacy.wantedEntries],
            tradeSpecimens: [...legacy.tradeSpecimens],
          };
          saveLocalProfileSafely(migrated, { snapshotReason: 'Before Cody Cloud migration' });
        } catch {
          // A stale legacy key must not prevent the browser-local collection from opening.
        }
      }
      adoptPayload(catalogPayload, localResult);
    } catch (error) {
      if (
        error instanceof ApiClientError &&
        ['AUTH_REQUIRED', 'PRIVATE_API_NOT_CONFIGURED'].includes(error.code)
      ) {
        saveAccessToken('');
        setStorageMode('browser');
        try {
          adoptPayload(await api.catalog());
          setToast({
            tone: 'info',
            message: "Your Cody Cloud session expired. This browser's collection is still here.",
          });
        } catch (catalogError) {
          setStatus('error');
          setLoadMessage(
            catalogError instanceof Error
              ? catalogError.message
              : 'The Pokédex catalog could not be loaded.',
          );
        }
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
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('dexly:theme', theme);
    } catch {
      // The profile UI reports storage failures; appearance still works for this session.
    }
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#071c19' : '#0c2723');
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.accent = accentTheme;
    try {
      localStorage.setItem('dexly:accent-theme', accentTheme);
    } catch {
      // The profile UI reports storage failures; appearance still works for this session.
    }
  }, [accentTheme]);

  useEffect(() => {
    const onUpdateReady = () => setUpdateReady(true);
    window.addEventListener('catchgrid:update-ready', onUpdateReady);
    return () => window.removeEventListener('catchgrid:update-ready', onUpdateReady);
  }, []);

  useEffect(() => {
    const onLocationChange = () => setRoute(routeFromLocation());
    window.addEventListener('hashchange', onLocationChange);
    window.addEventListener('popstate', onLocationChange);
    return () => {
      window.removeEventListener('hashchange', onLocationChange);
      window.removeEventListener('popstate', onLocationChange);
    };
  }, []);

  function navigate(next: RouteId) {
    scrollPositions.current[route] = window.scrollY;
    setRoute(next);
    window.history.pushState(null, '', urlForRoute(next));
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
    if (storageMode === 'browser' && status === 'ready') {
      const saved = updateLocalProfileSettings(localProfileRef.current, {
        activeCategory: value,
      });
      if (!saved.ok) {
        setToast({ tone: 'error', message: saved.error.message });
        return;
      }
      localProfileRef.current = saved.profile;
    }
    setActiveCategory(value);
    setCategoryPickerOpen(false);
  }

  function changeRegion(value: string) {
    setRegion(value);
    setRegionPickerOpen(false);
  }

  function changeTheme(value: Theme) {
    if (storageMode !== 'browser' || status !== 'ready') {
      setTheme(value);
      return;
    }
    const saved = updateLocalProfileSettings(localProfileRef.current, { theme: value });
    if (saved.ok) {
      localProfileRef.current = saved.profile;
      setTheme(value);
    } else setToast({ tone: 'error', message: saved.error.message });
  }

  function changeAccentTheme(value: AccentTheme) {
    if (storageMode !== 'browser' || status !== 'ready') {
      setAccentTheme(value);
      return;
    }
    const saved = updateLocalProfileSettings(localProfileRef.current, { accentTheme: value });
    if (saved.ok) {
      localProfileRef.current = saved.profile;
      setAccentTheme(value);
    } else setToast({ tone: 'error', message: saved.error.message });
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

    if (storageMode === 'browser') {
      setPendingKeys((current) => new Set(current).add(key));
      mutationQueue.current = mutationQueue.current.then(async () => {
        const next = setEntryLocally(collectionRef.current, item.id, categoryId, desired);
        const nextRevision = revisionRef.current + 1;
        const displayName = catalogDisplayName(item);
        const saved = persistLocalState(next, nextRevision, `Before changing ${displayName}`);
        if (!saved.ok) {
          setToast({ tone: 'error', message: saved.error.message });
        } else {
          collectionRef.current = [
            ...saved.profile.collectionEntries,
            ...saved.profile.formCollectionEntries,
          ];
          setCollectionEntries(collectionRef.current);
          revisionRef.current = saved.profile.revision;
          const batchId = `local:${crypto.randomUUID()}`;
          undoRef.current.set(batchId, { formId: item.id, categoryId, previous });
          setToast({
            tone: 'success',
            message: `${displayName} marked ${desired ? 'collected' : 'missing'} in ${categoryId}.`,
            batchId,
          });
        }
        setPendingKeys((current) => {
          const remaining = new Set(current);
          remaining.delete(key);
          return remaining;
        });
      });
      return;
    }

    updateLocalCollection(item.id, categoryId, desired);
    setPendingKeys((current) => new Set(current).add(key));

    mutationQueue.current = mutationQueue.current.then(async () => {
      try {
        if (storageMode === 'cloud') {
          const result = await api.setCollection({
            formId: item.id,
            categoryId,
            collected: desired,
            operationId: `op:${crypto.randomUUID()}`,
            expectedRevision: revisionRef.current,
          });
          revisionRef.current = result.revision;
          if (
            desired &&
            (categoryId === 'xxl' || categoryId === 'xxs') &&
            wantedRef.current.some(
              (entry) =>
                entry.formId === item.id && entry.categoryId === categoryId && entry.wanted,
            )
          ) {
            updateLocalWanted(item.id, categoryId, false);
          }
          setToast({
            tone: 'success',
            message: `${catalogDisplayName(item)} synced ${desired ? 'collected' : 'missing'} in ${categoryId}.`,
            batchId: result.batchId ?? undefined,
          });
          return;
        }
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
    if (storageMode === 'cloud') {
      try {
        const result = await api.undo(batchId);
        revisionRef.current = result.revision;
        for (const change of result.changes)
          updateLocalCollection(change.formId, change.categoryId, change.collected);
        setToast({ tone: 'info', message: 'Last cloud change undone.' });
      } catch (error) {
        setToast({
          tone: 'error',
          message: error instanceof Error ? error.message : 'Cloud undo was not available.',
        });
      }
      return;
    }
    const change = undoRef.current.get(batchId);
    if (!change) {
      setToast({
        tone: 'error',
        message: 'Undo was not available.',
      });
      return;
    }
    const next = setEntryLocally(
      collectionRef.current,
      change.formId,
      change.categoryId,
      change.previous,
    );
    const saved = persistLocalState(next, revisionRef.current + 1, 'Before undoing a change');
    if (!saved.ok) {
      setToast({ tone: 'error', message: saved.error.message });
      return;
    }
    collectionRef.current = [
      ...saved.profile.collectionEntries,
      ...saved.profile.formCollectionEntries,
    ];
    setCollectionEntries(collectionRef.current);
    revisionRef.current = saved.profile.revision;
    undoRef.current.delete(batchId);
    setToast({ tone: 'info', message: 'Last checklist change undone.' });
  }

  async function applyImport(input: {
    csv: string;
    fileName: string;
    policy: import('../shared/csv').CsvImportPolicy;
  }) {
    if (!bootstrap) throw new Error('The catalog is not available.');
    if (storageMode === 'cloud') {
      const authoritative = await api.previewImport({
        csv: input.csv,
        sourceName: input.fileName,
        policy: input.policy,
      });
      if (!authoritative.jobId || authoritative.preview.summary.rejected > 0) {
        throw new Error(
          authoritative.preview.issues.find((issue) => issue.severity === 'error')?.message ??
            'The cloud import preview was rejected.',
        );
      }
      const result = await api.applyImport(authoritative.jobId);
      adoptCloudPayload(await api.bootstrap());
      setToast({
        tone: 'success',
        message: `Cloud import applied: ${result.added} added, ${result.removed} removed.`,
        batchId: result.batchId ?? undefined,
      });
      return;
    }
    const preview = previewCanonicalWideCsv(
      input.csv,
      bootstrap.catalog,
      collectionRef.current,
      input.policy,
    );
    if (preview.summary.rejected > 0) {
      throw new Error(
        preview.issues.find((issue) => issue.severity === 'error')?.message ??
          'The import contains unresolved entries.',
      );
    }
    const applied = applyLocalCsvImport(
      localProfileRef.current,
      preview,
      bootstrap.catalog,
      input.fileName,
    );
    if (!applied.ok) throw applied.error;
    localProfileRef.current = applied.profile;
    collectionRef.current = [
      ...applied.profile.collectionEntries,
      ...applied.profile.formCollectionEntries,
    ];
    setCollectionEntries(collectionRef.current);
    revisionRef.current = applied.profile.revision;
    setToast({
      tone: 'success',
      message: `Import applied: ${preview.summary.added} added, ${preview.summary.removed} removed.`,
    });
  }

  async function unlock(token: string) {
    saveAccessToken(token);
    const payload = await api.bootstrap(token);
    adoptCloudPayload(payload);
    setAccessDialogOpen(false);
  }

  async function leaveCloud() {
    saveAccessToken('');
    setStorageMode('browser');
    adoptPayload(await api.catalog());
    setToast({ tone: 'info', message: "Using this browser's local collection." });
  }

  function exportPortableBackup() {
    if (!bootstrap) return;
    try {
      const profile = localProfileWithEntries(collectionRef.current, revisionRef.current);
      downloadText(
        `catchgrid-backup-${new Date().toISOString().slice(0, 10)}.json`,
        createPortableProfileBackupJson(profile, bootstrap.catalogVersion),
      );
      setToast({ tone: 'success', message: 'Full portable backup exported.' });
    } catch (error) {
      setToast({
        tone: 'error',
        message: error instanceof Error ? error.message : 'The backup could not be created.',
      });
    }
  }

  function adoptRestoredLocalProfile(profile: LocalProfile) {
    localProfileRef.current = profile;
    collectionRef.current = [...profile.collectionEntries, ...profile.formCollectionEntries];
    setCollectionEntries(collectionRef.current);
    wantedRef.current = [...profile.wantedEntries];
    setWantedEntries(wantedRef.current);
    tradeRef.current = [...profile.tradeSpecimens];
    revisionRef.current = profile.revision;
    if (profile.settings.theme) setTheme(profile.settings.theme);
    if (profile.settings.accentTheme) setAccentTheme(profile.settings.accentTheme);
    if (profile.settings.activeCategory) setActiveCategory(profile.settings.activeCategory);
  }

  function restorePortableBackup(value: string) {
    if (storageMode === 'cloud') {
      setToast({
        tone: 'error',
        message: 'Return to this browser before restoring a local JSON backup.',
      });
      return;
    }
    const restored = restorePortableProfileBackup(value);
    if (!restored.ok) throw restored.error;
    adoptRestoredLocalProfile(restored.profile);
    setToast({
      tone: 'success',
      message: 'Portable backup restored. The previous profile was snapshotted.',
    });
  }

  function restoreSnapshot(snapshotId: string) {
    const restored = restoreLocalProfileSnapshot(snapshotId);
    if (!restored.ok) {
      setToast({ tone: 'error', message: restored.error.message });
      return;
    }
    adoptRestoredLocalProfile(restored.profile);
    setToast({ tone: 'success', message: 'Recovery snapshot restored.' });
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
  if (status === 'recovery' && localLoadResult)
    return (
      <RecoveryScreen
        result={localLoadResult}
        onRestored={() => {
          setStatus('loading');
          void load('');
        }}
      />
    );
  if (status === 'error' || !bootstrap)
    return <ErrorScreen message={loadMessage} onRetry={() => void load()} />;

  const defaultCatalog = bootstrap.catalog.filter((item) => item.isDefault);
  const viewedCatalog =
    dexView === 'species'
      ? defaultCatalog
      : bootstrap.catalog.filter((item) =>
          dexView === 'mega'
            ? item.variantKind === 'mega' || item.variantKind === 'primal'
            : item.variantKind === 'gigantamax',
        );
  const regions = [...new Set(defaultCatalog.map((item) => titleCase(item.region)))];
  const regionMedals = new Map(
    regions.map((regionName) => {
      const requirements = REGION_MEDAL_REQUIREMENTS[regionName];
      const categoryRequirements = requirements?.categoryThresholds[activeCategory];
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
          total: categoryRequirements?.platinum ?? regionItems.length,
          tier: categoryRequirements
            ? medalTier(collected, categoryRequirements)
            : ('none' as MedalTier),
          mark: requirements?.mark ?? regionName.slice(0, 1),
        },
      ] as const;
    }),
  );
  const filtered = viewedCatalog.filter((item) => {
    const normalizedQuery = query.trim().toLowerCase();
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
  const activeCategoryLabel =
    bootstrap.categories.find((category) => category.id === activeCategory)?.label ??
    activeCategory;
  const selectedRegionMedal = region === 'all' ? null : regionMedals.get(region);
  const legacyOrigin = window.location.hostname.endsWith('.workers.dev');
  const recoverySnapshots = storageMode === 'browser' ? listLocalProfileSnapshots() : [];

  return (
    <div className="app-shell">
      <aside className="desktop-sidebar">
        <AppBrand onHome={() => navigate('home')} />
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
        <button
          type="button"
          className="theme-toggle theme-toggle--desktop"
          onClick={() => changeTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={`Use ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-pressed={theme === 'dark'}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </button>
        <p className="sidebar-foot">
          Unofficial fan project
          <br />
          Catalog {bootstrap.catalogVersion}
        </p>
      </aside>

      <div className={`app-stage${route === 'dex' ? ' app-stage--dex' : ''}`}>
        <MobileNavigationHeader route={route} onNavigate={navigate} />
        {legacyOrigin && (
          <aside className="origin-migration-banner" role="status">
            <Icon name="shield" />
            <div>
              <strong>CatchGrid has moved to dex.cjdev.app</strong>
              <p>
                Browser collections are tied to this web address. Export a full backup here before
                opening the canonical site so your collection is not stranded.
              </p>
            </div>
            <button type="button" className="button button--primary" onClick={exportPortableBackup}>
              <Icon name="download" /> Export backup
            </button>
            <a className="button button--secondary" href="https://dex.cjdev.app/">
              Open canonical site
            </a>
          </aside>
        )}
        <main>
          {route === 'home' && (
            <HomeDashboard
              catalog={bootstrap.catalog}
              categories={bootstrap.categories}
              entries={collectionEntries}
            />
          )}
          {route === 'search' && (
            <SearchLab
              catalog={bootstrap.catalog}
              entries={collectionEntries}
              categories={bootstrap.categories}
            />
          )}
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
                        {bootstrap.categories
                          .filter(
                            (category) =>
                              dexView === 'species' ||
                              category.id === 'normal' ||
                              category.id === 'shiny',
                          )
                          .map((category) => (
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

                <div className="dex-results">
                  <div className="dex-view-switcher" role="group" aria-label="Pokédex view">
                    {(
                      [
                        ['species', 'National Dex'],
                        ['mega', 'Mega & Primal'],
                        ['gigantamax', 'Gigantamax'],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        type="button"
                        key={value}
                        aria-pressed={dexView === value}
                        onClick={() => {
                          setDexView(value);
                          if (value !== 'species' && !['normal', 'shiny'].includes(activeCategory))
                            changeCategory('normal');
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
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
                    onOpen={setSelected}
                    onToggle={(item, value) => changeCollection(item, activeCategory, value)}
                  />
                </div>
              </section>
            </section>
          )}
          {(route === 'profile' || route === 'owner') && (
            <DataPage
              catalog={bootstrap.catalog}
              collectionEntries={collectionEntries}
              catalogVersion={bootstrap.catalogVersion}
              storageMode={storageMode}
              theme={theme}
              accentTheme={accentTheme}
              showCloudAccess={route === 'owner'}
              onThemeChange={changeTheme}
              onAccentThemeChange={changeAccentTheme}
              onUnlock={() => setAccessDialogOpen(true)}
              onLeaveCloud={() => void leaveCloud()}
              onImport={applyImport}
              onExportBackup={exportPortableBackup}
              onRestoreBackup={restorePortableBackup}
              snapshots={recoverySnapshots}
              onRestoreSnapshot={restoreSnapshot}
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
          pendingKeys={pendingKeys}
          onClose={() => setSelected(null)}
          onNavigate={setSelected}
          onCollectionChange={changeCollection}
        />
      )}
      {toast && (
        <div
          className={`toast toast--${toast.tone}${toast.batchId ? ' toast--undo' : ''}`}
          role="status"
        >
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
      {updateReady && (
        <aside className="update-prompt" role="status" aria-live="polite">
          <Icon name="refresh" />
          <div>
            <strong>A CatchGrid update is ready</strong>
            <p>Apply it now to use the newest catalog and app fixes.</p>
          </div>
          <button
            type="button"
            className="button button--primary"
            onClick={() => window.dispatchEvent(new Event('catchgrid:apply-update'))}
          >
            Update now
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Dismiss update"
            onClick={() => setUpdateReady(false)}
          >
            <Icon name="close" />
          </button>
        </aside>
      )}
    </div>
  );
}
