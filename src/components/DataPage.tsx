import { useMemo, useRef, useState } from 'react';
import {
  exportCollectionCsv,
  previewCanonicalWideCsv,
  type CsvImportPolicy,
} from '../../shared/csv';
import type { CatalogItem, CollectionEntry } from '../../shared/types';
import { Icon } from './Icon';

export function DataPage({
  catalog,
  collectionEntries,
  catalogVersion,
  authMode,
  onUnlock,
  onImport,
}: {
  catalog: readonly CatalogItem[];
  collectionEntries: readonly CollectionEntry[];
  catalogVersion: string;
  authMode: 'local' | 'token' | 'browser';
  onUnlock: () => void;
  onImport: (input: { csv: string; fileName: string; policy: CsvImportPolicy }) => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [csv, setCsv] = useState('');
  const [policy, setPolicy] = useState<CsvImportPolicy>('merge');
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState('');

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
    link.download = `dexly-collection-${new Date().toISOString().slice(0, 10)}.csv`;
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
  }

  async function applyImport() {
    if (!preview || preview.summary.rejected > 0) return;
    setApplying(true);
    setMessage('');
    try {
      await onImport({ csv, fileName, policy });
      setMessage(
        `Import applied: ${preview.summary.added} added and ${preview.summary.removed} removed.`,
      );
      setCsv('');
      setFileName('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Import failed without changing your collection.',
      );
    } finally {
      setApplying(false);
    }
  }

  return (
    <section className="page page--data">
      <header className="page-hero data-hero">
        <div>
          <span className="eyebrow eyebrow--light">
            <Icon name="user" /> Profile & data
          </span>
          <h1>Your collection stays portable.</h1>
          <p>
            Import with a preview, export at any time, and keep this browser's collection portable.
          </p>
        </div>
        <span className="data-hero__icon" aria-hidden="true">
          <Icon name="database" />
        </span>
      </header>

      {message && (
        <div className="notice notice--info" role="status">
          <Icon name="check" />
          <div>
            <p>{message}</p>
          </div>
        </div>
      )}

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
                  Dexly previews every change before saving it to this browser. Export a CSV first
                  when you want a separate backup.
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

      <section className="panel security-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Private by default</span>
            <h2>Collection access</h2>
          </div>
          <span className={`connection-pill connection-pill--${authMode}`}>
            <Icon
              name={authMode === 'browser' ? 'user' : authMode === 'local' ? 'database' : 'lock'}
            />
            {authMode === 'browser'
              ? 'This browser'
              : authMode === 'local'
                ? 'Local session'
                : 'Access key'}
          </span>
        </div>
        <p>
          Collection, wanted, and trade data are stored only in this browser. They do not sync to
          another phone or computer and can be removed when browser data is cleared.
        </p>
        {authMode !== 'browser' && (
          <button type="button" className="button button--secondary" onClick={onUnlock}>
            <Icon name="lock" /> Change access key
          </button>
        )}
      </section>

      <footer className="attribution">
        <strong>Dexly is an unofficial fan project.</strong>
        <p>
          Pokémon and Pokémon GO are property of their respective owners. Sprite mappings reference
          PokeMiners’ educational-use repository at pinned commit metadata; no affiliation or
          endorsement is implied.
        </p>
        <span>
          Catalog {catalogVersion} · {catalog.length} representative forms
        </span>
      </footer>
    </section>
  );
}
