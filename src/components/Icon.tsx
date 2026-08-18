import type { ReactNode, SVGProps } from 'react';

export type IconName =
  | 'arrow-left'
  | 'check'
  | 'chart'
  | 'chevron-right'
  | 'clipboard'
  | 'close'
  | 'database'
  | 'download'
  | 'filter'
  | 'flask'
  | 'grid'
  | 'heart'
  | 'home'
  | 'lock'
  | 'menu'
  | 'minus'
  | 'plus'
  | 'refresh'
  | 'search'
  | 'shield'
  | 'settings'
  | 'sparkles'
  | 'moon'
  | 'sun'
  | 'swap'
  | 'undo'
  | 'upload'
  | 'user'
  | 'wifi-off';

const paths: Record<IconName, ReactNode> = {
  'arrow-left': <path d="m15 18-6-6 6-6" />,
  check: <path d="m5 12 4 4L19 6" />,
  chart: <path d="M4 20V10m6 10V4m6 16v-7m4 7H2" />,
  'chevron-right': <path d="m9 18 6-6-6-6" />,
  clipboard: (
    <>
      <rect width="14" height="16" x="5" y="4" rx="2" />
      <path d="M9 4.5V3h6v1.5M9 9h6M9 13h6" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  database: (
    <>
      <ellipse cx="12" cy="5" rx="7" ry="3" />
      <path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
    </>
  ),
  download: <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14" />,
  filter: <path d="M4 5h16M7 12h10M10 19h4" />,
  flask: <path d="M9 3h6m-5 0v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3M8 14h8" />,
  grid: (
    <>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </>
  ),
  heart: (
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
  ),
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10M9 20v-6h6v6" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  moon: <path d="M20.5 14.5A8 8 0 0 1 9.5 3.5 8.5 8.5 0 1 0 20.5 14.5Z" />,
  minus: <path d="M5 12h14" />,
  plus: <path d="M12 5v14M5 12h14" />,
  refresh: <path d="M20 7v5h-5M4 17v-5h5m9.5-4A8 8 0 0 0 6 5l-2 2m2 10a8 8 0 0 0 12.5 0L20 15" />,
  search: <path d="m21 21-4.3-4.3M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Zm-3-10 2 2 4-5" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
  sparkles: (
    <path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3ZM5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Zm14-1 .8 2.2L22 16l-2.2.8L19 19l-.8-2.2L16 16l2.2-.8L19 13Z" />
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" />
    </>
  ),
  swap: <path d="m7 7-4 4 4 4M3 11h13M17 17l4-4-4-4M21 13H8" />,
  undo: <path d="m9 7-5 5 5 5M4 12h9a6 6 0 0 1 6 6" />,
  upload: <path d="M12 16V4m0 0L8 8m4-4 4 4M5 20h14" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  'wifi-off': (
    <path d="m3 3 18 18M8.5 8.5A10.8 10.8 0 0 0 5 11m5 3a3.5 3.5 0 0 1 4.8.1M19 11a11.8 11.8 0 0 0-5.3-2.7M2 8a16 16 0 0 1 5.2-3M12 19h.01" />
  ),
};

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
