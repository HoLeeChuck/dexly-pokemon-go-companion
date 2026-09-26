import legacyMoves from '../catalog/legacy-moves.v1.json';

export const reviewedAt = legacyMoves.reviewedAt;

export function windowStatus(w, now = new Date()) {
  if (now < new Date(w.start)) return 'Upcoming';
  if (now <= new Date(w.end)) return 'Active';
  return 'Ended';
}

/** Upcoming and active windows first (soonest first), then ended windows (most recent first). */
export function legacyWindows(now = new Date()) {
  const open = legacyMoves.windows.filter((w) => windowStatus(w, now) !== 'Ended');
  const ended = legacyMoves.windows.filter((w) => windowStatus(w, now) === 'Ended');
  open.sort((a, b) => a.start.localeCompare(b.start));
  ended.sort((a, b) => b.start.localeCompare(a.start));
  return [...open, ...ended];
}

const icsDate = (local) => local.replace(/[-:]/g, '').slice(0, 15);
const icsText = (value) =>
  String(value)
    .replace(/[\\,;]/g, (c) => `\\${c}`)
    .replace(/\n/g, '\\n');

/**
 * Calendar file for one window. Times are floating (no zone) because announcements use
 * each player's local time.
 */
export function icsFor(w, stamp = new Date()) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CatchGrid//Legacy move windows//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${w.id}@dex.cjdev.app`,
    `DTSTAMP:${stamp.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART:${icsDate(w.start)}`,
    `DTEND:${icsDate(w.end)}`,
    `SUMMARY:${icsText(`${w.method} for ${w.move}`)}`,
    `DESCRIPTION:${icsText(`${w.name} learns ${w.move} when evolved during this window. Confirm in-game before evolving. ${w.url}`)}`,
    `URL:${w.url}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsText(`${w.method} window starts in one hour`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}
