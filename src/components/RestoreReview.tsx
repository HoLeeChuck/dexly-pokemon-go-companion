/* eslint-disable react-refresh/only-export-components */
import type { LocalProfile, LocalProfileSnapshot } from '../lib/localProfile';
import { parsePortableProfileBackup, type PortableProfileBackup } from '../lib/profileBackup';
import { Icon } from './Icon';
import '../routes/profile.css';

export interface RestoreReviewSummary {
  sourceName: string;
  createdAt: string;
  catalogVersion?: string;
  catalogCompatibility: 'current' | 'different' | 'unknown';
  collectionRecords: number;
  savedSearches: number;
  wantedEntries: number;
  tradeSpecimens: number;
  settings: readonly string[];
}

export interface PortableBackupReview {
  raw: string;
  backup: PortableProfileBackup;
  summary: RestoreReviewSummary;
}

function settingLabels(profile: LocalProfile): string[] {
  const labels: Record<keyof LocalProfile['settings'], string> = {
    theme: 'light/dark mode',
    accentTheme: 'accent theme',
    activeCategory: 'active collection category',
    regionPreference: 'regional preference',
  };
  return (Object.keys(profile.settings) as (keyof LocalProfile['settings'])[])
    .filter((key) => profile.settings[key] !== undefined)
    .map((key) => labels[key]);
}

export function profileRestoreSummary(
  profile: LocalProfile,
  input: {
    sourceName: string;
    createdAt: string;
    catalogVersion?: string;
    currentCatalogVersion?: string;
  },
): RestoreReviewSummary {
  const catalogVersion = input.catalogVersion ?? profile.catalogVersion;
  return {
    sourceName: input.sourceName,
    createdAt: input.createdAt,
    catalogVersion,
    catalogCompatibility:
      !catalogVersion || !input.currentCatalogVersion
        ? 'unknown'
        : catalogVersion === input.currentCatalogVersion
          ? 'current'
          : 'different',
    collectionRecords: profile.collectionEntries.length + profile.formCollectionEntries.length,
    savedSearches: profile.savedSearches.length,
    wantedEntries: profile.wantedEntries.length,
    tradeSpecimens: profile.tradeSpecimens.length,
    settings: settingLabels(profile),
  };
}

export function reviewPortableBackup(
  raw: string,
  sourceName: string,
  currentCatalogVersion?: string,
): PortableBackupReview {
  const backup = parsePortableProfileBackup(raw);
  return {
    raw,
    backup,
    summary: profileRestoreSummary(backup.profile, {
      sourceName,
      createdAt: backup.createdAt,
      catalogVersion: backup.catalogVersion,
      currentCatalogVersion,
    }),
  };
}

export function reviewSnapshot(
  snapshot: LocalProfileSnapshot,
  currentCatalogVersion?: string,
): RestoreReviewSummary {
  return profileRestoreSummary(snapshot.profile, {
    sourceName: snapshot.reason,
    createdAt: snapshot.createdAt,
    catalogVersion: snapshot.catalogVersion,
    currentCatalogVersion,
  });
}

export function RestoreReviewPanel({
  summary,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  summary: RestoreReviewSummary;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const compatibility =
    summary.catalogCompatibility === 'current'
      ? 'Compatible · current catalog'
      : summary.catalogCompatibility === 'different'
        ? 'Compatible backup format · catalog version differs'
        : 'Compatible backup format · catalog version unknown';
  return (
    <section className="restore-review" aria-label="Restore review">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Review before restoring</span>
          <h3>{summary.sourceName}</h3>
        </div>
        <Icon name="shield" />
      </div>
      <dl className="restore-review__details">
        <div>
          <dt>Created</dt>
          <dd>{new Date(summary.createdAt).toLocaleString()}</dd>
        </div>
        <div>
          <dt>Catalog</dt>
          <dd>{summary.catalogVersion ?? 'Not recorded'}</dd>
        </div>
        <div>
          <dt>Compatibility</dt>
          <dd>{compatibility}</dd>
        </div>
        <div>
          <dt>Collection records</dt>
          <dd>{summary.collectionRecords.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Saved searches</dt>
          <dd>{summary.savedSearches.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Wanted / trade records</dt>
          <dd>
            {summary.wantedEntries.toLocaleString()} / {summary.tradeSpecimens.toLocaleString()}
          </dd>
        </div>
      </dl>
      <p className="restore-review__settings">
        <strong>Settings restored:</strong>{' '}
        {summary.settings.length ? summary.settings.join(', ') : 'none saved in this backup'}
      </p>
      <div className="notice notice--warning">
        <Icon name="shield" />
        <div>
          <strong>Your current browser profile will be replaced.</strong>
          <p>CatchGrid creates a pre-restore recovery snapshot before applying this restore.</p>
        </div>
      </div>
      <div className="restore-review__actions">
        <button type="button" className="button button--secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="button button--primary" onClick={onConfirm}>
          <Icon name="upload" /> {confirmLabel}
        </button>
      </div>
    </section>
  );
}
