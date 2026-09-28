export const BACKUP_KEY: string;
export const PERSIST_KEY: string;
export const INSTALL_KEY: string;
interface BackupState {
  exportedKeys: string[];
  lastExportAt: number | null;
  changedAt: number | null;
  dismissedAt: number | null;
  dismissedKeys: string[];
}
export function readBackupState(raw: string | null): BackupState;
export function observeBackup(
  state: BackupState,
  owned: ReadonlySet<string>,
  now: number,
): BackupState;
export function backupDue(state: BackupState, owned: ReadonlySet<string>, now: number): boolean;
type NavigatorLike = {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  standalone?: boolean;
};
export function isStandalone(navigatorLike: NavigatorLike, matchesStandalone: boolean): boolean;
export function isIosSafari(navigatorLike: NavigatorLike): boolean;
export function createDataSafety(options: {
  read: (key: string) => string | null;
  write: (key: string, value: string) => void;
  storageManager?: { persisted?: () => Promise<boolean>; persist?: () => Promise<boolean> };
  onChange: () => void;
  now?: () => number;
}): {
  observe: (owned: ReadonlySet<string>) => boolean;
  exported: (owned: ReadonlySet<string>) => void;
  dismissBackup: (owned: ReadonlySet<string>) => void;
  dismissInstall: () => void;
  installDismissed: () => boolean;
  protection: () => string;
  lastExportAt: () => number | null;
};
