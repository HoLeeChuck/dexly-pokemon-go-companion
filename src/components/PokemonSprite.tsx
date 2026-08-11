import { useState } from 'react';
import type { CatalogItem } from '../../shared/types';

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

  if (!source || failedSource === source) {
    return (
      <div
        className={`sprite-fallback ${className}`}
        role="img"
        aria-label={`${item.name} sprite unavailable`}
      >
        <span>?</span>
      </div>
    );
  }

  return (
    <img
      className={className}
      src={source}
      alt={`${shiny ? 'Shiny ' : ''}${item.name}`}
      loading="lazy"
      decoding="async"
      onError={() => setFailedSource(source)}
    />
  );
}
