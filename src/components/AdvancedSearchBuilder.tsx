import { useMemo, useState } from 'react';
import { Icon } from './Icon';
import '../routes/search-builder.css';

interface SearchChip {
  id: string;
  label: string;
  value: string;
  note: string;
}

const SEARCH_CHIPS: readonly SearchChip[] = [
  { id: 'recent', label: 'Caught today', value: 'age0', note: 'Only Pokémon caught today' },
  { id: 'unreviewed', label: 'Untagged', value: '!#', note: 'No Pokémon GO tag' },
  { id: 'untraded', label: 'Not traded', value: '!traded', note: 'Exclude traded Pokémon' },
  { id: 'shiny', label: 'Shiny', value: 'shiny', note: 'Shiny Pokémon only' },
  { id: 'shadow', label: 'Shadow', value: 'shadow', note: 'Shadow Pokémon only' },
  { id: 'lucky', label: 'Lucky', value: 'lucky', note: 'Lucky Pokémon only' },
  { id: 'xxl', label: 'XXL', value: 'xxl', note: 'XXL Pokémon only' },
  { id: 'xxs', label: 'XXS', value: 'xxs', note: 'XXS Pokémon only' },
  { id: 'evolve', label: 'Can evolve', value: 'evolve', note: 'Enough Candy to evolve' },
  {
    id: 'mega',
    label: 'Can Mega Evolve',
    value: 'megaevolve',
    note: 'Mega Evolution is available',
  },
  { id: 'favorite', label: 'Favorite', value: 'favorite', note: 'Favorited Pokémon only' },
  { id: 'distance', label: '100 km+', value: 'distance100-', note: 'Caught at least 100 km away' },
] as const;

const QUALITY_OPTIONS = [
  { id: 'any', label: 'Any appraisal', value: '' },
  { id: 'transfer', label: '0–2 stars', value: '0*,1*,2*' },
  { id: 'three', label: '3 stars', value: '3*' },
  { id: 'perfect', label: 'Perfect', value: '4*' },
] as const;

const PRESETS = [
  {
    id: 'daily-review',
    name: 'Daily catch review',
    note: 'Today’s catches that are not tagged or traded.',
    quality: 'any',
    chips: ['recent', 'unreviewed', 'untraded'],
  },
  {
    id: 'safe-transfer',
    name: 'Transfer candidates',
    note: 'Recent 0–2 star Pokémon with common keepers excluded.',
    quality: 'transfer',
    chips: ['recent', 'untraded'],
    custom: ['!shiny', '!legendary', '!mythical', '!favorite'],
  },
  {
    id: 'evolution',
    name: 'Evolution session',
    note: 'Pokémon ready to evolve that are not traded.',
    quality: 'any',
    chips: ['evolve', 'untraded'],
  },
  {
    id: 'trade-distance',
    name: 'Distance trade stock',
    note: 'Pokémon caught at least 100 km away and still tradeable.',
    quality: 'any',
    chips: ['distance', 'untraded'],
  },
] as const;

export function AdvancedSearchBuilder() {
  const [quality, setQuality] = useState('any');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(['recent', 'unreviewed']));
  const [customTerms, setCustomTerms] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState('');
  const [copied, setCopied] = useState(false);

  const query = useMemo(() => {
    const qualityValue = QUALITY_OPTIONS.find((option) => option.id === quality)?.value;
    const chipValues = SEARCH_CHIPS.filter((chip) => selected.has(chip.id)).map(
      (chip) => chip.value,
    );
    return [qualityValue, ...chipValues, ...customTerms].filter(Boolean).join('&');
  }, [customTerms, quality, selected]);

  function toggleChip(id: string) {
    setCopied(false);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function applyPreset(preset: (typeof PRESETS)[number]) {
    setQuality(preset.quality);
    setSelected(new Set<string>(preset.chips));
    setCustomTerms('custom' in preset ? [...preset.custom] : []);
    setCopied(false);
  }

  function addCustomTerm() {
    const normalized = customInput.trim().replace(/^&+|&+$/g, '');
    if (!normalized || customTerms.includes(normalized)) return;
    setCustomTerms((current) => [...current, normalized]);
    setCustomInput('');
    setCopied(false);
  }

  async function copyQuery() {
    if (!query) return;
    try {
      await navigator.clipboard.writeText(query);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section
      className="panel tool-panel search-builder"
      id="search-builder"
      aria-labelledby="search-builder-title"
    >
      <div className="search-builder__heading">
        <div className="tool-panel__title">
          <span className="tool-panel__icon" aria-hidden="true">
            <Icon name="sliders" />
          </span>
          <div>
            <span className="eyebrow">Build your own</span>
            <h2 id="search-builder-title">Visual Search Builder</h2>
          </div>
        </div>
        <p>Combine familiar Pokémon GO filters without memorizing every keyword.</p>
      </div>

      <div className="search-preset-grid" aria-label="Search presets">
        {PRESETS.map((preset) => (
          <button type="button" key={preset.id} onClick={() => applyPreset(preset)}>
            <Icon name="sparkles" />
            <span>
              <strong>{preset.name}</strong>
              <small>{preset.note}</small>
            </span>
            <Icon name="chevron-right" />
          </button>
        ))}
      </div>

      <div className="search-builder__workspace">
        <div className="search-builder__controls">
          <fieldset>
            <legend>Appraisal</legend>
            <div className="quality-picker">
              {QUALITY_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  aria-pressed={quality === option.id}
                  onClick={() => {
                    setQuality(option.id);
                    setCopied(false);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Filters</legend>
            <div className="search-chip-grid">
              {SEARCH_CHIPS.map((chip) => (
                <button
                  type="button"
                  key={chip.id}
                  aria-pressed={selected.has(chip.id)}
                  title={chip.note}
                  onClick={() => toggleChip(chip.id)}
                >
                  <Icon name={selected.has(chip.id) ? 'check' : 'plus'} /> {chip.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Custom keyword</legend>
            <form
              className="custom-search-term"
              onSubmit={(event) => {
                event.preventDefault();
                addCustomTerm();
              }}
            >
              <input
                value={customInput}
                onChange={(event) => setCustomInput(event.target.value)}
                placeholder="Example: buddy3-5 or !costume"
                aria-label="Custom Pokémon GO search keyword"
              />
              <button className="button button--secondary" type="submit">
                <Icon name="plus" /> Add
              </button>
            </form>
            {customTerms.length > 0 && (
              <div className="custom-term-list">
                {customTerms.map((term) => (
                  <button
                    type="button"
                    key={term}
                    onClick={() =>
                      setCustomTerms((current) => current.filter((item) => item !== term))
                    }
                  >
                    <code>{term}</code>
                    <Icon name="close" />
                  </button>
                ))}
              </div>
            )}
          </fieldset>
        </div>

        <aside className="search-builder__output" aria-live="polite">
          <span className="eyebrow eyebrow--light">Live query</span>
          <h3>Ready for Pokémon GO</h3>
          <code tabIndex={0}>{query || 'Choose a filter to begin'}</code>
          <button
            type="button"
            className="button"
            disabled={!query}
            onClick={() => void copyQuery()}
          >
            <Icon name={copied ? 'check' : 'clipboard'} />{' '}
            {copied ? 'Copied' : 'Copy search string'}
          </button>
          <small>Filters are joined with AND. Commas inside an appraisal group mean OR.</small>
        </aside>
      </div>
    </section>
  );
}
