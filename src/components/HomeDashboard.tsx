import { useMemo, useState } from 'react';
import { progressForCategory } from '../../shared/domain';
import type { CatalogItem, Category, CollectionEntry } from '../../shared/types';
import type { RouteId } from '../app/routing';
import { Icon } from './Icon';

const CODY_RECOMMENDED_SEARCHES = [
  {
    name: 'Untagged review',
    value: '!traded&!#',
    note: 'Find untraded Pokémon that do not have a tag.',
  },
] as const;

export function HomeDashboard({
  catalog,
  categories,
  entries,
  onNavigate,
}: {
  catalog: readonly CatalogItem[];
  categories: readonly Category[];
  entries: readonly CollectionEntry[];
  onNavigate: (route: RouteId, section?: string) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const defaults = useMemo(() => catalog.filter((item) => item.isDefault), [catalog]);
  const normal = progressForCategory(defaults, entries, 'normal');
  const percent = normal.total ? Math.round((normal.collected / normal.total) * 100) : 0;
  const shortcuts = [
    ['Browse the Dex', 'Mark Pokémon and collection states.', 'dex', 'grid', undefined],
    ['View Progress', 'Review completion by category and region.', 'progress', 'chart', undefined],
    [
      'Find missing Pokémon',
      'Copy collection-aware missing-Dex searches.',
      'search',
      'search',
      'missing-searches',
    ],
    [
      'Cody’s recommended strings',
      'Open Cody’s handy Pokémon GO search strings.',
      'search',
      'sparkles',
      'recommended-searches',
    ],
    [
      'Generate search strings',
      'Create Pokémon GO and Discord-ready lists.',
      'search',
      'clipboard',
      'share-tools',
    ],
    [
      'Import a collection',
      'Bring existing CSV or JSON data into CatchGrid.',
      'settings',
      'upload',
      undefined,
    ],
  ] as const;

  async function copy(value: string, id: string) {
    await navigator.clipboard.writeText(value);
    setCopied(id);
    window.setTimeout(() => setCopied((current) => (current === id ? null : current)), 1600);
  }

  return (
    <section className="page page--dashboard home-orientation">
      <header className="simple-page-header home-header">
        <h1>Home</h1>
        <div className="home-welcome__actions">
          <button
            className="button button--primary"
            type="button"
            onClick={() => onNavigate('dex')}
          >
            <Icon name="grid" /> Open Dex
          </button>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => onNavigate('progress')}
          >
            <Icon name="chart" /> View Progress
          </button>
        </div>
      </header>
      <section className="home-section home-shortcuts" aria-labelledby="shortcut-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Shortcuts</span>
            <h2 id="shortcut-title">What would you like to do?</h2>
          </div>
        </div>
        <div className="home-shortcut-grid">
          {shortcuts.map(([title, note, route, icon, section]) => (
            <button type="button" key={title} onClick={() => onNavigate(route, section)}>
              <Icon name={icon} />
              <span>
                <strong>{title}</strong>
                <small>{note}</small>
              </span>
              <Icon name="chevron-right" />
            </button>
          ))}
        </div>
      </section>
      <section className="home-section home-guide" aria-labelledby="how-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">How CatchGrid works</span>
            <h2 id="how-title">Four simple steps</h2>
          </div>
        </div>
        <ol className="home-steps">
          <li>
            <strong>Browse</strong>
            <span>Find Pokémon in the Dex.</span>
          </li>
          <li>
            <strong>Mark</strong>
            <span>Choose the collection states you have.</span>
          </li>
          <li>
            <strong>Review</strong>
            <span>See missing entries on Progress.</span>
          </li>
          <li>
            <strong>Use</strong>
            <span>Copy searches into Pokémon GO or Discord.</span>
          </li>
        </ol>
      </section>
      <div className="home-lower-grid">
        <section className="home-section collection-snapshot" aria-labelledby="snapshot-title">
          <span className="eyebrow">Your collection</span>
          <h2 id="snapshot-title">A quick snapshot</h2>
          <strong>{percent}%</strong>
          <p>
            {normal.collected} collected · {normal.missing} obtainable entries missing
          </p>
          <button
            type="button"
            className="button button--secondary"
            onClick={() => onNavigate('progress')}
          >
            Open full progress
          </button>
        </section>
        <section className="home-section home-recommendations" aria-labelledby="search-title">
          <span className="eyebrow">Cody’s picks</span>
          <h2 id="search-title">Recommended Search Strings</h2>
          <div className="home-search-list">
            {CODY_RECOMMENDED_SEARCHES.map((search) => (
              <article key={search.name}>
                <div>
                  <strong>{search.name}</strong>
                  <small>{search.note}</small>
                  <code>{search.value}</code>
                </div>
                <button type="button" onClick={() => void copy(search.value, search.name)}>
                  {copied === search.name ? 'Copied' : 'Copy'}
                </button>
              </article>
            ))}
          </div>
        </section>
      </div>
      <p className="sr-only">CatchGrid supports {categories.length} collection categories.</p>
    </section>
  );
}
