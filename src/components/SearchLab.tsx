import { useMemo, useState } from 'react';
import evolutionFamilyData from '../../catalog/evolution-families.v1.json';
import {
  generateMissingSearchStrings,
  generatePersonalSizeCatchSearchStrings,
} from '../../shared/domain';
import type { CatalogItem, Category, CategoryId, CollectionEntry } from '../../shared/types';
import { buildDiscordMessages } from '../lib/discordShare';
import { createCatalogIndex } from '../catalog/catalogIndex';
import { collectionCategoryLabel } from '../catalog/capabilities';
import { defaultRegionCatalog } from '../catalog/regionMedals';
import { Icon } from './Icon';
import '../routes/search.css';

const SEARCH_CATEGORY_IDS = [
  'normal',
  'shiny',
  'xxl',
  'xxs',
] as const satisfies readonly CategoryId[];

type MissingSearchMode = 'personal' | 'tradeable';

function formatMissingSearch(value: string, mode: MissingSearchMode): string {
  return mode === 'personal' ? value.replace(/^!traded&/, '!#&') : value;
}

function formatPersonalHelper(value: string): string {
  return value.replace(/^!traded&/, '');
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = value;
    area.className = 'clipboard-fallback';
    document.body.append(area);
    area.select();
    const copied = document.execCommand('copy');
    area.remove();
    return copied;
  }
}

export function ProgressPage({
  catalog,
  entries,
  categories,
  onOpen,
}: {
  catalog: readonly CatalogItem[];
  entries: readonly CollectionEntry[];
  categories: readonly Category[];
  onOpen?: (item: CatalogItem) => void;
}) {
  const nationalCatalog = useMemo(() => catalog.filter((item) => item.isDefault), [catalog]);
  const catalogIndex = useMemo(() => createCatalogIndex(catalog), [catalog]);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [regionalCategory, setRegionalCategory] = useState<CategoryId>('normal');
  const regionCatalog = useMemo(
    () => (selectedRegion ? defaultRegionCatalog(catalogIndex, selectedRegion) : []),
    [catalogIndex, selectedRegion],
  );
  const regionalMissing = useMemo(
    () =>
      regionCatalog.filter(
        (item) =>
          item.rules[regionalCategory] === 'released' &&
          !entries.some(
            (entry) =>
              entry.formId === item.id && entry.categoryId === regionalCategory && entry.collected,
          ),
      ),
    [entries, regionCatalog, regionalCategory],
  );

  return (
    <section className="page page--progress">
      <header className="tool-page-header progress-page-header">
        <span className="eyebrow">
          <Icon name="chart" /> Collection progress
        </span>
        <h1>Your collection, clearly.</h1>
        <p>See completion across every category, then focus on the region that needs attention.</p>
      </header>

      <section className="progress-overview" aria-labelledby="progress-overview-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Overall collection</span>
            <h2 id="progress-overview-title">At a glance</h2>
          </div>
        </div>
        <div className="progress-summary-grid">
          {categories.map((category) => {
            const available = nationalCatalog.filter(
              (item) => item.rules[category.id] === 'released',
            );
            const collected = available.filter((item) =>
              entries.some(
                (entry) =>
                  entry.formId === item.id && entry.categoryId === category.id && entry.collected,
              ),
            ).length;
            const percentage = available.length
              ? Math.round((collected / available.length) * 100)
              : 0;
            return (
              <article key={category.id}>
                <span>
                  <strong>{collectionCategoryLabel(category)}</strong>
                  <small>{percentage}%</small>
                </span>
                <b>
                  {collected}
                  <small> / {available.length}</small>
                </b>
                <progress value={collected} max={available.length || 1} />
              </article>
            );
          })}
        </div>
      </section>

      <section className="regional-progress" aria-labelledby="regional-progress-title">
        <div className="section-heading regional-progress__heading">
          <div>
            <span className="eyebrow">Regional explorer</span>
            <h2 id="regional-progress-title">Where are your gaps?</h2>
          </div>
          {selectedRegion && (
            <label>
              <span className="sr-only">Regional collection category</span>
              <select
                aria-label="Regional collection category"
                value={regionalCategory}
                onChange={(event) => setRegionalCategory(event.target.value as CategoryId)}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {collectionCategoryLabel(category)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="region-shortcut-grid">
          {catalogIndex.regions.map((region) => {
            const scoped = defaultRegionCatalog(catalogIndex, region);
            const available = scoped.filter((entry) => entry.rules.normal === 'released');
            const collected = available.filter((entry) =>
              entries.some(
                (owned) =>
                  owned.formId === entry.id && owned.categoryId === 'normal' && owned.collected,
              ),
            ).length;
            const label = region.charAt(0).toUpperCase() + region.slice(1).toLowerCase();
            return (
              <button
                type="button"
                key={region}
                className={selectedRegion === region ? 'is-active' : ''}
                aria-pressed={selectedRegion === region}
                onClick={() => setSelectedRegion(region)}
              >
                <strong>{label}</strong>
                <span>
                  {collected}/{available.length}
                </span>
              </button>
            );
          })}
        </div>
        {selectedRegion ? (
          <div className="regional-detail">
            <div>
              <strong>
                {selectedRegion.charAt(0).toUpperCase() + selectedRegion.slice(1).toLowerCase()} ·{' '}
                {collectionCategoryLabel(categories.find((item) => item.id === regionalCategory)!)}
              </strong>
              <span>{regionalMissing.length} obtainable Pokémon missing</span>
            </div>
            <div className="regional-missing-list">
              {regionalMissing.map((pokemon) => (
                <button type="button" key={pokemon.id} onClick={() => onOpen?.(pokemon)}>
                  <span>#{String(pokemon.dexNumber).padStart(4, '0')}</span> {pokemon.name}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="regional-progress__empty">Choose a region to see its missing Pokémon.</p>
        )}
      </section>
    </section>
  );
}

export function SearchLabPage({
  catalog,
  entries,
  categories,
}: {
  catalog: readonly CatalogItem[];
  entries: readonly CollectionEntry[];
  categories: readonly Category[];
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [copyFailure, setCopyFailure] = useState(false);
  const [missingSearchMode, setMissingSearchMode] = useState<MissingSearchMode>('personal');
  const [sharedCategories, setSharedCategories] = useState<Set<CategoryId>>(
    () => new Set(SEARCH_CATEGORY_IDS),
  );

  const labels = useMemo(
    () => new Map(categories.map((category) => [category.id, collectionCategoryLabel(category)])),
    [categories],
  );
  const nationalCatalog = useMemo(() => catalog.filter((item) => item.isDefault), [catalog]);
  const results = useMemo(
    () =>
      SEARCH_CATEGORY_IDS.map((categoryId) => ({
        categoryId,
        label: labels.get(categoryId) ?? categoryId.toUpperCase(),
        generated: generateMissingSearchStrings(nationalCatalog, entries, categoryId, {
          maxLength: 4_500,
        }),
        discord: generateMissingSearchStrings(nationalCatalog, entries, categoryId, {
          maxLength: 1_500,
        }),
      })),
    [entries, labels, nationalCatalog],
  );
  const discordMessages = useMemo(
    () =>
      buildDiscordMessages(
        results
          .filter((result) => sharedCategories.has(result.categoryId))
          .map((result) => ({ label: result.label, strings: result.discord.strings })),
      ),
    [results, sharedCategories],
  );
  const personalXXL = useMemo(
    () =>
      generatePersonalSizeCatchSearchStrings(nationalCatalog, entries, 'xxl', {
        maxLength: 4_500,
        evolutionFamilies: evolutionFamilyData.families,
      }),
    [entries, nationalCatalog],
  );
  const personalXXS = useMemo(
    () =>
      generatePersonalSizeCatchSearchStrings(nationalCatalog, entries, 'xxs', {
        maxLength: 4_500,
        evolutionFamilies: evolutionFamilyData.families,
      }),
    [entries, nationalCatalog],
  );
  const recommendations = [
    {
      name: 'Recent shinies',
      value: '!traded&shiny&age0-7',
      note: 'Untraded Shiny Pokémon caught in the last seven days.',
    },
    ...personalXXL.strings.map((value, index) => ({
      name: `XXL evolution helper${personalXXL.strings.length > 1 ? ` ${index + 1}/${personalXXL.strings.length}` : ''}`,
      value: formatPersonalHelper(value),
      note: `${personalXXL.missingDexNumbers.length} missing XXL entries. Also finds earlier stages that can evolve into them.`,
    })),
    ...personalXXS.strings.map((value, index) => ({
      name: `XXS evolution helper${personalXXS.strings.length > 1 ? ` ${index + 1}/${personalXXS.strings.length}` : ''}`,
      value: formatPersonalHelper(value),
      note: `${personalXXS.missingDexNumbers.length} missing XXS entries. Also finds earlier stages that can evolve into them.`,
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
      window.setTimeout(() => setCopied((current) => (current === id ? null : current)), 1_800);
    } else {
      setCopyFailure(true);
    }
  }

  async function shareDiscordMessage(message: string) {
    if (!navigator.share) {
      await handleCopy(message, 'discord-share');
      return;
    }
    try {
      await navigator.share({ title: 'My missing CatchGrid lists', text: message });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      await handleCopy(message, 'discord-share');
    }
  }

  function toggleSharedCategory(categoryId: CategoryId) {
    setSharedCategories((current) => {
      const next = new Set(current);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  return (
    <section className="page page--lab page--search-lab">
      <header className="tool-page-header search-page-header">
        <span className="eyebrow">
          <Icon name="flask" /> Search Lab
        </span>
        <h1>Useful searches, ready to paste.</h1>
        <p>Build collection-aware Pokémon GO searches and package missing lists for friends.</p>
      </header>

      <section className="panel generator-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">My missing</span>
            <h2>My missing searches</h2>
          </div>
          <div className="missing-search-mode" role="group" aria-label="Missing search format">
            <button
              type="button"
              aria-pressed={missingSearchMode === 'personal'}
              onClick={() => {
                setCopied(null);
                setMissingSearchMode('personal');
              }}
            >
              Personal
            </button>
            <button
              type="button"
              aria-pressed={missingSearchMode === 'tradeable'}
              onClick={() => {
                setCopied(null);
                setMissingSearchMode('tradeable');
              }}
            >
              Tradeable
            </button>
          </div>
        </div>
        <p className="missing-search-mode__help">
          {missingSearchMode === 'personal'
            ? 'Excludes tagged Pokémon with !# so this can become your own saved search.'
            : 'Excludes previously traded Pokémon for lists you share with friends.'}
        </p>
        <div className="all-category-searches">
          {results.map((result) => (
            <section className="search-output" key={result.categoryId}>
              <div className="search-output__meta">
                <strong>{result.label}</strong>
                <span>{result.generated.dexNumbers.length} missing</span>
              </div>
              {result.generated.strings.length ? (
                result.generated.strings.map((value, index) => (
                  <div className="search-string" key={value}>
                    <code tabIndex={0}>{formatMissingSearch(value, missingSearchMode)}</code>
                    <button
                      type="button"
                      className="button button--copy"
                      onClick={() =>
                        void handleCopy(
                          formatMissingSearch(value, missingSearchMode),
                          `${result.categoryId}-${index}`,
                        )
                      }
                    >
                      <Icon
                        name={copied === `${result.categoryId}-${index}` ? 'check' : 'clipboard'}
                      />
                      {copied === `${result.categoryId}-${index}` ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                ))
              ) : (
                <div className="search-empty">
                  <Icon name="sparkles" />
                  <strong>Nothing missing here</strong>
                </div>
              )}
            </section>
          ))}
        </div>
        {copyFailure && (
          <p className="copy-failure" role="alert">
            Clipboard access is blocked in this browser. Select the string and copy it manually.
          </p>
        )}
      </section>

      <section className="panel discord-share-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Share with friends</span>
            <h2>Discord-ready message</h2>
          </div>
          <Icon name="clipboard" />
        </div>
        <p className="discord-share-panel__intro">
          Choose the lists to share. CatchGrid formats copyable code blocks and splits long posts
          safely.
        </p>
        <div className="discord-category-picker" role="group" aria-label="Lists to share">
          {results.map((result) => {
            const selected = sharedCategories.has(result.categoryId);
            const available = result.discord.strings.length > 0;
            return (
              <button
                type="button"
                key={result.categoryId}
                aria-pressed={selected}
                disabled={!available}
                onClick={() => toggleSharedCategory(result.categoryId)}
              >
                <Icon name={selected ? 'check' : 'plus'} />
                <span>
                  <strong>{result.label}</strong>
                  <small>
                    {available ? `${result.discord.dexNumbers.length} missing` : 'Complete'}
                  </small>
                </span>
              </button>
            );
          })}
        </div>
        {discordMessages.length > 0 ? (
          <div className="discord-message-list">
            {discordMessages.map((message, index) => (
              <article key={`${message.slice(0, 32)}-${index}`}>
                <div>
                  <strong>
                    Discord message {index + 1} of {discordMessages.length}
                  </strong>
                  <small>{message.length}/2,000 characters</small>
                </div>
                <pre tabIndex={0} aria-label={`Discord message ${index + 1} preview`}>
                  {message}
                </pre>
                <button
                  type="button"
                  className="button button--primary button--full"
                  onClick={() => void handleCopy(message, `discord-${index}`)}
                >
                  <Icon name={copied === `discord-${index}` ? 'check' : 'clipboard'} />
                  {copied === `discord-${index}` ? 'Copied' : 'Copy Discord message'}
                </button>
                {index === 0 && discordMessages.length === 1 && (
                  <button
                    type="button"
                    className="button button--secondary button--full"
                    onClick={() => void shareDiscordMessage(message)}
                  >
                    <Icon name="upload" />
                    {'share' in navigator ? 'Share message' : 'Copy to share'}
                  </button>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="inline-empty">
            <Icon name="clipboard" />
            <div>
              <strong>Choose at least one missing list</strong>
              <p>Your Discord preview will appear here.</p>
            </div>
          </div>
        )}
      </section>

      <section className="panel recommended-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Smarter Pokémon searches</span>
            <h2>Catch helpers</h2>
          </div>
          <Icon name="sparkles" />
        </div>
        <div className="recommended-list">
          {recommendations.map((item) => (
            <article key={item.name}>
              <div>
                <strong>{item.name}</strong>
                <p>{item.note}</p>
                <span className="recommended-query" tabIndex={0}>
                  {item.value}
                </span>
              </div>
              <button
                type="button"
                className="button button--secondary recommended-copy"
                aria-label={`Copy ${item.name}`}
                onClick={() => void handleCopy(item.value, item.name)}
              >
                <Icon name={copied === item.name ? 'check' : 'clipboard'} />
                {copied === item.name ? 'Copied' : 'Copy'}
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
