import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import evolutionFamilyData from '../../catalog/evolution-families.v1.json';
import {
  formatMissingSearchString,
  generateMissingSearchStrings,
  generatePersonalSizeCatchSearchStrings,
} from '../../shared/domain';
import type { MissingSearchMode } from '../../shared/domain';
import type { CatalogItem, Category, CategoryId, CollectionEntry } from '../../shared/types';
import {
  buildDiscordMessages,
  NITRO_DISCORD_MESSAGE_LIMIT,
  STANDARD_DISCORD_MESSAGE_LIMIT,
} from '../lib/discordShare';
import { createCatalogIndex } from '../catalog/catalogIndex';
import { collectionCategoryLabel } from '../catalog/capabilities';
import { defaultRegionCatalog } from '../catalog/regionMedals';
import { AdvancedSearchBuilder } from './AdvancedSearchBuilder';
import { Icon } from './Icon';
import { PokemonSprite } from './PokemonSprite';
import '../routes/search.css';
import '../routes/progress-refresh.css';

const SEARCH_CATEGORY_IDS = [
  'normal',
  'shiny',
  'xxl',
  'xxs',
] as const satisfies readonly CategoryId[];

const progressCategoryGlyphs: Record<CategoryId, string> = {
  normal: '◒',
  shiny: '✦',
  lucky: '♢',
  hundo: '100',
  xxl: 'XL',
  xxs: 'XS',
  shadow: '◐',
  purified: '◇',
};

const progressCategoryPrompts: Record<CategoryId, string> = {
  normal: 'Complete the core National Dex one species at a time.',
  shiny: 'Turn rare encounters into a complete color collection.',
  lucky: 'Use trades strategically to close your Lucky Dex gaps.',
  hundo: 'Keep sight of every perfect-IV trophy still out there.',
  xxl: 'Build a showcase-ready collection of giant specimens.',
  xxs: 'Track the smallest Pokémon hiding in your storage.',
  shadow: 'See which Team GO Rocket catches remain on your list.',
  purified: 'Measure your purified roster as its own collection lane.',
};

interface SearchRecommendation {
  id: string;
  name: string;
  description: string;
  help?: string;
  values: readonly string[];
  emptyMessage?: string;
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
  onOpen?: (item: CatalogItem, context: readonly CatalogItem[]) => void;
}) {
  const nationalCatalog = useMemo(() => catalog.filter((item) => item.isDefault), [catalog]);
  const catalogIndex = useMemo(() => createCatalogIndex(catalog), [catalog]);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [regionalCategory, setRegionalCategory] = useState<CategoryId>('normal');
  const [focusCategory, setFocusCategory] = useState<CategoryId>('normal');
  const collectedKeys = useMemo(
    () =>
      new Set(
        entries
          .filter((entry) => entry.collected)
          .map((entry) => `${entry.formId}:${entry.categoryId}`),
      ),
    [entries],
  );
  const categoryProgress = useMemo(
    () =>
      categories.map((category) => {
        const available = nationalCatalog.filter((item) => item.rules[category.id] === 'released');
        const collected = available.filter((item) =>
          collectedKeys.has(`${item.id}:${category.id}`),
        ).length;
        return {
          category,
          available: available.length,
          collected,
          missing: Math.max(0, available.length - collected),
          percentage: available.length ? Math.round((collected / available.length) * 100) : 0,
        };
      }),
    [categories, collectedKeys, nationalCatalog],
  );
  const regionProgress = useMemo(
    () =>
      catalogIndex.regions
        .filter((region) => region.toLowerCase() !== 'unknown')
        .map((region) => {
          const scoped = defaultRegionCatalog(catalogIndex, region);
          const available = scoped.filter((item) => item.rules[regionalCategory] === 'released');
          const collected = available.filter((item) =>
            collectedKeys.has(`${item.id}:${regionalCategory}`),
          ).length;
          return {
            region,
            available: available.length,
            collected,
            missing: Math.max(0, available.length - collected),
            percentage: available.length ? Math.round((collected / available.length) * 100) : 0,
          };
        }),
    [catalogIndex, collectedKeys, regionalCategory],
  );
  const closestRegion = useMemo(
    () =>
      [...regionProgress]
        .filter(({ available, percentage }) => available > 0 && percentage < 100)
        .sort(
          (left, right) => right.percentage - left.percentage || left.missing - right.missing,
        )[0] ?? regionProgress[0],
    [regionProgress],
  );
  const activeRegion = selectedRegion ?? closestRegion?.region ?? null;
  const activeRegionProgress =
    regionProgress.find(({ region }) => region === activeRegion) ?? closestRegion;
  const regionCatalog = useMemo(
    () => (activeRegion ? defaultRegionCatalog(catalogIndex, activeRegion) : []),
    [activeRegion, catalogIndex],
  );
  const regionalMissing = useMemo(
    () =>
      regionCatalog.filter(
        (item) =>
          item.rules[regionalCategory] === 'released' &&
          !collectedKeys.has(`${item.id}:${regionalCategory}`),
      ),
    [collectedKeys, regionCatalog, regionalCategory],
  );
  const focusProgress =
    categoryProgress.find(({ category }) => category.id === focusCategory) ?? categoryProgress[0];
  const normalProgress =
    categoryProgress.find(({ category }) => category.id === 'normal') ?? categoryProgress[0];
  const overallScore = categoryProgress.length
    ? Math.round(
        categoryProgress.reduce((total, progress) => total + progress.percentage, 0) /
          categoryProgress.length,
      )
    : 0;
  const nextMilestone = focusProgress
    ? focusProgress.percentage >= 100
      ? 100
      : Math.min(100, (Math.floor(focusProgress.percentage / 10) + 1) * 10)
    : 0;
  const nextMilestoneCount = focusProgress
    ? Math.ceil((focusProgress.available * nextMilestone) / 100)
    : 0;
  const catchesToMilestone = focusProgress
    ? Math.max(0, nextMilestoneCount - focusProgress.collected)
    : 0;
  const activeRegionLabel = activeRegion
    ? activeRegion.charAt(0).toUpperCase() + activeRegion.slice(1).toLowerCase()
    : 'Region';
  const regionalCategoryLabel =
    categories.find((item) => item.id === regionalCategory)?.label ?? regionalCategory;

  return (
    <section className="page page--progress">
      <header className="tool-page-header progress-page-header simple-page-header progress-command-hero">
        <div className="progress-command-hero__intro">
          <span className="progress-command-hero__eyebrow">
            <Icon name="chart" /> Collection intelligence
          </span>
          <h1>Progress</h1>
          <p>
            Turn your Pokédex into a plan. See the closest wins, pick a collection lane, and know
            exactly what to hunt next.
          </p>
        </div>
        <div
          className="progress-score-ring"
          style={{ '--progress-score': `${overallScore * 3.6}deg` } as CSSProperties}
          aria-label={`Collection score ${overallScore}%`}
        >
          <span>
            <strong>{overallScore}%</strong>
            <small>Score</small>
          </span>
        </div>
        <div className="progress-command-hero__signals">
          <article>
            <span>Core Dex</span>
            <strong>{normalProgress?.collected.toLocaleString() ?? 0}</strong>
            <small>of {normalProgress?.available.toLocaleString() ?? 0} species</small>
          </article>
          <article>
            <span>Closest finish</span>
            <strong>{closestRegion?.region ?? '—'}</strong>
            <small>{closestRegion?.missing.toLocaleString() ?? 0} catches away</small>
          </article>
          <article>
            <span>Active goal</span>
            <strong>{focusProgress ? `${nextMilestone}%` : '—'}</strong>
            <small>{catchesToMilestone} catches to milestone</small>
          </article>
        </div>
      </header>

      <section className="progress-overview" aria-labelledby="progress-overview-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Collection lanes</span>
            <h2 id="progress-overview-title">Pick your next goal</h2>
            <p className="section-scope-note">
              Each lane counts released default National Dex species. Select one to reveal its next
              milestone.
            </p>
          </div>
        </div>
        {focusProgress && (
          <div className="progress-focus-card" data-category={focusProgress.category.id}>
            <span className="progress-focus-card__glyph" aria-hidden="true">
              {progressCategoryGlyphs[focusProgress.category.id]}
            </span>
            <div>
              <span>Focused lane</span>
              <strong>{collectionCategoryLabel(focusProgress.category)}</strong>
              <small>{progressCategoryPrompts[focusProgress.category.id]}</small>
            </div>
            <div className="progress-focus-card__goal">
              <strong>
                {focusProgress.percentage >= 100 ? 'Complete' : `+${catchesToMilestone}`}
              </strong>
              <span>
                {focusProgress.percentage >= 100
                  ? 'Milestone cleared'
                  : `to reach ${nextMilestone}%`}
              </span>
            </div>
          </div>
        )}
        <div className="progress-summary-grid">
          {categoryProgress.map(({ category, available, collected, missing, percentage }) => {
            return (
              <button
                type="button"
                key={category.id}
                className={focusCategory === category.id ? 'is-active' : ''}
                data-category={category.id}
                aria-pressed={focusCategory === category.id}
                onClick={() => setFocusCategory(category.id)}
              >
                <div className="progress-card__top">
                  <span className="progress-card__identity">
                    <i aria-hidden="true">{progressCategoryGlyphs[category.id]}</i>
                    <strong>{collectionCategoryLabel(category)}</strong>
                  </span>
                  <span>{percentage}%</span>
                </div>
                <div className="progress-card__count">
                  <strong>{collected}</strong>
                  <span>{missing} left</span>
                </div>
                <progress
                  value={collected}
                  max={available || 1}
                  aria-label={`${collectionCategoryLabel(category)} ${percentage}% complete`}
                />
              </button>
            );
          })}
        </div>
      </section>

      <section className="regional-progress" aria-labelledby="regional-progress-title">
        <div className="section-heading regional-progress__heading">
          <div>
            <span className="eyebrow">Regional explorer</span>
            <h2 id="regional-progress-title">Find the fastest regional win</h2>
            <p className="section-scope-note">Jump between regions and open any missing target.</p>
          </div>
          <label>
            <span>Track lane</span>
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
        </div>
        <div className="region-shortcut-grid">
          {regionProgress.map(({ region, available, collected, missing, percentage }) => {
            const label = region.charAt(0).toUpperCase() + region.slice(1).toLowerCase();
            return (
              <button
                type="button"
                key={region}
                className={activeRegion === region ? 'is-active' : ''}
                aria-pressed={activeRegion === region}
                onClick={() => setSelectedRegion(region)}
              >
                <span className="region-shortcut__mark" aria-hidden="true">
                  {label.slice(0, 2)}
                </span>
                <span className="region-shortcut__top">
                  <strong>{label}</strong>
                  <span>{percentage}%</span>
                </span>
                <progress
                  value={collected}
                  max={available || 1}
                  aria-label={`${label} ${percentage}% complete`}
                />
                <small>
                  {collected}/{available} caught · {missing} left
                </small>
              </button>
            );
          })}
        </div>
        {activeRegion ? (
          <div className="regional-detail">
            <div className="regional-detail__summary">
              <span className="regional-detail__medal" aria-hidden="true">
                {activeRegionLabel.slice(0, 2)}
              </span>
              <div>
                <span>Your {regionalCategoryLabel} route</span>
                <strong>{activeRegionLabel}</strong>
                <small>
                  {regionalMissing.length
                    ? `${regionalMissing.length} obtainable targets remain`
                    : 'Every available target is caught'}
                </small>
              </div>
              <div className="regional-detail__score">
                <strong>{activeRegionProgress?.percentage ?? 0}%</strong>
                <span>complete</span>
              </div>
            </div>
            {regionalMissing.length ? (
              <div className="regional-target-board">
                <div className="regional-target-board__heading">
                  <span>Next targets</span>
                  <small>Tap a Pokémon for collection details</small>
                </div>
                <div className="regional-missing-list">
                  {regionalMissing.map((pokemon) => (
                    <button
                      type="button"
                      key={pokemon.id}
                      onClick={() => onOpen?.(pokemon, regionalMissing)}
                    >
                      <PokemonSprite item={pokemon} />
                      <span>
                        <small>#{String(pokemon.dexNumber).padStart(4, '0')}</small>
                        <strong>{pokemon.name}</strong>
                      </span>
                      <Icon name="chevron-right" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="regional-detail__complete">
                <Icon name="check" />
                <span>
                  <strong>Region complete</strong>
                  <small>Switch lanes to find the next challenge.</small>
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="regional-progress__empty">
            <Icon name="search" />
            <span>
              <strong>Choose a region</strong>
              <small>Its missing obtainable Pokémon will appear here.</small>
            </span>
          </div>
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
  const [missingSearchMode, setMissingSearchMode] = useState<MissingSearchMode>('none');
  const [evolutionAwareSizes, setEvolutionAwareSizes] = useState(false);
  const [discordNitro, setDiscordNitro] = useState(false);
  const [sharedCategories, setSharedCategories] = useState<Set<CategoryId>>(
    () => new Set(SEARCH_CATEGORY_IDS),
  );

  const labels = useMemo(
    () => new Map(categories.map((category) => [category.id, collectionCategoryLabel(category)])),
    [categories],
  );
  const nationalCatalog = useMemo(() => catalog.filter((item) => item.isDefault), [catalog]);
  const discordMessageLimit = discordNitro
    ? NITRO_DISCORD_MESSAGE_LIMIT
    : STANDARD_DISCORD_MESSAGE_LIMIT;
  const discordSearchLimit = discordMessageLimit - 500;
  const results = useMemo(
    () =>
      SEARCH_CATEGORY_IDS.map((categoryId) => {
        const isSizeCategory = categoryId === 'xxl' || categoryId === 'xxs';
        const generate = (maxLength: number) =>
          evolutionAwareSizes && isSizeCategory
            ? generatePersonalSizeCatchSearchStrings(nationalCatalog, entries, categoryId, {
                maxLength,
                evolutionFamilies: evolutionFamilyData.families,
              })
            : generateMissingSearchStrings(nationalCatalog, entries, categoryId, { maxLength });
        const missing = generateMissingSearchStrings(nationalCatalog, entries, categoryId, {
          maxLength: 4_500,
        });
        const generated = generate(4_500);
        const discord = generate(discordSearchLimit);
        return {
          categoryId,
          label: labels.get(categoryId) ?? categoryId.toUpperCase(),
          generated,
          discord,
          missingCount: missing.dexNumbers.length,
        };
      }),
    [discordSearchLimit, entries, evolutionAwareSizes, labels, nationalCatalog],
  );
  const discordMessages = useMemo(
    () =>
      buildDiscordMessages(
        results
          .filter((result) => sharedCategories.has(result.categoryId))
          .map((result) => ({ label: result.label, strings: result.discord.strings })),
        { maxLength: discordMessageLimit },
      ),
    [discordMessageLimit, results, sharedCategories],
  );
  const recommendedXXL = useMemo(
    () =>
      generatePersonalSizeCatchSearchStrings(nationalCatalog, entries, 'xxl', {
        maxLength: 4_500,
        evolutionFamilies: evolutionFamilyData.families,
      }),
    [entries, nationalCatalog],
  );
  const recommendedXXS = useMemo(
    () =>
      generatePersonalSizeCatchSearchStrings(nationalCatalog, entries, 'xxs', {
        maxLength: 4_500,
        evolutionFamilies: evolutionFamilyData.families,
      }),
    [entries, nationalCatalog],
  );
  const recommendations: readonly SearchRecommendation[] = [
    {
      id: 'trade',
      name: 'Trade',
      description:
        'Quickly open Pokémon you have tagged for trading. The trailing & lets you immediately append another Pokémon GO search term, for example #trade&pikachu.',
      help: '“trade” is Cody’s tag name, not a requirement. Replace it with any trade-storage tag you use, such as “adoption”.',
      values: ['#trade&'],
    },
    {
      id: 'megas',
      name: 'Megas',
      description:
        'Show Mega Level 2–3 Pokémon you deliberately keep in your active Mega rotation. Newer Super Mega Raid catches may already have Mega Level 1 unlocked, so the #max tag keeps those extra results from cluttering the rotation.',
      help: '“max” is Cody’s tag name and can be replaced. Avoid naming the custom tag “mega” because Pokémon GO already uses mega in its built-in search syntax.',
      values: ['#max&mega2-3&'],
    },
    {
      id: 'tag',
      name: 'Tag',
      description:
        'Review untagged Pokémon that may be valuable or unusual: 4-star, shiny, costume, background, 20 km buddy-distance, Dynamax, Gigantamax, or lucky.',
      help: 'Use this as an organization pass; the trailing & leaves room for another condition.',
      values: ['!#&4*,shiny,costume,background,candykm20,dynamax,gigantamax,lucky&'],
    },
    {
      id: 'evolve',
      name: 'Evolve',
      description:
        'Find untagged Pokémon that can evolve into a Pokédex entry you have not registered yet.',
      values: ['!#&evolvenew&'],
    },
    {
      id: 'special-moves',
      name: 'Special Moves',
      description:
        'Find untagged Pokémon with Frustration, Return, or special/legacy move results worth reviewing before transferring or organizing.',
      values: ['!#&@frustration,@return,@special&'],
    },
    {
      id: 'untagged',
      name: 'Untagged',
      description:
        'Find Pokémon with no tag assigned. The trailing & lets you add another filter, for example !#&kanto.',
      values: ['!#&'],
    },
    {
      id: 'xxl',
      name: 'XXL',
      description:
        'Find untagged XXL Pokémon that could fill missing XXL collection entries, including useful earlier stages that can evolve into a missing entry.',
      help: `${recommendedXXL.missingDexNumbers.length} released XXL collection entries are currently missing. This search updates with your CatchGrid collection.`,
      values: recommendedXXL.strings.map((value) => formatMissingSearchString(value, 'personal')),
      emptyMessage: 'No released XXL collection entries are currently missing.',
    },
    {
      id: 'xxs',
      name: 'XXS',
      description:
        'Find untagged XXS Pokémon that could fill missing XXS collection entries, including useful earlier stages that can evolve into a missing entry.',
      help: `${recommendedXXS.missingDexNumbers.length} released XXS collection entries are currently missing. This search updates with your CatchGrid collection.`,
      values: recommendedXXS.strings.map((value) => formatMissingSearchString(value, 'personal')),
      emptyMessage: 'No released XXS collection entries are currently missing.',
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

  useEffect(() => {
    const query = window.location.hash.split('?')[1];
    const section = query ? new URLSearchParams(query).get('section') : null;
    if (!section) return;
    const frame = window.requestAnimationFrame(() =>
      document
        .getElementById(section)
        ?.scrollIntoView({ block: 'start', inline: 'start', behavior: 'auto' }),
    );
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <section className="page page--lab page--search-lab" aria-labelledby="search-lab-title">
      <header className="tool-page-header search-page-header simple-page-header">
        <h1 id="search-lab-title">Search Lab</h1>
      </header>

      <AdvancedSearchBuilder />

      <section
        className="panel generator-panel tool-panel tool-panel--missing"
        id="missing-searches"
      >
        <div className="panel-heading">
          <div className="tool-panel__title">
            <span className="tool-panel__icon" aria-hidden="true">
              <Icon name="search" />
            </span>
            <h2>My Missing</h2>
          </div>
          <div className="missing-search-mode" role="group" aria-label="Missing search format">
            <button
              type="button"
              aria-pressed={missingSearchMode === 'none'}
              onClick={() => {
                setCopied(null);
                setMissingSearchMode('none');
              }}
            >
              None
            </button>
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
          {missingSearchMode === 'none'
            ? 'Uses only the missing Pokémon and category terms, with no storage modifier.'
            : missingSearchMode === 'personal'
              ? 'Adds !# to find missing candidates in your untagged personal storage.'
              : 'Adds !traded to find missing candidates that can still be traded.'}
        </p>
        <label className="search-option-toggle evolution-aware-toggle">
          <input
            type="checkbox"
            checked={evolutionAwareSizes}
            onChange={(event) => {
              setCopied(null);
              setEvolutionAwareSizes(event.target.checked);
            }}
          />
          <span>
            <strong>Evolution-aware XXL &amp; XXS</strong>
            <small>Include earlier family stages that can evolve into a size entry you need.</small>
          </span>
        </label>
        <div className="all-category-searches">
          {results.map((result) => (
            <section className="search-output" key={result.categoryId}>
              <div className="search-output__meta">
                <strong>{result.label}</strong>
                <span>{result.missingCount} missing</span>
              </div>
              {result.generated.strings.length ? (
                result.generated.strings.map((value, index) => (
                  <div className="search-string" key={value}>
                    <code tabIndex={0}>{formatMissingSearchString(value, missingSearchMode)}</code>
                    <button
                      type="button"
                      className="button button--copy"
                      onClick={() =>
                        void handleCopy(
                          formatMissingSearchString(value, missingSearchMode),
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

      <section
        className="panel recommended-panel tool-panel tool-panel--recommended"
        id="recommended-searches"
      >
        <div className="panel-heading">
          <div className="tool-panel__title">
            <span className="tool-panel__icon" aria-hidden="true">
              <Icon name="sparkles" />
            </span>
            <h2>Cody’s Recommended</h2>
          </div>
        </div>
        <div className="recommended-list">
          {recommendations.map((item) => (
            <article key={item.id}>
              <div className="recommended-content">
                <h3>{item.name}</h3>
                <p className="recommended-description">{item.description}</p>
                {item.values.length > 0 ? (
                  <div className="recommended-queries">
                    {item.values.map((value, index) => {
                      const copyId = `recommended-${item.id}-${index}`;
                      return (
                        <div className="recommended-query-row" key={value}>
                          <code className="recommended-query" tabIndex={0}>
                            {value}
                          </code>
                          <button
                            type="button"
                            className="button button--secondary recommended-copy"
                            aria-label={`Copy ${item.name}${item.values.length > 1 ? ` ${index + 1}` : ''}`}
                            onClick={() => void handleCopy(value, copyId)}
                          >
                            <Icon name={copied === copyId ? 'check' : 'clipboard'} />
                            {copied === copyId ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="recommended-empty">{item.emptyMessage}</p>
                )}
                {item.help && <p className="recommended-note">{item.help}</p>}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel discord-share-panel tool-panel tool-panel--share" id="share-tools">
        <div className="panel-heading">
          <div className="tool-panel__title">
            <span className="tool-panel__icon" aria-hidden="true">
              <Icon name="clipboard" />
            </span>
            <h2>Share With Friends</h2>
          </div>
          <label className="search-option-toggle discord-nitro-toggle">
            <input
              type="checkbox"
              checked={discordNitro}
              onChange={(event) => setDiscordNitro(event.target.checked)}
            />
            <span>
              <strong>I use Discord Nitro</strong>
              <small>Use the 4,000-character message limit.</small>
            </span>
          </label>
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
                  <small>{available ? `${result.missingCount} missing` : 'Complete'}</small>
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
                  <small>
                    {message.length}/{discordMessageLimit.toLocaleString()} characters
                  </small>
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
    </section>
  );
}
