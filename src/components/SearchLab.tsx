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
  const [copied, setCopied] = useState<string | null>(null);
  const [copyFailure, setCopyFailure] = useState(false);
  const [sharedCategories, setSharedCategories] = useState<Set<CategoryId>>(
    () => new Set(SEARCH_CATEGORY_IDS),
  );

  const labels = useMemo(
    () => new Map(categories.map((category) => [category.id, collectionCategoryLabel(category)])),
    [categories],
  );
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
  const regionalSearch = useMemo(
    () =>
      generateMissingSearchStrings(regionCatalog, entries, regionalCategory, {
        maxLength: 4_500,
      }),
    [entries, regionCatalog, regionalCategory],
  );
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
    <section className="page page--lab page--progress">
      <header className="page-hero lab-hero">
        <div>
          <span className="eyebrow eyebrow--light">
            <Icon name="chart" /> Collection progress
          </span>
          <h1>See what you have. Act on what is missing.</h1>
          <p>
            Review completion, open regional gaps, and copy collection-aware Pokémon GO searches.
          </p>
        </div>
        <div className="lab-hero__orb" aria-hidden="true">
          <Icon name="search" />
          <span />
        </div>
      </header>

      <section className="progress-overview" aria-labelledby="progress-overview-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Overall collection</span>
            <h2 id="progress-overview-title">Across every category</h2>
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
            return (
              <article key={category.id}>
                <strong>{collectionCategoryLabel(category)}</strong>
                <span>
                  {collected}/{available.length}
                </span>
                <progress value={collected} max={available.length || 1} />
              </article>
            );
          })}
        </div>
      </section>

      <section className="regional-progress" aria-labelledby="regional-progress-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Regional progress</span>
            <h2 id="regional-progress-title">Choose a region</h2>
          </div>
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
                onClick={() => setSelectedRegion(region)}
              >
                <span>
                  <strong>{label}</strong>
                  <small>
                    {collected}/{available.length} Normal
                  </small>
                </span>
                <Icon name="chevron-right" />
              </button>
            );
          })}
        </div>
        {selectedRegion && (
          <div className="regional-detail">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Regional detail</span>
                <h3>
                  {selectedRegion.charAt(0).toUpperCase() + selectedRegion.slice(1).toLowerCase()}
                </h3>
              </div>
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
            </div>
            <p>{regionalMissing.length} obtainable Pokémon missing.</p>
            <div className="regional-search-actions">
              {regionalSearch.strings.map((value, index) => (
                <article key={value}>
                  <div>
                    <strong>Search My Storage</strong>
                    <small>Paste this into your Pokémon GO storage search.</small>
                    <code>{value}</code>
                  </div>
                  <button
                    type="button"
                    className="button button--copy"
                    onClick={() => void handleCopy(value, `regional-${index}`)}
                  >
                    {copied === `regional-${index}` ? 'Copied' : 'Copy'}
                  </button>
                </article>
              ))}
              {regionalSearch.strings.length > 0 && (
                <p>
                  <strong>Send to a Friend:</strong> share the same category and region string so
                  another trainer can check what they have available.
                </p>
              )}
            </div>
            <div className="regional-missing-list">
              {regionalMissing.map((pokemon) => (
                <button type="button" key={pokemon.id} onClick={() => onOpen?.(pokemon)}>
                  #{String(pokemon.dexNumber).padStart(4, '0')} {pokemon.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="panel generator-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">My missing</span>
            <h2>Missing-Dex generator</h2>
          </div>
        </div>
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
                    <code tabIndex={0}>{value}</code>
                    <button
                      type="button"
                      className="button button--copy"
                      onClick={() => void handleCopy(value, `${result.categoryId}-${index}`)}
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
