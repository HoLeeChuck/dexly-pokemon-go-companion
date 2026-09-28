import { describe, expect, it, vi } from 'vitest';
import {
  BACKUP_KEY,
  PERSIST_KEY,
  createDataSafety,
  isIosSafari,
  isStandalone,
  readBackupState,
} from '../../app/data-safety.js';

const START = Date.parse('2026-09-28T12:00:00Z');
const WEEK = 7 * 86400000;
const owned = (count: number, prefix = 'normal') =>
  new Set(Array.from({ length: count }, (_, i) => `${prefix}:${i}`));
function setup(storageManager?: Parameters<typeof createDataSafety>[0]['storageManager']) {
  let now = START;
  const prefs = new Map<string, string>();
  const options = {
    read: (key: string) => prefs.get(key) ?? null,
    write: (key: string, value: string) => {
      prefs.set(key, value);
    },
    storageManager,
    onChange: vi.fn(),
    now: () => now,
  };
  const safety = createDataSafety(options);
  return {
    safety,
    prefs,
    options,
    at: (value: number) => {
      now = value;
    },
  };
}

describe('backup reminders without collection writes', () => {
  it('waits for the 25th unexported entry, including forms and categories', () => {
    const { safety } = setup();
    expect(safety.observe(owned(0))).toBe(false);
    expect(safety.observe(owned(24))).toBe(false);
    const mixed = owned(24);
    mixed.add('form-0006-mega-x:shiny');
    expect(safety.observe(mixed)).toBe(true);
  });
  it('counts new keys after export rather than net collection growth', () => {
    const { safety } = setup();
    safety.exported(owned(25));
    expect(safety.observe(owned(25))).toBe(false);
    expect(safety.observe(owned(24, 'shiny'))).toBe(false);
    expect(safety.observe(owned(25, 'shiny'))).toBe(true);
  });
  it('waits seven days with changes; old exports without changes never nag', () => {
    const { safety, at } = setup();
    safety.exported(owned(3));
    at(START + WEEK * 4);
    expect(safety.observe(owned(3))).toBe(false);
    expect(safety.observe(owned(4))).toBe(false);
    at(START + WEEK * 5 - 1);
    expect(safety.observe(owned(4))).toBe(false);
    at(START + WEEK * 5);
    expect(safety.observe(owned(4))).toBe(true);
  });
  it('remembers removals for the time threshold and cancels reverted changes', () => {
    const { safety, at } = setup();
    safety.exported(owned(3));
    safety.observe(owned(2));
    at(START + WEEK);
    expect(safety.observe(owned(2))).toBe(true);
    expect(safety.observe(owned(3))).toBe(false);
  });
  it('snoozes across reloads until 25 more additions or seven more days', () => {
    const { safety, options, at } = setup();
    safety.observe(owned(25));
    safety.dismissBackup(owned(25));
    const reloaded = createDataSafety(options);
    expect(reloaded.observe(owned(25))).toBe(false);
    expect(reloaded.observe(owned(49))).toBe(false);
    expect(reloaded.observe(owned(50))).toBe(true);
    at(START + WEEK - 1);
    expect(reloaded.observe(owned(25))).toBe(false);
    at(START + WEEK);
    expect(reloaded.observe(owned(25))).toBe(true);
  });
  it('export clears due and dismissed state and records its date', () => {
    const { safety, prefs, at } = setup();
    safety.observe(owned(25));
    safety.dismissBackup(owned(25));
    at(START + WEEK);
    safety.exported(owned(26));
    expect(safety.lastExportAt()).toBe(START + WEEK);
    expect(safety.observe(owned(26))).toBe(false);
    expect(readBackupState(prefs.get(BACKUP_KEY)!)).toMatchObject({
      changedAt: null,
      dismissedAt: null,
    });
  });
  it('handles malformed optional preferences without changing ownership', () => {
    const { safety, prefs } = setup();
    const collection = owned(30);
    const before = [...collection];
    prefs.set(BACKUP_KEY, '{broken');
    expect(safety.observe(collection)).toBe(true);
    safety.dismissBackup(collection);
    safety.exported(collection);
    safety.dismissInstall();
    expect([...collection]).toEqual(before);
    expect(
      [...prefs.keys()].every((key) =>
        [BACKUP_KEY, PERSIST_KEY, 'ios-install-dismissed'].includes(key),
      ),
    ).toBe(true);
    expect(readBackupState('{"exportedKeys":4,"changedAt":"bad"}').changedAt).toBeNull();
  });
});

describe('persistent storage and iPhone installation', () => {
  it.each([true, false])(
    'requests persistence only once at 10 entries and reports %s',
    async (granted) => {
      const persist = vi.fn(async () => granted);
      const { safety, options } = setup({ persisted: async () => false, persist });
      safety.observe(owned(9));
      expect(persist).not.toHaveBeenCalled();
      safety.observe(owned(10));
      safety.observe(owned(20));
      await vi.waitFor(() => expect(safety.protection()).toBe(granted ? 'yes' : 'no'));
      expect(persist).toHaveBeenCalledTimes(1);
      createDataSafety(options).observe(owned(40));
      await Promise.resolve();
      expect(persist).toHaveBeenCalledTimes(1);
    },
  );
  it('denial or a rejected API never prevents collection work or repeatedly requests', async () => {
    const persist = vi.fn(async () => {
      throw new Error('denied');
    });
    const { safety } = setup({
      persisted: async () => {
        throw new Error('unavailable');
      },
      persist,
    });
    expect(safety.observe(owned(30))).toBe(true);
    await vi.waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
    expect(safety.protection()).toBe('no');
    safety.observe(owned(31));
    expect(persist).toHaveBeenCalledTimes(1);
  });
  it('reports an unsupported API as no, and queries an existing grant on load', async () => {
    const unsupported = setup().safety;
    const granted = setup({ persisted: async () => true }).safety;
    await vi.waitFor(() => expect(unsupported.protection()).toBe('no'));
    expect(granted.protection()).toBe('yes');
  });
  it('recognizes iPhone/iPad Safari, excludes other browsers, and checks both standalone signals', () => {
    expect(isIosSafari({ userAgent: 'iPhone Safari/604.1' })).toBe(true);
    expect(
      isIosSafari({ userAgent: 'Macintosh Safari/604.1', platform: 'MacIntel', maxTouchPoints: 5 }),
    ).toBe(true);
    expect(isIosSafari({ userAgent: 'iPhone CriOS/100 Safari/604.1' })).toBe(false);
    expect(isIosSafari({ userAgent: 'Android Chrome/100 Safari/537.36' })).toBe(false);
    expect(isStandalone({ standalone: true }, false)).toBe(true);
    expect(isStandalone({}, true)).toBe(true);
    expect(isStandalone({}, false)).toBe(false);
  });
});
