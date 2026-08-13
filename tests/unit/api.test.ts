import { afterEach, describe, expect, it, vi } from 'vitest';

import { saveAccessToken, storedAccessToken } from '../../src/lib/api';

describe('private access token storage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('treats unavailable session storage as an empty, non-persistent session', () => {
    vi.stubGlobal('sessionStorage', undefined);

    expect(storedAccessToken()).toBe('');
    expect(() => saveAccessToken('owner-token')).not.toThrow();
    expect(() => saveAccessToken('')).not.toThrow();
  });

  it('does not crash when session storage rejects reads, writes, or removals', () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new DOMException('Blocked', 'SecurityError');
      }),
      setItem: vi.fn(() => {
        throw new DOMException('Blocked', 'SecurityError');
      }),
      removeItem: vi.fn(() => {
        throw new DOMException('Blocked', 'SecurityError');
      }),
    };
    vi.stubGlobal('sessionStorage', storage);

    expect(storedAccessToken()).toBe('');
    expect(() => saveAccessToken('owner-token')).not.toThrow();
    expect(() => saveAccessToken('')).not.toThrow();
    expect(storage.getItem).toHaveBeenCalledOnce();
    expect(storage.setItem).toHaveBeenCalledOnce();
    expect(storage.removeItem).toHaveBeenCalledOnce();
  });
});
