import { describe, expect, it } from 'vitest';
import { routeFromLocation, urlForRoute } from '../../src/app/routing';

describe('application routing', () => {
  it('keeps the unlisted owner path and public hash routes compatible', () => {
    expect(routeFromLocation({ pathname: '/cody', hash: '' })).toBe('owner');
    expect(routeFromLocation({ pathname: '/', hash: '#/dex' })).toBe('dex');
    expect(routeFromLocation({ pathname: '/', hash: '#/progress' })).toBe('progress');
    expect(routeFromLocation({ pathname: '/', hash: '#/settings' })).toBe('settings');
    expect(routeFromLocation({ pathname: '/', hash: '#/search' })).toBe('progress');
    expect(routeFromLocation({ pathname: '/', hash: '#/profile' })).toBe('settings');
    expect(routeFromLocation({ pathname: '/', hash: '#/unknown' })).toBe('home');
    expect(urlForRoute('owner')).toBe('/cody');
    expect(urlForRoute('settings')).toBe('/#/settings');
  });
});
