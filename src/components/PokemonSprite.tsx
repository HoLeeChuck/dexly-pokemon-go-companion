import { useState } from 'react';
import type { CatalogItem } from '../../shared/types';
import { catalogDisplayName } from '../lib/catalogDisplay';

export function PokemonSprite({
  item,
  shiny = false,
  className = '',
}: {
  item: CatalogItem;
  shiny?: boolean;
  className?: string;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const source = shiny ? item.shinySpriteUrl || item.spriteUrl : item.spriteUrl;
  const displayName = catalogDisplayName(item);

  if (!source || failedSource === source) {
    return (
      <div
        className={`sprite-fallback ${className}`}
        role="img"
        aria-label={`${displayName} sprite unavailable`}
      >
        <span>?</span>
      </div>
    );
  }

  return (
    <img
      className={className}
      src={source}
      alt={`${shiny ? 'Shiny ' : ''}${displayName}`}
      loading="lazy"
      decoding="async"
      onError={() => setFailedSource(source)}
    />
  );
}
