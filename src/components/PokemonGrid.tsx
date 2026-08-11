import { useEffect, useMemo, useRef, useState } from 'react';
import { deriveCollectionState } from '../../shared/domain';
import type { CatalogItem, CategoryId, CollectionState } from '../../shared/types';
import { Icon } from './Icon';
import { PokemonSprite } from './PokemonSprite';

const BATCH_SIZE = 48;

function stateLabel(state: CollectionState): string {
  switch (state) {
    case 'collected':
      return 'Collected';
    case 'missing':
      return 'Missing';
    case 'unreleased':
      return 'Unreleased';
    case 'ineligible':
      return 'Not eligible';
    case 'unknown':
      return 'Needs review';
  }
}

export function PokemonGrid({
  items,
  categoryId,
  quickCheck,
  collectedKeys,
  wantedFormIds,
  pendingKeys,
  onOpen,
  onToggle,
}: {
  items: readonly CatalogItem[];
  categoryId: CategoryId;
  quickCheck: boolean;
  collectedKeys: ReadonlySet<string>;
  wantedFormIds: ReadonlySet<string>;
  pendingKeys: ReadonlySet<string>;
  onOpen: (item: CatalogItem) => void;
  onToggle: (item: CatalogItem, collected: boolean) => void;
}) {
  const [renderWindow, setRenderWindow] = useState({ signature: '', count: BATCH_SIZE });
  const sentinelRef = useRef<HTMLDivElement>(null);
  const signature = useMemo(() => items.map((item) => item.id).join('|'), [items]);

  const visibleCount = renderWindow.signature === signature ? renderWindow.count : BATCH_SIZE;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || visibleCount >= items.length) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setRenderWindow((current) => ({
            signature,
            count: Math.min(
              items.length,
              (current.signature === signature ? current.count : BATCH_SIZE) + BATCH_SIZE,
            ),
          }));
        }
      },
      { rootMargin: '500px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [items.length, signature, visibleCount]);

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-state__orb">
          <Icon name="search" />
        </span>
        <h3>No Pokémon found</h3>
        <p>Try another name, generation, type, or collection state.</p>
      </div>
    );
  }

  return (
    <>
      <div className="pokemon-grid" data-testid="pokemon-grid">
        {items.slice(0, visibleCount).map((item) => {
          const key = `${item.id}:${categoryId}`;
          const collected = collectedKeys.has(key);
          const rule = item.rules[categoryId] ?? 'unknown';
          const state = deriveCollectionState(rule, collected);
          const canToggle = rule === 'released';
          const pending = pendingKeys.has(key);
          const shiny = categoryId === 'shiny';

          return (
            <button
              type="button"
              key={item.id}
              className={`pokemon-card pokemon-card--${state}${quickCheck ? ' pokemon-card--quick' : ''}`}
              data-state={state}
              data-testid={`pokemon-card-${item.dexNumber}`}
              aria-pressed={quickCheck && canToggle ? collected : undefined}
              aria-label={
                quickCheck && canToggle
                  ? `${collected ? 'Mark' : 'Mark'} ${item.name} as ${collected ? 'missing' : 'collected'} in ${categoryId}`
                  : `Open ${item.name} details. ${stateLabel(state)} in ${categoryId}.`
              }
              disabled={quickCheck && !canToggle}
              onClick={() => {
                if (quickCheck && canToggle) onToggle(item, !collected);
                else onOpen(item);
              }}
            >
              <span className="pokemon-card__number">
                #{String(item.dexNumber).padStart(4, '0')}
              </span>
              <span className="pokemon-card__art" aria-hidden="true">
                <span className="pokemon-card__halo" />
                <PokemonSprite item={item} shiny={shiny} className="pokemon-card__sprite" />
              </span>
              <span className="pokemon-card__name">{item.name}</span>
              <span className={`state-pill state-pill--${state}`}>
                {state === 'collected' && <Icon name="check" />}
                {state === 'unreleased' && <Icon name="lock" />}
                {stateLabel(state)}
              </span>
              {wantedFormIds.has(item.id) && (
                <span className="pokemon-card__wanted" title="On your wanted list">
                  <Icon name="heart" />
                </span>
              )}
              {pending && <span className="pokemon-card__saving" aria-label="Saving" />}
              {quickCheck && canToggle && (
                <span className="pokemon-card__quick-mark" aria-hidden="true">
                  <Icon name={collected ? 'minus' : 'plus'} />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div ref={sentinelRef} className="grid-sentinel" aria-hidden="true" />
    </>
  );
}
