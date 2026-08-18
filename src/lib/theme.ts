export const ACCENT_THEMES = ['green', 'blue', 'purple', 'red', 'orange', 'pink'] as const;

export type AccentTheme = (typeof ACCENT_THEMES)[number];
