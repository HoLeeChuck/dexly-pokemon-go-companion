import type { CSSProperties } from 'react';

const TYPE_COLORS: Readonly<Record<string, string>> = {
  normal: '#8f9aa6',
  fire: '#ef6a45',
  water: '#438bd4',
  electric: '#e2ae22',
  grass: '#58a957',
  ice: '#52b8c6',
  fighting: '#c95645',
  poison: '#9a62b5',
  ground: '#bd8550',
  flying: '#7599d8',
  psychic: '#dc658c',
  bug: '#8ca63c',
  rock: '#a68c55',
  ghost: '#6c6aa7',
  dragon: '#7165cc',
  dark: '#615f69',
  steel: '#758f9e',
  fairy: '#d97fa7',
};

export type TypeThemeProperties = CSSProperties & {
  '--type-primary': string;
  '--type-secondary': string;
};

export function typeTheme(types: readonly string[]): TypeThemeProperties {
  const primary = TYPE_COLORS[types[0]?.toLowerCase() ?? 'normal'] ?? TYPE_COLORS.normal!;
  const secondary = TYPE_COLORS[types[1]?.toLowerCase() ?? ''] ?? primary;
  return { '--type-primary': primary, '--type-secondary': secondary };
}
