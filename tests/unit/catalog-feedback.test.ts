import { expect, test } from 'vitest';
import { catalogFreshness } from '../../app/catalog-feedback.js';

test('freshness uses the newer review date, including an empty or older ledger', () => {
  const now = new Date('2026-10-01T12:00:00Z');
  expect(catalogFreshness('2026-08-24', '2026-09-29', now)).toEqual({
    date: '2026-09-29',
    stale: false,
  });
  expect(catalogFreshness('2026-09-29', '2026-08-24', now).date).toBe('2026-09-29');
  expect(catalogFreshness('2026-08-24', null, now)).toEqual({
    date: '2026-08-24',
    stale: true,
  });
});

test('the warning begins after 21 calendar days, independent of time zone and time of day', () => {
  const check = (now: string) => catalogFreshness('2026-09-10', null, new Date(now)).stale;
  expect(check('2026-10-01T23:59:59.999Z')).toBe(false);
  expect(check('2026-10-02T00:00:00Z')).toBe(true);
  expect(check('2026-10-01T19:00:00-05:00')).toBe(true);
  expect(check('2026-09-09T12:00:00Z')).toBe(false);
});
