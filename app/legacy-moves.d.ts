export interface LegacyWindow {
  id: string;
  name: string;
  move: string;
  method: string;
  start: string;
  end: string;
  url: string;
}
export const reviewedAt: string;
export function windowStatus(w: LegacyWindow, now?: Date): 'Upcoming' | 'Active' | 'Ended';
export function legacyWindows(now?: Date): LegacyWindow[];
export function icsFor(w: LegacyWindow, stamp?: Date): string;
