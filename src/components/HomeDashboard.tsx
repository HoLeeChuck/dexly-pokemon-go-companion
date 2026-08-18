import { useMemo, useState } from 'react';
import { progressForCategory } from '../../shared/domain';
import type { CatalogItem, Category, CollectionEntry } from '../../shared/types';
import type { RouteId } from '../app/routing';
import { Icon } from './Icon';

const GENERAL_SEARCHES = [
  {
    name: 'Recent Shinies',
    value: '!traded&shiny&age0-7',
    note: 'Review untraded Shiny Pokémon caught in the last seven days.',
  },
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
  onNavigate: (route: RouteId) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const defaults = useMemo(() => catalog.filter((item) => item.isDefault), [catalog]);
  const normal = progressForCategory(defaults, entries, 'normal');
  const percent = normal.total ? Math.round((normal.collected / normal.total) * 100) : 0;
  const shortcuts = [
    ['Browse the Dex', 'Mark Pokémon and collection states.', 'dex', 'grid'],
    ['View Progress', 'Review completion by category and region.', 'progress', 'chart'],
    ['Find missing Pokémon', 'Copy collection-aware storage searches.', 'progress', 'search'],
    [
      'Import a collection',
      'Bring existing CSV or JSON data into CatchGrid.',
      'settings',
      'upload',
    ],
  ] as const;

  async function copy(value: string, id: string) {
    await navigator.clipboard.writeText(value);
    setCopied(id);
    window.setTimeout(() => setCopied((current) => (current === id ? null : current)), 1600);
  }

  return (
    <section className="page page--dashboard home-orientation">
      <header className="dashboard-hero home-welcome">
        <div>
          <span className="eyebrow eyebrow--light">Pokémon GO collection companion</span>
          <h1>Build the collection you care about.</h1>
          <p>
            CatchGrid keeps your collection private in this browser while helping you track Pokémon,
            spot gaps, and create useful Pokémon GO searches.
          </p>
        </div>
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
      <section className="home-section" aria-labelledby="how-title">
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
      <section className="home-section" aria-labelledby="shortcut-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Shortcuts</span>
            <h2 id="shortcut-title">What would you like to do?</h2>
          </div>
        </div>
        <div className="home-shortcut-grid">
          {shortcuts.map(([title, note, route, icon]) => (
            <button type="button" key={title} onClick={() => onNavigate(route)}>
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
        <section className="home-section" aria-labelledby="search-title">
          <span className="eyebrow">Useful searches</span>
          <h2 id="search-title">Ready for Pokémon GO</h2>
          <div className="home-search-list">
            {GENERAL_SEARCHES.map((search) => (
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
