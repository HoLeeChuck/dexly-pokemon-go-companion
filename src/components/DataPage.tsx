import { useMemo, useRef, useState } from 'react';
import {
  exportCollectionCsv,
  previewCanonicalWideCsv,
  type CsvImportPolicy,
} from '../../shared/csv';
import type { CatalogItem, CollectionEntry } from '../../shared/types';
import { ACCENT_THEMES, type AccentTheme } from '../lib/theme';
import { Icon } from './Icon';
import { APP_VERSION, PORTFOLIO_URL } from '../config/app';
import '../routes/profile.css';

export function DataPage({
  catalog,
  collectionEntries,
  catalogVersion,
  storageMode,
  theme,
  accentTheme,
  showCloudAccess = false,
  onThemeChange,
  onAccentThemeChange,
  onUnlock,
  onLeaveCloud,
  onImport,
  onExportBackup,
  onRestoreBackup,
  snapshots,
  onRestoreSnapshot,
  onSetRegionNormal,
}: {
  catalog: readonly CatalogItem[];
  collectionEntries: readonly CollectionEntry[];
  catalogVersion: string;
  storageMode: 'browser' | 'cloud';
  theme: 'light' | 'dark';
  accentTheme: AccentTheme;
  showCloudAccess?: boolean;
  onThemeChange: (theme: 'light' | 'dark') => void;
  onAccentThemeChange: (theme: AccentTheme) => void;
  onUnlock: () => void;
  onLeaveCloud: () => void;
  onImport: (input: { csv: string; fileName: string; policy: CsvImportPolicy }) => Promise<void>;
  onExportBackup: () => void;
  onRestoreBackup: (json: string) => void;
  snapshots: readonly { id: string; createdAt: string; reason: string }[];
  onRestoreSnapshot: (id: string) => void;
  onSetRegionNormal: (region: string, collected: boolean) => Promise<number>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const backupRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [csv, setCsv] = useState('');
  const [policy, setPolicy] = useState<CsvImportPolicy>('merge');
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState('');
  const [importMessage, setImportMessage] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);

  const previewResult = useMemo(() => {
    if (!csv) return { preview: null, error: '' };
    try {
      return {
        preview: previewCanonicalWideCsv(csv, catalog, collectionEntries, policy),
        error: '',
      };
    } catch (error) {
      return {
        preview: null,
        error: error instanceof Error ? error.message : 'The CSV could not be parsed.',
      };
    }
  }, [csv, catalog, collectionEntries, policy]);
  const { preview } = previewResult;

  function exportCsv() {
    const content = exportCollectionCsv(catalog, collectionEntries);
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `catchgrid-collection-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage('Collection CSV exported.');
  }

  async function readFile(file: File) {
    if (file.size > 512_000) {
      setMessage('Choose a CSV smaller than 512 KB for this catalog slice.');
      return;
    }
    setFileName(file.name);
    setCsv(await file.text());
    setMessage('');
    setImportMessage(null);
  }

  async function applyImport() {
    if (!preview || preview.summary.rejected > 0) return;
    setApplying(true);
    setImportMessage(null);
    try {
      await onImport({ csv, fileName, policy });
      setImportMessage({
        tone: 'success',
        text: `Import applied: ${preview.summary.added} added and ${preview.summary.removed} removed.`,
      });
      setCsv('');
      setFileName('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (error) {
      setImportMessage({
        tone: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Import failed without changing your collection.',
      });
    } finally {
      setApplying(false);
    }
  }

  return (
    <section className="page page--data">
      <header className="settings-header">
        <div>
          <span className="eyebrow">
            <Icon name="settings" /> Settings
          </span>
          <h1>Settings</h1>
          <p>Personalize CatchGrid and manage your collection data.</p>
        </div>
      </header>

      {message && (
        <div className="notice notice--info" role="status">
          <Icon name="check" />
          <div>
            <p>{message}</p>
          </div>
        </div>
      )}

      <details className="panel collection-setup-panel settings-disclosure">
        <summary className="panel-heading">
          <div>
            <span className="eyebrow">Advanced setup</span>
            <h2>Bulk collection setup</h2>
            <p>Mark or clear an entire region’s obtainable Normal entries.</p>
          </div>
          <span className="settings-disclosure__icon" aria-hidden="true">
            <Icon name="grid" />
            <Icon name="chevron-right" />
          </span>
        </summary>
        <div className="settings-disclosure__body">
          <p>
            This only changes Normal collection entries. Shiny, Lucky, sizes, Shadow, and Purified
            are never changed.
          </p>
          {storageMode === 'cloud' && (
            <p className="notice notice--subtle">
              Bulk region setup is available for browser collections. Switch back to this browser
              before using it.
            </p>
          )}
          <div className="region-setup-grid">
            {[...new Set(catalog.filter((item) => item.isDefault).map((item) => item.region))].map(
              (region) => {
                const regionLabel = region.charAt(0).toUpperCase() + region.slice(1).toLowerCase();
                const count = catalog.filter(
                  (item) =>
                    item.isDefault && item.region === region && item.rules.normal === 'released',
                ).length;
                return (
                  <article key={region}>
                    <div>
                      <strong>{regionLabel}</strong>
                      <small>{count} obtainable Normal entries</small>
                    </div>
                    <div>
                      <button
                        type="button"
                        className="button button--primary"
                        disabled={storageMode === 'cloud'}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Mark ${count} obtainable Normal entries in ${regionLabel} as collected? Special categories will not change.`,
                            )
                          )
                            void onSetRegionNormal(region, true).then((changed) =>
                              setMessage(
                                `${regionLabel}: ${changed} Normal entries marked collected.`,
                              ),
                            );
                        }}
                      >
                        Mark complete
                      </button>
                      <button
                        type="button"
                        className="button button--secondary"
                        disabled={storageMode === 'cloud'}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Clear the Normal collection state for ${regionLabel}? Special categories will not change.`,
                            )
                          )
                            void onSetRegionNormal(region, false).then((changed) =>
                              setMessage(`${regionLabel}: ${changed} Normal entries cleared.`),
                            );
                        }}
                      >
                        Clear Normal
                      </button>
                    </div>
                  </article>
                );
              },
            )}
          </div>
        </div>
      </details>

      <section className="panel appearance-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Personalize CatchGrid</span>
            <h2>Appearance</h2>
          </div>
          <Icon name={theme === 'dark' ? 'moon' : 'sun'} />
        </div>
        <p>
          Choose a color family and brightness. Every color includes a tuned light and dark mode.
        </p>
        <div className="appearance-mode" role="group" aria-label="Brightness mode">
          {(['light', 'dark'] as const).map((mode) => (
            <button
              type="button"
              key={mode}
              aria-pressed={theme === mode}
              onClick={() => onThemeChange(mode)}
            >
              <Icon name={mode === 'dark' ? 'moon' : 'sun'} />
              {mode === 'dark' ? 'Dark' : 'Light'}
            </button>
          ))}
        </div>
        <div className="theme-choice-grid" role="radiogroup" aria-label="Color theme">
          {ACCENT_THEMES.map((color) => (
            <button
              type="button"
              role="radio"
              aria-checked={accentTheme === color}
              className={`theme-choice theme-choice--${color}`}
              key={color}
              onClick={() => onAccentThemeChange(color)}
            >
              <span aria-hidden="true">
                <i />
                <i />
              </span>
              <strong>{color.charAt(0).toUpperCase() + color.slice(1)}</strong>
              {accentTheme === color && <Icon name="check" />}
            </button>
          ))}
        </div>
      </section>

      <section className="panel data-actions">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Portability</span>
            <h2>Export collection</h2>
          </div>
          <Icon name="download" />
        </div>
        <p>
          Download the canonical wide-format CSV with every supported category. Notes are
          formula-safe for spreadsheet apps.
        </p>
        <button type="button" className="button button--primary button--full" onClick={exportCsv}>
          <Icon name="download" /> Export collection CSV
        </button>
        <div className="portable-backup-actions">
          <button type="button" className="button button--secondary" onClick={onExportBackup}>
            <Icon name="shield" /> Export full JSON backup
          </button>
          <input
            ref={backupRef}
            type="file"
            accept="application/json,.json"
            hidden
            disabled={storageMode === 'cloud'}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void file
                .text()
                .then(onRestoreBackup)
                .catch(() => setMessage('The backup file could not be read.'));
              event.currentTarget.value = '';
            }}
          />
          <button
            type="button"
            className="button button--secondary"
            disabled={storageMode === 'cloud'}
            aria-describedby={storageMode === 'cloud' ? 'backup-restore-help' : undefined}
            onClick={() => backupRef.current?.click()}
          >
            <Icon name="upload" />
            {storageMode === 'cloud' ? 'Switch to browser to restore' : 'Restore JSON backup'}
          </button>
        </div>
        <p className="backup-help" id="backup-restore-help">
          {storageMode === 'cloud'
            ? 'Local JSON restore is disabled while Cody Cloud is connected. Return to this browser first so a local backup cannot overwrite or diverge from cloud data.'
            : 'Full backups include default and alternate-form collection state, wanted and trade data, saved searches, appearance settings, catalog version, and migration history.'}
        </p>
        {snapshots.length > 0 && (
          <details className="snapshot-list">
            <summary>Browser recovery snapshots ({snapshots.length})</summary>
            {snapshots.map((snapshot) => (
              <article key={snapshot.id}>
                <span>
                  <strong>{new Date(snapshot.createdAt).toLocaleString()}</strong>
                  <small>{snapshot.reason}</small>
                </span>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => onRestoreSnapshot(snapshot.id)}
                >
                  Restore
                </button>
              </article>
            ))}
          </details>
        )}
      </section>

      <section className="panel import-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Preview before writing</span>
            <h2>Import CSV</h2>
          </div>
          <Icon name="upload" />
        </div>
        <p>
          Use <code>dex_number</code>, <code>form_id</code>, or <code>name</code> plus one or more
          category columns.
        </p>
        <div className="file-picker">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            aria-label="Choose a CSV file to preview"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void readFile(file);
            }}
          />
          <Icon name="upload" />
          <strong>{fileName || 'Choose a CSV file'}</strong>
          <span>
            {fileName ? 'Select a different file' : 'Up to 512 KB · nothing applies without review'}
          </span>
        </div>

        {importMessage && (
          <div
            className={`notice ${importMessage.tone === 'error' ? 'notice--warning' : 'notice--info'}`}
            role={importMessage.tone === 'error' ? 'alert' : 'status'}
          >
            <Icon name={importMessage.tone === 'error' ? 'shield' : 'check'} />
            <div>
              <strong>
                {importMessage.tone === 'error' ? 'Import not applied' : 'Import complete'}
              </strong>
              <p>{importMessage.text}</p>
            </div>
          </div>
        )}

        {previewResult.error && (
          <div className="notice notice--warning" role="alert">
            <Icon name="shield" />
            <div>
              <strong>CSV preview unavailable</strong>
              <p>{previewResult.error}</p>
            </div>
          </div>
        )}

        {preview && (
          <div className="import-preview">
            <label className="policy-select">
              Import policy
              <select
                value={policy}
                onChange={(event) => setPolicy(event.target.value as CsvImportPolicy)}
              >
                <option value="merge">Merge · add true values only</option>
                <option value="update">Update · apply explicit true and false</option>
                <option value="replace">Replace mapped cells · blank means false</option>
              </select>
            </label>
            <div className="preview-stats">
              <span>
                <strong>{preview.summary.resolvedRows}</strong> matched
              </span>
              <span className="is-add">
                <strong>{preview.summary.added}</strong> add
              </span>
              <span className="is-remove">
                <strong>{preview.summary.removed}</strong> remove
              </span>
              <span className={preview.summary.rejected ? 'is-error' : ''}>
                <strong>{preview.summary.rejected}</strong> issues
              </span>
            </div>
            {preview.issues.length > 0 && (
              <div className="issue-list">
                {preview.issues.slice(0, 6).map((issue, index) => (
                  <p
                    key={`${issue.row}-${issue.code}-${index}`}
                    className={`issue issue--${issue.severity}`}
                  >
                    <strong>Row {issue.row}</strong> {issue.message}
                  </p>
                ))}
              </div>
            )}
            <div className="preview-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Pokémon</th>
                    <th>Category</th>
                    <th>Change</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.changes
                    .filter((change) => change.disposition !== 'ignored')
                    .slice(0, 12)
                    .map((change) => {
                      const item = catalog.find((entry) => entry.id === change.formId);
                      return (
                        <tr key={`${change.row}-${change.formId}-${change.categoryId}`}>
                          <td>{change.row}</td>
                          <td>{item?.name ?? change.formId}</td>
                          <td>{change.categoryId}</td>
                          <td>
                            <span className={`change-pill change-pill--${change.disposition}`}>
                              {change.disposition}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            <div className="notice notice--subtle">
              <Icon name="shield" />
              <div>
                <p>
                  CatchGrid previews every change before saving it to this browser. Export a CSV
                  first when you want a separate backup.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="button button--primary button--full"
              disabled={preview.summary.rejected > 0 || applying}
              onClick={() => void applyImport()}
            >
              <Icon name="upload" />
              {applying ? 'Applying safely…' : 'Apply reviewed import'}
            </button>
          </div>
        )}
      </section>

      {showCloudAccess && (
        <section className="panel security-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Owner access</span>
              <h2>Cody Cloud</h2>
            </div>
            <span className={`connection-pill connection-pill--${storageMode}`}>
              <Icon name={storageMode === 'cloud' ? 'database' : 'user'} />
              {storageMode === 'cloud' ? 'Connected' : 'This browser'}
            </span>
          </div>
          <p>
            {storageMode === 'cloud'
              ? 'Cody Cloud is active. Collection changes sync through the private D1 profile on this device.'
              : 'This unlisted page only exposes the sign-in form. The private access key still protects Cody Cloud.'}
          </p>
          {storageMode === 'cloud' ? (
            <button type="button" className="button button--secondary" onClick={onLeaveCloud}>
              <Icon name="user" /> Return to this browser
            </button>
          ) : (
            <button type="button" className="button button--secondary" onClick={onUnlock}>
              <Icon name="lock" /> Sign in to Cody Cloud
            </button>
          )}
        </section>
      )}

      <footer className="attribution">
        <span className="eyebrow">About CatchGrid</span>
        <strong>CatchGrid is an unofficial fan project.</strong>
        <p>
          Pokémon and Pokémon GO are property of their respective owners. Sprite mappings reference
          PokeMiners’ educational-use repository at pinned commit metadata; no affiliation or
          endorsement is implied.
        </p>
        <span>
          CatchGrid v{APP_VERSION} · Catalog {catalogVersion} · {catalog.length} representative
          forms
        </span>
        <nav aria-label="Legal and project policies">
          <a href="/privacy/">Privacy</a>
          <a href="/security/">Security</a>
          <a href="/notices/">Third-party notices</a>
          <a href={PORTFOLIO_URL} target="_blank" rel="noreferrer">
            Cody Johnson · Portfolio
          </a>
        </nav>
      </footer>
    </section>
  );
}
