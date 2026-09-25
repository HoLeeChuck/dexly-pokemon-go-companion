import { useMemo, useState, type CSSProperties } from 'react';
import { progressForCategory } from '../../shared/domain';
import type { CatalogItem, Category, CollectionEntry } from '../../shared/types';
import type { RouteId } from '../app/routing';
import { closestIncompleteRegion, regionProgresses } from '../lib/collectionProgress';
import { Icon } from './Icon';
import { PokemonSprite } from './PokemonSprite';
import '../routes/home-refresh.css';

const CODY_RECOMMENDED_SEARCHES = [
  {
    name: 'Untagged review',
    value: '!traded&!#',
    note: 'Find untraded Pokémon that do not have a tag.',
  },
  {
    name: 'Daily catch review',
    value: 'age0&!#',
    note: 'Review everything caught today that is still untagged.',
  },
] as const;

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

export function HomeDashboard({
  catalog,
  categories,
  entries,
  onNavigate,
  onOpen,
}: {
  catalog: readonly CatalogItem[];
  categories: readonly Category[];
  entries: readonly CollectionEntry[];
  onNavigate: (route: RouteId, section?: string) => void;
  onOpen: (item: CatalogItem, context: readonly CatalogItem[]) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const defaults = useMemo(() => catalog.filter((item) => item.isDefault), [catalog]);
  const normal = progressForCategory(defaults, entries, 'normal');
  const shiny = progressForCategory(defaults, entries, 'shiny');
  const hundo = progressForCategory(defaults, entries, 'hundo');
  const hasCollection = entries.some((entry) => entry.collected);
  const percent = normal.total ? Math.round((normal.collected / normal.total) * 100) : 0;
  const ownedNormal = useMemo(
    () =>
      new Set(
        entries
          .filter((entry) => entry.categoryId === 'normal' && entry.collected)
          .map((entry) => entry.formId),
      ),
    [entries],
  );
  const nextTargets = useMemo(
    () =>
      defaults
        .filter((item) => item.rules.normal === 'released' && !ownedNormal.has(item.id))
        .slice(0, 6),
    [defaults, ownedNormal],
  );
  const regions = useMemo(
    () =>
      regionProgresses(catalog, entries, 'normal').filter(
        ({ region }) => region.toLowerCase() !== 'unknown',
      ),
    [catalog, entries],
  );
  const closestRegion = useMemo(() => closestIncompleteRegion(regions), [regions]);
  async function copy(value: string, id: string) {
    await navigator.clipboard.writeText(value);
    setCopied(id);
    window.setTimeout(() => setCopied((current) => (current === id ? null : current)), 1600);
  }

  return (
    <section className="page page--dashboard catchgrid-home">
      <header className="home-command-hero">
        <div className="home-command-hero__copy">
          <span className="eyebrow eyebrow--light">
            <Icon name="sparkles" /> Your collection
          </span>
          <h1>{hasCollection ? 'Ready for your next catch.' : 'Your collection starts here.'}</h1>
          <p>
            {hasCollection
              ? 'Pick up where you left off, find your gaps, and plan your next hunt.'
              : 'Mark the Pokémon you have or import a collection to see what to catch next.'}
          </p>
          <div className="home-command-hero__actions">
            <button
              className="button home-hero-primary"
              type="button"
              onClick={() => onNavigate('dex')}
            >
              <Icon name="grid" /> {hasCollection ? 'Continue tracking' : 'Start tracking'}
            </button>
            <button
              className="button home-hero-secondary"
              type="button"
              onClick={() =>
                hasCollection
                  ? onNavigate('search', 'search-builder')
                  : onNavigate('settings', 'import')
              }
            >
              <Icon name={hasCollection ? 'sliders' : 'upload'} />
              {hasCollection ? 'Build a search' : 'Import collection'}
            </button>
          </div>
        </div>
        <div
          className="home-progress-orbit"
          style={{ '--home-progress': `${percent}%` } as CSSProperties}
        >
          <div>
            <strong>{percent}%</strong>
            <span>National Dex</span>
          </div>
          <small>
            {normal.collected} of {normal.total} obtainable
          </small>
        </div>
      </header>

      <section className="home-metric-strip" aria-label="Collection highlights">
        <article>
          <span className="home-metric-icon">
            <Icon name="grid" />
          </span>
          <span>
            <small>Species caught</small>
            <strong>{normal.collected.toLocaleString()}</strong>
          </span>
          <b>{normal.missing} left</b>
        </article>
        <article>
          <span className="home-metric-icon home-metric-icon--shiny">
            <Icon name="sparkles" />
          </span>
          <span>
            <small>Shiny Dex</small>
            <strong>{shiny.collected.toLocaleString()}</strong>
          </span>
          <b>{shiny.total ? Math.round((shiny.collected / shiny.total) * 100) : 0}%</b>
        </article>
        <article>
          <span className="home-metric-icon home-metric-icon--hundo">
            <strong>100</strong>
          </span>
          <span>
            <small>Perfects tracked</small>
            <strong>{hundo.collected.toLocaleString()}</strong>
          </span>
          <b>Hundo</b>
        </article>
        <button type="button" onClick={() => onNavigate('progress')}>
          <span>
            <small>Full breakdown</small>
            <strong>View progress</strong>
          </span>
          <Icon name="chevron-right" />
        </button>
      </section>

      <div className="home-command-grid">
        <section className="home-card home-smart-goal" aria-labelledby="smart-goal-title">
          <div className="home-card__heading">
            <div>
              <span className="eyebrow">Smart goal</span>
              <h2 id="smart-goal-title">Your closest region</h2>
            </div>
            <Icon name="compass" />
          </div>
          {closestRegion ? (
            <>
              <div className="home-region-score">
                <div>
                  <strong>{titleCase(closestRegion.region)}</strong>
                  <span>{closestRegion.percentage}% complete</span>
                </div>
                <b>
                  {closestRegion.missing.length}
                  <small>left</small>
                </b>
              </div>
              <progress value={closestRegion.collected} max={closestRegion.total || 1} />
              <p>Finish this region first for the quickest visible collection win.</p>
            </>
          ) : (
            <p>Your released regional species collection is complete.</p>
          )}
          <button
            className="button button--secondary button--full"
            type="button"
            onClick={() => onNavigate('progress')}
          >
            Explore regional progress <Icon name="chevron-right" />
          </button>
        </section>

        <section className="home-card home-builder-card" aria-labelledby="builder-home-title">
          <div className="home-card__heading">
            <h2 id="builder-home-title">Build your own search</h2>
            <Icon name="sliders" />
          </div>
          <p>Combine appraisal, collection traits, and custom keywords into a Pokémon GO search.</p>
          <p>Start with a preset, adjust the filters, then copy the result into the game.</p>
          <button
            className="button button--secondary button--full"
            type="button"
            onClick={() => onNavigate('search', 'search-builder')}
          >
            Open Search Builder <Icon name="chevron-right" />
          </button>
        </section>

        <section className="home-card home-search-card" aria-labelledby="home-search-title">
          <div className="home-card__heading">
            <div>
              <span className="eyebrow">Search Lab</span>
              <h2 id="home-search-title">Trainer-ready strings</h2>
            </div>
            <Icon name="flask" />
          </div>
          <div className="home-search-list">
            {CODY_RECOMMENDED_SEARCHES.map((search) => (
              <article key={search.name}>
                <div>
                  <strong>{search.name}</strong>
                  <small>{search.note}</small>
                  <code>{search.value}</code>
                </div>
                <button type="button" onClick={() => void copy(search.value, search.name)}>
                  <Icon name={copied === search.name ? 'check' : 'clipboard'} />
                  {copied === search.name ? 'Copied' : 'Copy'}
                </button>
              </article>
            ))}
          </div>
          <button
            className="button button--secondary button--full"
            type="button"
            onClick={() => onNavigate('search', 'search-builder')}
          >
            Build a custom search <Icon name="chevron-right" />
          </button>
        </section>
      </div>

      <section className="home-card home-next-targets" aria-labelledby="next-target-title">
        <div className="home-card__heading">
          <div>
            <span className="eyebrow">Next up</span>
            <h2 id="next-target-title">Continue your National Dex</h2>
            <p>The next obtainable species still missing from your standard collection.</p>
          </div>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => onNavigate('dex', 'missing')}
          >
            Open missing view <Icon name="chevron-right" />
          </button>
        </div>
        {nextTargets.length > 0 ? (
          <div className="home-target-grid">
            {nextTargets.map((item) => (
              <button
                type="button"
                key={item.id}
                data-primary-type={item.types[0]?.toLowerCase()}
                onClick={() => onOpen(item, nextTargets)}
              >
                <span className="home-target-number">
                  #{String(item.dexNumber).padStart(4, '0')}
                </span>
                <PokemonSprite item={item} />
                <strong>{item.name}</strong>
                <small>{item.types.map(titleCase).join(' · ')}</small>
              </button>
            ))}
          </div>
        ) : (
          <div className="home-complete-state">
            <Icon name="sparkles" />
            <strong>Every obtainable species is tracked</strong>
          </div>
        )}
      </section>

      <section className="home-launch-grid" aria-label="CatchGrid tools">
        {(
          [
            ['Progress', 'See completion by category and region.', 'progress', 'chart'],
            ['Search Lab', 'Generate collection-aware GO searches.', 'search', 'flask'],
            ['Data & backup', 'Import, export, and protect your collection.', 'settings', 'shield'],
          ] as const
        ).map(([title, note, route, icon]) => (
          <button type="button" key={route} onClick={() => onNavigate(route)}>
            <span>
              <Icon name={icon} />
            </span>
            <div>
              <strong>{title}</strong>
              <small>{note}</small>
            </div>
            <Icon name="chevron-right" />
          </button>
        ))}
      </section>
      <p className="sr-only">CatchGrid supports {categories.length} collection categories.</p>
    </section>
  );
}
