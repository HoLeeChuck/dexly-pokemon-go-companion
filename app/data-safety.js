// Safety bookkeeping lives only in preferences; never write the collection or its snapshots.
export const BACKUP_KEY = 'backup-reminder:v1';
export const PERSIST_KEY = 'storage-persist-requested';
export const INSTALL_KEY = 'ios-install-dismissed';
const WEEK = 7 * 24 * 60 * 60 * 1000;
const keys = (value) =>
  Array.isArray(value) ? value.filter((key) => typeof key === 'string') : [];
const time = (value) => (Number.isFinite(value) && value > 0 ? value : null);

export function readBackupState(raw) {
  try {
    const value = JSON.parse(raw) ?? {};
    return {
      exportedKeys: keys(value.exportedKeys),
      lastExportAt: time(value.lastExportAt),
      changedAt: time(value.changedAt),
      dismissedAt: time(value.dismissedAt),
      dismissedKeys: keys(value.dismissedKeys),
    };
  } catch {
    return readBackupState(null);
  }
}

const added = (current, previous) => {
  const baseline = new Set(previous);
  return current.filter((key) => !baseline.has(key)).length;
};

export function observeBackup(state, owned, now) {
  const current = [...owned];
  const changes =
    current.length !== state.exportedKeys.length || added(current, state.exportedKeys) > 0;
  const changedAt = changes ? (state.changedAt ?? now) : null;
  return { ...state, changedAt };
}

export function backupDue(state, owned, now) {
  if (!state.changedAt) return false;
  const current = [...owned];
  const due = added(current, state.exportedKeys) >= 25 || now - state.changedAt >= WEEK;
  // Dismissal snoozes this reminder until another 25 additions or another week of changes.
  return (
    due &&
    (!state.dismissedAt ||
      added(current, state.dismissedKeys) >= 25 ||
      now - state.dismissedAt >= WEEK)
  );
}

export function isStandalone(navigatorLike, matchesStandalone) {
  return navigatorLike.standalone === true || matchesStandalone;
}

export function isIosSafari(navigatorLike) {
  const ua = navigatorLike.userAgent ?? '';
  const ios =
    /iP(?:hone|ad|od)/.test(ua) ||
    (navigatorLike.platform === 'MacIntel' && navigatorLike.maxTouchPoints > 1);
  return ios && /Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

export function createDataSafety({ read, write, storageManager, onChange, now = Date.now }) {
  const memory = new Map();
  const get = (key) => read(key) ?? memory.get(key) ?? null;
  const put = (key, value) => {
    memory.set(key, value);
    write(key, value);
  };
  let protection = 'checking';
  let requestPending = false;
  // Read the current browser result on each load, rather than trusting a saved grant.
  const ready = Promise.resolve().then(async () => {
    try {
      protection = (await storageManager?.persisted?.()) ? 'yes' : 'no';
    } catch {
      protection = 'no';
    }
  });
  void ready.then(onChange);

  async function requestProtection() {
    requestPending = true;
    // Mark before awaiting, so repeated renders/navigation cannot prompt again.
    put(PERSIST_KEY, 'yes');
    await ready;
    try {
      if (typeof storageManager?.persist === 'function')
        protection = (await storageManager.persist()) ? 'yes' : 'no';
    } catch {
      protection = 'no';
    }
    requestPending = false;
    onChange();
  }

  return {
    observe(owned) {
      const previous = readBackupState(get(BACKUP_KEY));
      const state = observeBackup(previous, owned, now());
      if (state.changedAt !== previous.changedAt) put(BACKUP_KEY, JSON.stringify(state));
      if (owned.size >= 10 && !requestPending && get(PERSIST_KEY) !== 'yes')
        void requestProtection();
      return backupDue(state, owned, now());
    },
    exported(owned) {
      put(BACKUP_KEY, JSON.stringify({ exportedKeys: [...owned], lastExportAt: now() }));
    },
    dismissBackup(owned) {
      put(
        BACKUP_KEY,
        JSON.stringify({
          ...readBackupState(get(BACKUP_KEY)),
          dismissedAt: now(),
          dismissedKeys: [...owned],
        }),
      );
    },
    dismissInstall() {
      put(INSTALL_KEY, 'yes');
    },
    installDismissed() {
      return get(INSTALL_KEY) === 'yes';
    },
    protection() {
      return protection;
    },
    lastExportAt() {
      return readBackupState(get(BACKUP_KEY)).lastExportAt;
    },
  };
}
