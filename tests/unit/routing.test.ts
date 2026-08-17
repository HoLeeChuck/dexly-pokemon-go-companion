import { describe, expect, it } from 'vitest';
import { routeFromLocation, urlForRoute } from '../../src/app/routing';

describe('application routing', () => {
  it('keeps the unlisted owner path and public hash routes compatible', () => {
    expect(routeFromLocation({ pathname: '/cody', hash: '' })).toBe('owner');
    expect(routeFromLocation({ pathname: '/', hash: '#/dex' })).toBe('dex');
    expect(routeFromLocation({ pathname: '/', hash: '#/search' })).toBe('search');
    expect(routeFromLocation({ pathname: '/', hash: '#/unknown' })).toBe('home');
    expect(urlForRoute('owner')).toBe('/cody');
    expect(urlForRoute('profile')).toBe('/#/profile');
  });
});
