import { useMemo, useState } from 'react';
import {
  buildPokemonGoSearch,
  SEARCH_RESOURCE_SOURCE,
  SEARCH_RESOURCE_UPDATED_AT,
  SEARCH_TERMS,
  type SearchClause,
  type SearchJoin,
} from '../../shared/searchBuilder';
import type { SavedSearch } from '../lib/savedSearches';
import { Icon } from './Icon';

const firstTerm = SEARCH_TERMS[0]!;

function newClause(): SearchClause {
  return {
    id: crypto.randomUUID(),
    termId: firstTerm.id,
    value: '',
    excluded: false,
  };
}

export function SearchBuilder({
  savedSearches,
  onSave,
  onRemove,
  onCopy,
}: {
  savedSearches: readonly SavedSearch[];
  onSave: (search: SavedSearch) => void;
  onRemove: (id: string) => void;
  onCopy: (value: string, id: string) => void;
}) {
  const [join, setJoin] = useState<SearchJoin>('and');
  const [clauses, setClauses] = useState<SearchClause[]>([newClause()]);
  const [name, setName] = useState('');
  const built = useMemo(() => buildPokemonGoSearch(clauses, join), [clauses, join]);

  function updateClause(id: string, update: Partial<SearchClause>) {
    setClauses((current) =>
      current.map((clause) => (clause.id === id ? { ...clause, ...update } : clause)),
    );
  }

  function save() {
    if (!built.valid || !name.trim()) return;
    const now = new Date().toISOString();
    onSave({
      id: crypto.randomUUID(),
      name: name.trim(),
      query: built.query,
      quality: built.quality,
      interpretation: built.interpretation,
      builder: {
        version: 1,
        join,
        clauses: clauses.map((clause) => ({
          id: clause.id,
          polarity: clause.excluded ? 'exclude' : 'include',
          term: clause.termId,
          value: clause.value,
        })),
      },
      createdAt: now,
      updatedAt: now,
    });
    setName('');
  }

  return (
    <section className="panel search-builder-panel" aria-labelledby="search-builder-title">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Build your own</span>
          <h2 id="search-builder-title">Visual search builder</h2>
        </div>
        <Icon name="filter" />
      </div>
      <p className="panel-intro">
        Combine current Pokémon GO search terms. CatchGrid protects every branch with{' '}
        <code>!traded&amp;</code>.
      </p>

      <div className="builder-join" role="group" aria-label="How conditions are combined">
        {(['and', 'or'] as const).map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={join === value}
            onClick={() => setJoin(value)}
          >
            Match {value === 'and' ? 'all (AND)' : 'any (OR)'}
          </button>
        ))}
      </div>

      <div className="builder-clauses">
        {clauses.map((clause, index) => {
          const definition =
            SEARCH_TERMS.find((candidate) => candidate.id === clause.termId) ?? firstTerm;
          return (
            <fieldset key={clause.id}>
              <legend>Condition {index + 1}</legend>
              <label>
                Action
                <select
                  value={clause.excluded ? 'exclude' : 'include'}
                  onChange={(event) =>
                    updateClause(clause.id, { excluded: event.target.value === 'exclude' })
                  }
                >
                  <option value="include">Include</option>
                  <option value="exclude">Exclude</option>
                </select>
              </label>
              <label>
                Term
                <select
                  value={clause.termId}
                  onChange={(event) =>
                    updateClause(clause.id, { termId: event.target.value, value: '' })
                  }
                >
                  {SEARCH_TERMS.map((term) => (
                    <option key={term.id} value={term.id}>
                      {term.group} · {term.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Value
                {definition.choices ? (
                  <select
                    value={clause.value}
                    onChange={(event) => updateClause(clause.id, { value: event.target.value })}
                  >
                    <option value="">Choose…</option>
                    {definition.choices.map((choice) => (
                      <option key={choice.value} value={choice.value}>
                        {choice.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={clause.value}
                    placeholder={definition.placeholder}
                    onChange={(event) => updateClause(clause.id, { value: event.target.value })}
                  />
                )}
              </label>
              <p>{definition.description}</p>
              <button
                type="button"
                className="icon-button"
                disabled={clauses.length === 1}
                aria-label={`Remove condition ${index + 1}`}
                onClick={() =>
                  setClauses((current) => current.filter((candidate) => candidate.id !== clause.id))
                }
              >
                <Icon name="close" />
              </button>
            </fieldset>
          );
        })}
      </div>
      <button
        type="button"
        className="button button--secondary"
        onClick={() => setClauses((current) => [...current, newClause()])}
      >
        <Icon name="plus" /> Add condition
      </button>

      <div className={`builder-result builder-result--${built.quality}`} aria-live="polite">
        <div>
          <span className="quality-pill">{built.quality}</span>
          <strong>{built.interpretation}</strong>
        </div>
        <code tabIndex={0}>{built.query}</code>
        {built.warnings.length > 0 && (
          <ul>
            {built.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="button button--primary"
          disabled={!built.valid}
          onClick={() => onCopy(built.query, 'visual-builder')}
        >
          <Icon name="clipboard" /> Copy search
        </button>
      </div>

      <div className="save-search-row">
        <label>
          Save this search
          <input
            value={name}
            maxLength={60}
            placeholder="e.g. Recent shiny XXL"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="button button--secondary"
          disabled={!built.valid || !name.trim()}
          onClick={save}
        >
          <Icon name="plus" /> Save
        </button>
      </div>

      {savedSearches.length > 0 && (
        <div className="saved-search-list">
          <h3>Saved searches</h3>
          {savedSearches.map((search) => (
            <article key={search.id}>
              <div>
                <strong>{search.name}</strong>
                <code>{search.query}</code>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label={`Copy ${search.name}`}
                onClick={() => onCopy(search.query, search.id)}
              >
                <Icon name="clipboard" />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label={`Delete ${search.name}`}
                onClick={() => onRemove(search.id)}
              >
                <Icon name="close" />
              </button>
            </article>
          ))}
        </div>
      )}

      <details className="search-resources">
        <summary>Search syntax & safety resources</summary>
        <div>
          <p>
            <strong>AND:</strong> <code>&amp;</code> narrows results. <strong>OR:</strong>{' '}
            <code>,</code>, <code>:</code>, or <code>;</code> broadens results.{' '}
            <strong>Exclude:</strong> prefix a term with <code>!</code>. CatchGrid repeats{' '}
            <code>!traded&amp;</code> on every OR branch so traded Pokémon cannot leak back into the
            results.
          </p>
          <p>
            Candidate searches depend on game state, such as available Candy or prior family
            catches. Review results before acting.
          </p>
          <p>
            Resource reviewed {SEARCH_RESOURCE_UPDATED_AT}.{' '}
            <a href={SEARCH_RESOURCE_SOURCE} target="_blank" rel="noreferrer">
              Official Pokémon GO search documentation
            </a>
          </p>
        </div>
      </details>
    </section>
  );
}
