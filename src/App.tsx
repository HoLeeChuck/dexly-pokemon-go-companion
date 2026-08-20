import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type {
  CatalogItem,
  CategoryId,
  CollectionEntry,
  PublicCatalogPayload,
  TradeRequestTrait,
  TradeSpecimen,
  WantedEntry,
} from '../shared/types';
import { Icon } from './components/Icon';
import { HomeDashboard } from './components/HomeDashboard';
import { ApiClientError, saveAccessToken, storedAccessToken } from './lib/api/request';
import { fetchPublicCatalog } from './lib/api/publicCatalogApi';
import { setCloudCollection, undoCloudMutation } from './lib/api/collectionApi';
import type { BootstrapResponse } from './lib/api/ownerApi';
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
import { PRIMARY_ROUTES, type RouteId } from './app/routing';
import { useAppNavigation } from './app/useAppNavigation';
import { usePwaUpdates } from './app/usePwaUpdates';
import { APP_VERSION, PORTFOLIO_URL } from './config/app';

type StorageMode = 'browser' | 'cloud';
type Theme = 'light' | 'dark';

const DexRoute = lazy(() => import('./routes/DexRoute'));
const ProgressPage = lazy(() =>
  import('./components/SearchLab').then((module) => ({ default: module.ProgressPage })),
);
const SearchLabPage = lazy(() =>
  import('./components/SearchLab').then((module) => ({ default: module.SearchLabPage })),
);
const DataPage = lazy(() =>
  import('./components/DataPage').then((module) => ({ default: module.DataPage })),
);
const DetailSheet = lazy(() =>
  import('./components/DetailSheet').then((module) => ({ default: module.DetailSheet })),
);
const OwnerAccessDialog = lazy(() =>
  import('./owner/OwnerAccessDialog').then((module) => ({ default: module.OwnerAccessDialog })),
);

function collectionKey(formId: string, categoryId: CategoryId): string {
  return `${formId}:${categoryId}`;
}

function readLocalSetting(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
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
      dialog.querySelector<HTMLElement>('.mobile-nav-panel')?.focus({ preventScroll: true }),
    );
    return () => {
      document.body.classList.remove('scroll-locked');
    };
  }, [open]);

  function closeMenu(restoreTriggerFocus = false) {
    setOpen(false);
    if (restoreTriggerFocus) window.requestAnimationFrame(() => triggerRef.current?.focus());
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
          closeMenu(true);
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
              onClick={(event) => closeMenu(event.detail === 0)}
            >
              <Icon name="close" />
            </button>
            <nav
              id="mobile-primary-menu"
              className="mobile-nav-panel"
              aria-label="Primary navigation"
              tabIndex={-1}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mobile-nav-panel__heading">
                <span className="eyebrow">Navigation</span>
                <strong>Where would you like to go?</strong>
              </div>
              {PRIMARY_ROUTES.map((item) => (
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
              <footer className="mobile-nav-footer">
                <button
                  type="button"
                  className={route === 'settings' || route === 'owner' ? 'is-active' : ''}
                  aria-current={route === 'settings' || route === 'owner' ? 'page' : undefined}
                  onClick={() => navigate('settings')}
                >
                  <span>
                    <Icon name="settings" />
                  </span>
                  <strong>Settings</strong>
                  <Icon name="chevron-right" />
                </button>
                <p>CatchGrid v{APP_VERSION}</p>
                <a href={PORTFOLIO_URL} target="_blank" rel="noreferrer">
                  Cody Johnson · Portfolio
                </a>
              </footer>
            </nav>
          </>
        )}
      </dialog>
    </>
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
  const { route, navigate } = useAppNavigation();
  const { updateReady, dismissUpdate, applyUpdate } = usePwaUpdates();
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
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [collectionEntries, setCollectionEntries] = useState<CollectionEntry[]>([]);
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
        const { fetchOwnerBootstrap } = await import('./lib/api/ownerApi');
        adoptCloudPayload(await fetchOwnerBootstrap(token));
        return;
      }
      const catalogPayload = await fetchPublicCatalog();
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
          const { fetchOwnerBootstrap } = await import('./lib/api/ownerApi');
          const legacy = await fetchOwnerBootstrap(token);
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
          adoptPayload(await fetchPublicCatalog());
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
          const result = await setCloudCollection({
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

  async function setRegionNormal(region: string, collected: boolean): Promise<number> {
    if (storageMode !== 'browser' || !bootstrap) return 0;
    const targets = bootstrap.catalog.filter(
      (item) => item.isDefault && item.region === region && item.rules.normal === 'released',
    );
    const targetIds = new Set(targets.map((item) => item.id));
    let next = collectionRef.current.filter(
      (entry) => !(entry.categoryId === 'normal' && targetIds.has(entry.formId)),
    );
    if (collected) {
      next = [
        ...next,
        ...targets.map((item) => ({
          formId: item.id,
          categoryId: 'normal' as const,
          collected: true as const,
        })),
      ];
    }
    const changed = targets.filter((item) =>
      collected
        ? !collectionRef.current.some(
            (entry) => entry.formId === item.id && entry.categoryId === 'normal' && entry.collected,
          )
        : collectionRef.current.some(
            (entry) => entry.formId === item.id && entry.categoryId === 'normal' && entry.collected,
          ),
    ).length;
    const saved = persistLocalState(next, revisionRef.current + 1, `Before updating ${region}`);
    if (!saved.ok) throw saved.error;
    collectionRef.current = [
      ...saved.profile.collectionEntries,
      ...saved.profile.formCollectionEntries,
    ];
    revisionRef.current = saved.profile.revision;
    setCollectionEntries(collectionRef.current);
    return changed;
  }

  async function undoLatest(batchId: string) {
    await mutationQueue.current;
    if (storageMode === 'cloud') {
      try {
        const result = await undoCloudMutation(batchId);
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
      const { applyCloudImport, fetchOwnerBootstrap, previewCloudImport } =
        await import('./lib/api/ownerApi');
      const authoritative = await previewCloudImport({
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
      const result = await applyCloudImport(authoritative.jobId);
      adoptCloudPayload(await fetchOwnerBootstrap());
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
    const { fetchOwnerBootstrap } = await import('./lib/api/ownerApi');
    const payload = await fetchOwnerBootstrap(token);
    adoptCloudPayload(payload);
    setAccessDialogOpen(false);
  }

  async function leaveCloud() {
    saveAccessToken('');
    setStorageMode('browser');
    adoptPayload(await fetchPublicCatalog());
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

  if (status === 'loading') return <LoadingScreen />;
  if (status === 'locked')
    return (
      <>
        <div className="locked-screen">
          <AppBrand />
          <p>Private collection access is required.</p>
        </div>
        <Suspense fallback={null}>
          <OwnerAccessDialog open message={loadMessage} onSubmit={unlock} />
        </Suspense>
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

  const legacyOrigin = window.location.hostname.endsWith('.workers.dev');
  const recoverySnapshots = storageMode === 'browser' ? listLocalProfileSnapshots() : [];

  return (
    <div className="app-shell">
      <aside className="desktop-sidebar">
        <AppBrand onHome={() => navigate('home')} />
        <nav aria-label="Primary navigation">
          {PRIMARY_ROUTES.map((item) => (
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
        <div className="sidebar-secondary">
          <button
            type="button"
            className={route === 'settings' || route === 'owner' ? 'is-active' : ''}
            onClick={() => navigate('settings')}
          >
            <Icon name="settings" />
            <span>Settings</span>
            {(route === 'settings' || route === 'owner') && <i />}
          </button>
          <p className="sidebar-foot">CatchGrid v{APP_VERSION}</p>
          <a href={PORTFOLIO_URL} target="_blank" rel="noreferrer">
            Cody Johnson · Portfolio
          </a>
        </div>
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
          <Suspense fallback={<LoadingScreen />}>
            {route === 'home' && (
              <HomeDashboard
                catalog={bootstrap.catalog}
                categories={bootstrap.categories}
                entries={collectionEntries}
                onNavigate={navigate}
              />
            )}
            {route === 'progress' && (
              <ProgressPage
                catalog={bootstrap.catalog}
                entries={collectionEntries}
                categories={bootstrap.categories}
                onOpen={setSelected}
              />
            )}
            {route === 'search' && (
              <SearchLabPage
                catalog={bootstrap.catalog}
                entries={collectionEntries}
                categories={bootstrap.categories}
              />
            )}
            {route === 'dex' && (
              <DexRoute
                catalog={bootstrap.catalog}
                categories={bootstrap.categories}
                entries={collectionEntries}
                wantedEntries={wantedEntries}
                activeCategory={activeCategory}
                pendingKeys={pendingKeys}
                onCategoryChange={changeCategory}
                onOpen={setSelected}
                onCollectionChange={(item, value) => changeCollection(item, activeCategory, value)}
              />
            )}
            {(route === 'settings' || route === 'owner') && (
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
                onSetRegionNormal={setRegionNormal}
              />
            )}
          </Suspense>
        </main>
      </div>

      {selected && (
        <Suspense fallback={null}>
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
        </Suspense>
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
      {accessDialogOpen && (
        <Suspense fallback={null}>
          <OwnerAccessDialog open onClose={() => setAccessDialogOpen(false)} onSubmit={unlock} />
        </Suspense>
      )}
      {updateReady && (
        <aside className="update-prompt" role="status" aria-live="polite">
          <Icon name="refresh" />
          <div>
            <strong>A CatchGrid update is ready</strong>
            <p>Apply it now to use the newest catalog and app fixes.</p>
          </div>
          <button type="button" className="button button--primary" onClick={applyUpdate}>
            Update now
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Dismiss update"
            onClick={dismissUpdate}
          >
            <Icon name="close" />
          </button>
        </aside>
      )}
    </div>
  );
}
