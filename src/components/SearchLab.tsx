import { useMemo, useState } from 'react';
import { generateMissingSearchStrings, isTradeSearchSupported } from '../../shared/domain';
import type { CatalogItem, Category, CategoryId, CollectionEntry } from '../../shared/types';
import { Icon } from './Icon';

const recommended = [
  {
    name: 'Recent shinies',
    value: 'shiny&age0-7',
    note: 'Shiny Pokémon caught in the last seven days.',
  },
  { name: 'Showcase sizes', value: 'xxl,xxs', note: 'Candidate XXL or XXS Pokémon for review.' },
  { name: 'Hundos', value: '4*', note: 'Exact appraisal filter for perfect IV Pokémon.' },
  { name: 'Untagged review', value: '!#', note: 'Pokémon without any tags. Review before acting.' },
];

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = value;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const copied = document.execCommand('copy');
    area.remove();
    return copied;
  }
}

export function SearchLab({
  catalog,
  entries,
  categories,
  activeCategory,
  onCategoryChange,
}: {
  catalog: readonly CatalogItem[];
  entries: readonly CollectionEntry[];
  categories: readonly Category[];
  activeCategory: CategoryId;
  onCategoryChange: (value: CategoryId) => void;
}) {
  const [workflow, setWorkflow] = useState<'reconcile' | 'trade'>('reconcile');
  const [generation, setGeneration] = useState('all');
  const [region, setRegion] = useState('all');
  const [copied, setCopied] = useState<string | null>(null);
  const [copyFailure, setCopyFailure] = useState(false);

  const filteredCatalog = useMemo(
    () =>
      catalog.filter(
        (item) =>
          (generation === 'all' || item.generation === Number(generation)) &&
          (region === 'all' || item.region === region),
      ),
    [catalog, generation, region],
  );
  const generated = useMemo(
    () =>
      generateMissingSearchStrings(filteredCatalog, entries, activeCategory, { maxLength: 240 }),
    [filteredCatalog, entries, activeCategory],
  );
  const regions = [...new Set(catalog.map((item) => item.region))];
  const generations = [...new Set(catalog.map((item) => item.generation))].sort((a, b) => a - b);
  const tradeSupported = isTradeSearchSupported(activeCategory);

  async function handleCopy(value: string, id: string) {
    if (await copyText(value)) {
      setCopyFailure(false);
      setCopied(id);
      window.setTimeout(() => setCopied((current) => (current === id ? null : current)), 1800);
    } else {
      setCopyFailure(true);
    }
  }

  return (
    <section className="page page--lab">
      <header className="page-hero lab-hero">
        <div>
          <span className="eyebrow eyebrow--light">
            <Icon name="flask" /> Search Lab
          </span>
          <h1>Turn gaps into useful searches.</h1>
          <p>
            Build in-game reconciliation and trade-planning strings from your actual collection.
          </p>
        </div>
        <div className="lab-hero__orb" aria-hidden="true">
          <Icon name="search" />
          <span />
        </div>
      </header>

      <div className="segmented-control segmented-control--workflow" aria-label="Search workflow">
        <button
          type="button"
          aria-pressed={workflow === 'reconcile'}
          onClick={() => setWorkflow('reconcile')}
        >
          <Icon name="refresh" /> Reconcile my Dex
        </button>
        <button
          type="button"
          aria-pressed={workflow === 'trade'}
          onClick={() => setWorkflow('trade')}
        >
          <Icon name="swap" /> Trade planning
        </button>
      </div>

      <section className="panel generator-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">My missing</span>
            <h2>Missing-Dex generator</h2>
          </div>
          <span className={`quality-badge quality-badge--${generated.quality}`}>
            {generated.quality === 'exact' ? <Icon name="check" /> : <Icon name="filter" />}
            {generated.quality === 'exact' ? 'Exact' : 'Candidate list'}
          </span>
        </div>

        <div className="lab-fields">
          <label>
            Category
            <select
              value={activeCategory}
              onChange={(event) => onCategoryChange(event.target.value as CategoryId)}
            >
              {categories.map((category) => (
                <option value={category.id} key={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Generation
            <select value={generation} onChange={(event) => setGeneration(event.target.value)}>
              <option value="all">All generations</option>
              {generations.map((value) => (
                <option value={value} key={value}>
                  Generation {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            Region
            <select value={region} onChange={(event) => setRegion(event.target.value)}>
              <option value="all">All regions</option>
              {regions.map((value) => (
                <option value={value} key={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>

        {workflow === 'trade' && !tradeSupported && (
          <div className="notice notice--warning">
            <Icon name="shield" />
            <div>
              <strong>
                {activeCategory === 'shadow'
                  ? 'Shadow Pokémon cannot be traded.'
                  : `${activeCategory === 'hundo' ? 'IVs reroll' : 'Lucky status does not transfer'}.`}
              </strong>
              <p>Choose Shiny, XXL, XXS, Purified, or Normal for a useful trade-planning result.</p>
            </div>
          </div>
        )}

        <div className="search-output">
          <div className="search-output__meta">
            <span>
              {generated.dexNumbers.length} missing{' '}
              {generated.dexNumbers.length === 1 ? 'entry' : 'entries'}
            </span>
            <span>
              {generated.strings.length || 1} {generated.strings.length === 1 ? 'string' : 'chunks'}
            </span>
          </div>
          {generated.strings.length ? (
            generated.strings.map((value, index) => (
              <div className="search-string" key={value}>
                <code>{value}</code>
                <button
                  type="button"
                  className="button button--copy"
                  onClick={() => void handleCopy(value, `generated-${index}`)}
                >
                  <Icon name={copied === `generated-${index}` ? 'check' : 'clipboard'} />
                  {copied === `generated-${index}` ? 'Copied' : 'Copy'}
                </button>
              </div>
            ))
          ) : (
            <div className="search-empty">
              <Icon name="sparkles" />
              <strong>Nothing missing here</strong>
              <span>Try another category or filter.</span>
            </div>
          )}
          <p className="search-explanation">
            <Icon name="shield" />
            {generated.explanation}{' '}
            {workflow === 'reconcile'
              ? 'Use this to find entries in storage that may need checking off here.'
              : 'Review the other trainer’s results visually before arranging a trade.'}
          </p>
          {copyFailure && (
            <p className="copy-failure" role="alert">
              Clipboard access is blocked in this browser. Select the string and press Ctrl/Cmd+C.
            </p>
          )}
        </div>
      </section>

      <section className="panel recommended-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Ready to use</span>
            <h2>Recommended strings</h2>
          </div>
          <Icon name="sparkles" />
        </div>
        <div className="recommended-list">
          {recommended.map((item) => (
            <article key={item.name}>
              <div>
                <strong>{item.name}</strong>
                <p>{item.note}</p>
                <code>{item.value}</code>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label={`Copy ${item.name}`}
                onClick={() => void handleCopy(item.value, item.name)}
              >
                <Icon name={copied === item.name ? 'check' : 'clipboard'} />
              </button>
            </article>
          ))}
        </div>
        <p className="safety-note">
          <Icon name="shield" />
          <span>
            <strong>Review before transferring.</strong> Dexly never labels a general cleanup string
            universally safe.
          </span>
        </p>
      </section>
    </section>
  );
}
