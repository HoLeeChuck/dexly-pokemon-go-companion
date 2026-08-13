import { describe, expect, it } from 'vitest';
import { buildPokemonGoSearch, SEARCH_RESOURCE_UPDATED_AT } from '../../shared/searchBuilder';

describe('visual search builder', () => {
  it('always begins generated searches with the untraded guard', () => {
    const result = buildPokemonGoSearch(
      [
        { id: '1', termId: 'category', value: 'shiny', excluded: false },
        { id: '2', termId: 'age', value: '0-7', excluded: false },
      ],
      'and',
    );
    expect(result.query).toBe('!traded&shiny&age0-7');
    expect(result.valid).toBe(true);
    expect(SEARCH_RESOURCE_UPDATED_AT).toBe('2026-08-13');
  });

  it('repeats the untraded guard for every OR branch', () => {
    const result = buildPokemonGoSearch(
      [
        { id: '1', termId: 'size', value: 'xxl', excluded: false },
        { id: '2', termId: 'size', value: 'xxs', excluded: false },
      ],
      'or',
    );
    expect(result.query).toBe('!traded&xxl,!traded&xxs');
  });

  it('validates ranges and renders exclusions', () => {
    const invalid = buildPokemonGoSearch(
      [{ id: '1', termId: 'species', value: 'one-fifty-one', excluded: false }],
      'and',
    );
    expect(invalid.valid).toBe(false);
    expect(invalid.warnings[0]).toContain('number or range');

    const valid = buildPokemonGoSearch(
      [{ id: '1', termId: 'tag', value: 'transfer', excluded: true }],
      'and',
    );
    expect(valid.query).toBe('!traded&!#transfer');
  });
});
