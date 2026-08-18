import { useEffect, useMemo, useRef } from 'react';
import { deriveCollectionState } from '../../shared/domain';
import type { CatalogItem, Category, CategoryId, CollectionEntry } from '../../shared/types';
import { catalogDisplayName } from '../lib/catalogDisplay';
import { collectorFormsForSpecies } from '../catalog/collectorForms';
import { Icon } from './Icon';
import { PokemonSprite } from './PokemonSprite';
import './detail.css';

interface SwipeOrigin {
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
}

const SWIPE_DISTANCE_PX = 52;
const SWIPE_AXIS_RATIO = 1.25;

function typeHook(type: string | undefined): string | undefined {
  if (!type) return undefined;
  return (
    type
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || undefined
  );
}

function categoryKey(formId: string, categoryId: CategoryId): string {
  return `${formId}:${categoryId}`;
}

export function DetailSheet({
  item,
  categories,
  collectionEntries,
  pendingKeys,
  catalog,
  onClose,
  onNavigate,
  onCollectionChange,
}: {
  item: CatalogItem;
  categories: readonly Category[];
  collectionEntries: readonly CollectionEntry[];
  pendingKeys: ReadonlySet<string>;
  catalog?: readonly CatalogItem[];
  onClose: () => void;
  onNavigate?: (item: CatalogItem) => void;
  onCollectionChange: (item: CatalogItem, categoryId: CategoryId, collected: boolean) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const swipeOriginRef = useRef<SwipeOrigin | null>(null);
  const suppressClickUntilRef = useRef(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    document.body.classList.add('scroll-locked');
    return () => {
      document.body.classList.remove('scroll-locked');
      if (dialog.open) dialog.close();
    };
  }, []);

  const collected = useMemo(
    () =>
      new Set(
        collectionEntries
          .filter((entry) => entry.formId === item.id && entry.collected)
          .map((entry) => entry.categoryId),
      ),
    [collectionEntries, item.id],
  );
  const speciesCatalog = useMemo(
    () => catalog?.filter((catalogItem) => catalogItem.isDefault) ?? [],
    [catalog],
  );
  const speciesIndex = speciesCatalog.findIndex(
    (catalogItem) => catalogItem.speciesId === item.speciesId,
  );
  const previousItem = speciesIndex > 0 ? speciesCatalog[speciesIndex - 1] : undefined;
  const nextItem = speciesIndex >= 0 ? speciesCatalog[speciesIndex + 1] : undefined;
  const collectorForms = collectorFormsForSpecies(catalog ?? [], item);
  const releasedCategories = categories.filter(
    (category) => item.rules[category.id] === 'released',
  );
  const isCollectionComplete =
    releasedCategories.length > 0 &&
    releasedCategories.every((category) => collected.has(category.id));
  const primaryType = typeHook(item.types[0]);
  const secondaryType = typeHook(item.types[1]);

  function navigateTo(destination: CatalogItem | undefined) {
    if (destination && onNavigate) {
      onNavigate(destination);
    }
  }

  function startSwipe(event: React.TouchEvent<HTMLElement>) {
    const touch = event.touches[0];
    suppressClickUntilRef.current = 0;
    swipeOriginRef.current =
      event.touches.length === 1 && touch
        ? {
            startX: touch.clientX,
            startY: touch.clientY,
            lastX: touch.clientX,
            lastY: touch.clientY,
          }
        : null;
  }

  function trackSwipe(event: React.TouchEvent<HTMLElement>) {
    const origin = swipeOriginRef.current;
    const touch = event.touches[0];
    if (!origin || !touch || event.touches.length !== 1) return;
    origin.lastX = touch.clientX;
    origin.lastY = touch.clientY;
    const horizontalDistance = Math.abs(origin.lastX - origin.startX);
    const verticalDistance = Math.abs(origin.lastY - origin.startY);
    if (horizontalDistance > 12 && horizontalDistance > verticalDistance) event.preventDefault();
  }

  function finishSwipe(event: React.TouchEvent<HTMLElement>) {
    const origin = swipeOriginRef.current;
    const touch = event.changedTouches[0];
    swipeOriginRef.current = null;
    if (!origin) return;
    const deltaX = (touch?.clientX ?? origin.lastX) - origin.startX;
    const deltaY = (touch?.clientY ?? origin.lastY) - origin.startY;
    const isHorizontalSwipe =
      Math.abs(deltaX) >= SWIPE_DISTANCE_PX &&
      Math.abs(deltaX) > Math.abs(deltaY) * SWIPE_AXIS_RATIO;
    if (!isHorizontalSwipe) return;
    suppressClickUntilRef.current = Date.now() + 450;
    navigateTo(deltaX < 0 ? nextItem : previousItem);
  }

  return (
    <dialog
      ref={dialogRef}
      className="detail-dialog"
      aria-labelledby="detail-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <section
        className={`detail-sheet${isCollectionComplete ? ' detail-sheet--complete is-collection-complete' : ''}`}
        data-form-id={item.id}
        data-dex-number={item.dexNumber}
        data-collection-complete={isCollectionComplete ? 'true' : 'false'}
        data-primary-type={primaryType}
        data-secondary-type={secondaryType}
        onTouchStart={startSwipe}
        onTouchMove={trackSwipe}
        onTouchEnd={finishSwipe}
        onTouchCancel={() => {
          swipeOriginRef.current = null;
        }}
        onClickCapture={(event) => {
          if (Date.now() <= suppressClickUntilRef.current) {
            event.preventDefault();
            event.stopPropagation();
            suppressClickUntilRef.current = 0;
          }
        }}
      >
        {speciesIndex >= 0 && onNavigate && (
          <>
            <button
              type="button"
              className="icon-button detail-nav detail-nav--previous"
              disabled={!previousItem}
              onClick={() => navigateTo(previousItem)}
              aria-label={
                previousItem
                  ? `Previous Pokémon: ${catalogDisplayName(previousItem)}`
                  : 'No previous Pokémon'
              }
              title={previousItem ? `Previous: ${catalogDisplayName(previousItem)}` : undefined}
            >
              <Icon name="arrow-left" />
            </button>
            <button
              type="button"
              className="icon-button detail-nav detail-nav--next"
              disabled={!nextItem}
              onClick={() => navigateTo(nextItem)}
              aria-label={
                nextItem ? `Next Pokémon: ${catalogDisplayName(nextItem)}` : 'No next Pokémon'
              }
              title={nextItem ? `Next: ${catalogDisplayName(nextItem)}` : undefined}
            >
              <Icon name="chevron-right" />
            </button>
          </>
        )}
        <div className="detail-sheet__handle" aria-hidden="true" />
        <header
          className={`detail-hero${primaryType ? ` detail-hero--${primaryType}` : ''}${secondaryType ? ` detail-hero--${primaryType}-${secondaryType}` : ''}`}
          data-primary-type={primaryType}
          data-secondary-type={secondaryType}
        >
          <button
            type="button"
            className="icon-button detail-hero__close"
            onClick={onClose}
            aria-label="Close details"
          >
            <Icon name="close" />
          </button>
          <div className="detail-hero__art">
            <span className="detail-hero__rings" />
            <PokemonSprite item={item} className="detail-hero__sprite" />
          </div>
          <div className="detail-hero__copy">
            <span className="eyebrow">
              #{String(item.dexNumber).padStart(4, '0')} · {item.region}
            </span>
            <h2 id="detail-title">{catalogDisplayName(item)}</h2>
            <div className="type-row">
              {item.types.map((type) => (
                <span key={type} className={`type-chip type-chip--${typeHook(type) ?? 'unknown'}`}>
                  {type}
                </span>
              ))}
            </div>
          </div>
        </header>

        <div className="detail-section-tabs" role="tablist" aria-label="Pokémon detail sections">
          <button type="button" role="tab" aria-selected="true">
            Collection
          </button>
          <button type="button" role="tab" aria-selected="false" disabled>
            Costumes <span>Coming soon</span>
          </button>
        </div>

        <div className="detail-sheet__body">
          {
            <>
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Your history</span>
                  <h3>Collection</h3>
                </div>
                <span>{collected.size} marked</span>
              </div>
              <div className="category-tile-grid">
                {categories.map((category) => {
                  const rule = item.rules[category.id] ?? 'unknown';
                  const isCollected = collected.has(category.id);
                  const state = deriveCollectionState(rule, isCollected);
                  const pending = pendingKeys.has(categoryKey(item.id, category.id));
                  return (
                    <button
                      type="button"
                      key={category.id}
                      className={`category-tile category-tile--collection category-tile--${state}`}
                      aria-pressed={rule === 'released' ? isCollected : undefined}
                      disabled={rule !== 'released' || pending}
                      onClick={() => onCollectionChange(item, category.id, !isCollected)}
                    >
                      <span className="category-tile__status" aria-hidden="true">
                        <Icon
                          name={rule === 'released' ? (isCollected ? 'check' : 'plus') : 'lock'}
                        />
                      </span>
                      <span className="category-tile__copy">
                        <strong>{category.label}</strong>
                        <small>
                          {pending
                            ? 'Saving…'
                            : state === 'collected'
                              ? 'Collected'
                              : state === 'missing'
                                ? 'Not yet'
                                : state === 'unknown'
                                  ? 'Not cataloged'
                                  : state}
                        </small>
                      </span>
                    </button>
                  );
                })}
              </div>
              {collectorForms.length > 0 && (
                <section className="compact-form-sections" aria-labelledby="alternate-forms-title">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">Collector forms</span>
                      <h3 id="alternate-forms-title">Alternate forms & transformations</h3>
                    </div>
                    <span>{collectorForms.length} forms</span>
                  </div>
                  <p className="section-intro">
                    Track Regular and Shiny versions without leaving this Collection view.
                  </p>
                  <div className="compact-form-list">
                    {collectorForms.map((form) => (
                      <article
                        key={form.id}
                        className="compact-form-row"
                        data-variant-kind={form.variantKind}
                      >
                        <PokemonSprite item={form} />
                        <div>
                          <strong>{form.formName ?? form.name}</strong>
                          <small>
                            {form.variantKind === 'gigantamax'
                              ? 'Gigantamax'
                              : form.variantKind === 'mega' || form.variantKind === 'primal'
                                ? 'Mega / Primal'
                                : 'Alternate form'}
                          </small>
                        </div>
                        {(['normal', 'shiny'] as const).map((categoryId) => {
                          const rule = form.rules[categoryId] ?? 'unknown';
                          const isCollected = collectionEntries.some(
                            (entry) =>
                              entry.formId === form.id &&
                              entry.categoryId === categoryId &&
                              entry.collected,
                          );
                          const pending = pendingKeys.has(categoryKey(form.id, categoryId));
                          return (
                            <button
                              type="button"
                              key={categoryId}
                              className={isCollected ? 'is-collected' : ''}
                              aria-pressed={rule === 'released' ? isCollected : undefined}
                              disabled={rule !== 'released' || pending}
                              onClick={() => onCollectionChange(form, categoryId, !isCollected)}
                            >
                              <Icon
                                name={
                                  rule === 'released' ? (isCollected ? 'check' : 'plus') : 'lock'
                                }
                              />
                              <span>{categoryId === 'normal' ? 'Regular' : 'Shiny'}</span>
                            </button>
                          );
                        })}
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </>
          }
        </div>
      </section>
    </dialog>
  );
}
