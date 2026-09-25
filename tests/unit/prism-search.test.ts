import { describe, it, expect } from 'vitest';
import { missingSearch } from '../../design/prism/search';
const universe = [4, 5, 6].map((n) => ({
  id: `p${n}`,
  n,
  isDefault: true,
  rules: { xxl: 'released', shadow: n === 4 ? 'ineligible' : 'released' },
}));
const families = { '4': [4], '5': [4, 5], '6': [4, 5, 6] };
describe('missing evolution searches', () => {
  it('includes owned Charmander when its XXL evolutions are missing', () => {
    expect(
      missingSearch({
        items: universe,
        universe,
        owned: new Set(['p4:xxl']),
        category: 'xxl',
        evolution: true,
        families,
      }),
    ).toBe('4,5&xxl&evolve');
  });
  it('keeps neutral mode free from trade or tag guards', () => {
    expect(
      missingSearch({
        items: universe,
        universe,
        owned: new Set(['p4:xxl']),
        category: 'xxl',
        families,
      }),
    ).toBe('5,6&xxl');
  });
  it('returns no query for a completed collection, even with guards', () => {
    expect(
      missingSearch({
        items: universe,
        universe,
        owned: new Set(['p4:xxl', 'p5:xxl', 'p6:xxl']),
        category: 'xxl',
        mode: 'personal',
        families,
      }),
    ).toBe('');
  });
  it('excludes ineligible ancestor candidates', () => {
    expect(
      missingSearch({
        items: [universe[2]!],
        universe,
        owned: new Set(),
        category: 'shadow',
        evolution: true,
        families,
      }),
    ).toBe('5&shadow&evolve');
  });
});
