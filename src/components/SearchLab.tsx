import { useMemo, useState } from 'react';
import evolutionFamilyData from '../../catalog/evolution-families.v1.json';
import {
  generateMissingSearchStrings,
  generatePersonalSizeCatchSearchStrings,
  generateWantedTradeSearchStrings,
  isMissingSearchSupported,
} from '../../shared/domain';
import type {
  CatalogItem,
  Category,
  CategoryId,
  CollectionEntry,
  TradeRequestTrait,
  WantedEntry,
} from '../../shared/types';
import { Icon } from './Icon';

const tradeTraits: ReadonlyArray<{ id: TradeRequestTrait; label: string }> = [
  { id: 'normal', label: 'Normal' },
  { id: 'shiny', label: 'Shiny' },
  { id: 'xxl', label: 'XXL' },
  { id: 'xxs', label: 'XXS' },
  { id: 'costume', label: 'Costume' },
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
  wantedEntries,
  categories,
  activeCategory,
  onCategoryChange,
}: {
  catalog: readonly CatalogItem[];
  entries: readonly CollectionEntry[];
  wantedEntries: readonly WantedEntry[];
  categories: readonly Category[];
  activeCategory: CategoryId;
  onCategoryChange: (value: CategoryId) => void;
}) {
  const [workflow, setWorkflow] = useState<'reconcile' | 'trade'>('reconcile');
  const [tradeTrait, setTradeTrait] = useState<TradeRequestTrait>('normal');
  const [region, setRegion] = useState('all');
  const [copied, setCopied] = useState<string | null>(null);
  const [copyFailure, setCopyFailure] = useState(false);

  const filteredCatalog = useMemo(
    () => catalog.filter((item) => region === 'all' || item.region === region),
    [catalog, region],
  );
  const missingCategory = isMissingSearchSupported(activeCategory) ? activeCategory : 'normal';
  const generated = useMemo(
    () =>
      workflow === 'trade'
        ? generateWantedTradeSearchStrings(filteredCatalog, wantedEntries, tradeTrait, {
            maxLength: 4500,
          })
        : generateMissingSearchStrings(filteredCatalog, entries, missingCategory, {
            maxLength: 4500,
          }),
    [entries, filteredCatalog, missingCategory, tradeTrait, wantedEntries, workflow],
  );
  const personalXXL = useMemo(
    () =>
      generatePersonalSizeCatchSearchStrings(catalog, entries, 'xxl', {
        maxLength: 4500,
        evolutionFamilies: evolutionFamilyData.families,
      }),
    [catalog, entries],
  );
  const personalXXS = useMemo(
    () =>
      generatePersonalSizeCatchSearchStrings(catalog, entries, 'xxs', {
        maxLength: 4500,
        evolutionFamilies: evolutionFamilyData.families,
      }),
    [catalog, entries],
  );
  const collectionSearchCategories = categories.filter((category) =>
    isMissingSearchSupported(category.id),
  );
  const regions = [...new Set(catalog.map((item) => item.region))];
  const recommendations = [
    {
      name: 'Recent shinies',
      value: '!traded&shiny&age0-7',
      note: 'Untraded Shiny Pokémon caught in the last seven days.',
    },
    ...personalXXL.strings.map((value, index) => ({
      name: `My missing XXL families${personalXXL.strings.length > 1 ? ` ${index + 1}/${personalXXL.strings.length}` : ''}`,
      value,
      note: `${personalXXL.missingDexNumbers.length} XXL gaps; includes catchable family stages you can evolve.`,
    })),
    ...personalXXS.strings.map((value, index) => ({
      name: `My missing XXS families${personalXXS.strings.length > 1 ? ` ${index + 1}/${personalXXS.strings.length}` : ''}`,
      value,
      note: `${personalXXS.missingDexNumbers.length} XXS gaps; includes catchable family stages you can evolve.`,
    })),
    {
      name: 'Untagged review',
      value: '!traded&!#',
      note: 'Untraded Pokémon without any tags. Review before acting.',
    },
  ];

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
          <p>Build untraded catch and trade searches from your actual collection.</p>
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
          <Icon name="refresh" /> My missing collection
        </button>
        <button
          type="button"
          aria-pressed={workflow === 'trade'}
          onClick={() => setWorkflow('trade')}
        >
          <Icon name="swap" /> My wanted trades
        </button>
      </div>

      <section className="panel generator-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">{workflow === 'trade' ? 'My requests' : 'My missing'}</span>
            <h2>{workflow === 'trade' ? 'Wanted-trade generator' : 'Missing-Dex generator'}</h2>
          </div>
          <span className={`quality-badge quality-badge--${generated.quality}`}>
            {generated.quality === 'exact' ? <Icon name="check" /> : <Icon name="filter" />}
            {generated.quality === 'exact' ? 'Exact' : 'Candidate list'}
          </span>
        </div>

        <div className="lab-fields">
          <label>
            {workflow === 'trade' ? 'Request' : 'Category'}
            {workflow === 'trade' ? (
              <select
                value={tradeTrait}
                onChange={(event) => setTradeTrait(event.target.value as TradeRequestTrait)}
              >
                {tradeTraits.map((trait) => (
                  <option value={trait.id} key={trait.id}>
                    {trait.label}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={missingCategory}
                onChange={(event) => onCategoryChange(event.target.value as CategoryId)}
              >
                {collectionSearchCategories.map((category) => (
                  <option value={category.id} key={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            )}
          </label>
          <label>
            Region
            <select value={region} onChange={(event) => setRegion(event.target.value)}>
              <option value="all">All regions</option>
              {regions.map((value) => (
                <option value={value} key={value}>
                  {value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="search-output">
          <div className="search-output__meta">
            <span>
              {generated.dexNumbers.length} {workflow === 'trade' ? 'requested' : 'missing'}{' '}
              {generated.dexNumbers.length === 1 ? 'entry' : 'entries'}
            </span>
            <span>
              {generated.strings.length || 1}{' '}
              {generated.strings.length === 1 ? 'search string' : 'search strings'}
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
              <strong>
                {workflow === 'trade' ? 'No active requests here' : 'Nothing missing here'}
              </strong>
              <span>Try another request, category, or filter.</span>
            </div>
          )}
          <p className="search-explanation">
            <Icon name="shield" />
            {generated.explanation} Every string begins with <code>!traded</code>.
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
            <span className="eyebrow">Personal catch helpers</span>
            <h2>Recommended strings</h2>
          </div>
          <Icon name="sparkles" />
        </div>
        <div className="recommended-list">
          {recommendations.map((item) => (
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
            <strong>Evolution-aware size hunting.</strong> If an evolved family member is still
            missing, its earlier stages remain in your XXL or XXS catch string.
          </span>
        </p>
      </section>
    </section>
  );
}
