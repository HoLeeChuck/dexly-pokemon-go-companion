import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { deriveCollectionState } from '../../shared/domain';
import type {
  CatalogItem,
  Category,
  CategoryId,
  CollectionEntry,
  TradeOfferTrait,
  TradeRequestTrait,
  TradeSpecimen,
  WantedEntry,
} from '../../shared/types';
import { Icon } from './Icon';
import { PokemonSprite } from './PokemonSprite';
import { typeTheme } from '../lib/typeTheme';

type DetailTab = 'collection' | 'wanted' | 'trade';

interface SwipeOrigin {
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
}

const SWIPE_DISTANCE_PX = 52;
const SWIPE_AXIS_RATIO = 1.25;

const TRADE_REQUEST_OPTIONS: ReadonlyArray<{ id: TradeRequestTrait; label: string }> = [
  { id: 'normal', label: 'Normal' },
  { id: 'shiny', label: 'Shiny' },
  { id: 'xxl', label: 'XXL' },
  { id: 'xxs', label: 'XXS' },
  { id: 'costume', label: 'Costume' },
];

const TRADE_OFFER_OPTIONS: ReadonlyArray<{ id: TradeOfferTrait; label: string }> = [
  { id: 'shiny', label: 'Shiny' },
  { id: 'xxl', label: 'XXL' },
  { id: 'xxs', label: 'XXS' },
  { id: 'costume', label: 'Costume' },
];

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
  wantedEntries,
  tradeSpecimens,
  pendingKeys,
  catalog,
  onClose,
  onNavigate,
  onCollectionChange,
  onWantedChange,
  onAddTrade,
  onDeleteTrade,
}: {
  item: CatalogItem;
  categories: readonly Category[];
  collectionEntries: readonly CollectionEntry[];
  wantedEntries: readonly WantedEntry[];
  tradeSpecimens: readonly TradeSpecimen[];
  pendingKeys: ReadonlySet<string>;
  /** Full catalog order used by previous/next navigation. */
  catalog?: readonly CatalogItem[];
  onClose: () => void;
  onNavigate?: (item: CatalogItem) => void;
  onCollectionChange: (item: CatalogItem, categoryId: CategoryId, collected: boolean) => void;
  onWantedChange: (item: CatalogItem, categoryId: TradeRequestTrait, wanted: boolean) => void;
  onAddTrade: (input: {
    formId: string;
    traits: TradeOfferTrait[];
    quantity: number;
    notes: string;
  }) => Promise<void>;
  onDeleteTrade: (tradeId: string) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const swipeOriginRef = useRef<SwipeOrigin | null>(null);
  const suppressClickUntilRef = useRef(0);
  const [tab, setTab] = useState<DetailTab>('collection');
  const [traits, setTraits] = useState<TradeOfferTrait[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [tradeSaving, setTradeSaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
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
  const wanted = useMemo(
    () =>
      new Set(
        wantedEntries
          .filter((entry) => entry.formId === item.id && entry.wanted && entry.categoryId)
          .map((entry) => entry.categoryId as TradeRequestTrait),
      ),
    [wantedEntries, item.id],
  );
  const itemTrades = tradeSpecimens.filter((trade) => trade.formId === item.id);
  const catalogIndex = useMemo(
    () => catalog?.findIndex((catalogItem) => catalogItem.id === item.id) ?? -1,
    [catalog, item.id],
  );
  const previousItem = catalogIndex > 0 ? catalog?.[catalogIndex - 1] : undefined;
  const nextItem = catalogIndex >= 0 ? catalog?.[catalogIndex + 1] : undefined;
  const releasedCategories = categories.filter(
    (category) => item.rules[category.id] === 'released',
  );
  const isCollectionComplete =
    releasedCategories.length > 0 &&
    releasedCategories.every((category) => collected.has(category.id));
  const primaryType = typeHook(item.types[0]);
  const secondaryType = typeHook(item.types[1]);

  function navigateTo(destination: CatalogItem | undefined) {
    if (!destination || !onNavigate) return;
    setTraits([]);
    setQuantity(1);
    setNotes('');
    onNavigate(destination);
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

    // Once intent is clearly horizontal, keep the browser from turning the gesture into
    // scrolling or a synthetic click on a collection control beneath the user's finger.
    if (horizontalDistance > 12 && horizontalDistance > verticalDistance) {
      event.preventDefault();
    }
  }

  function finishSwipe(event: React.TouchEvent<HTMLElement>) {
    const origin = swipeOriginRef.current;
    const touch = event.changedTouches[0];
    swipeOriginRef.current = null;
    if (!origin) return;

    const endX = touch?.clientX ?? origin.lastX;
    const endY = touch?.clientY ?? origin.lastY;
    const deltaX = endX - origin.startX;
    const deltaY = endY - origin.startY;
    const isHorizontalSwipe =
      Math.abs(deltaX) >= SWIPE_DISTANCE_PX &&
      Math.abs(deltaX) > Math.abs(deltaY) * SWIPE_AXIS_RATIO;

    if (!isHorizontalSwipe) return;

    // Some mobile browsers dispatch a click after touchend. Capture and discard it so a swipe
    // that starts over a category tile cannot accidentally change collection state.
    suppressClickUntilRef.current = Date.now() + 450;
    const destination = deltaX < 0 ? nextItem : previousItem;
    navigateTo(destination);
  }

  async function submitTrade(event: FormEvent) {
    event.preventDefault();
    setTradeSaving(true);
    try {
      await onAddTrade({ formId: item.id, traits, quantity, notes: notes.trim() });
      setTraits([]);
      setQuantity(1);
      setNotes('');
    } catch {
      // The parent keeps the form intact and presents the API error in the global toast.
    } finally {
      setTradeSaving(false);
    }
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
        style={typeTheme(item.types)}
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
        {catalogIndex >= 0 && onNavigate && (
          <>
            <button
              type="button"
              className="icon-button detail-nav detail-nav--previous"
              disabled={!previousItem}
              onClick={() => navigateTo(previousItem)}
              aria-label={
                previousItem ? `Previous Pokémon: ${previousItem.name}` : 'No previous Pokémon'
              }
              title={previousItem ? `Previous: ${previousItem.name}` : undefined}
            >
              <Icon name="arrow-left" />
            </button>
            <button
              type="button"
              className="icon-button detail-nav detail-nav--next"
              disabled={!nextItem}
              onClick={() => navigateTo(nextItem)}
              aria-label={nextItem ? `Next Pokémon: ${nextItem.name}` : 'No next Pokémon'}
              title={nextItem ? `Next: ${nextItem.name}` : undefined}
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
            <h2 id="detail-title">{item.name}</h2>
            <div className="type-row">
              {item.types.map((type) => (
                <span key={type} className={`type-chip type-chip--${typeHook(type) ?? 'unknown'}`}>
                  {type}
                </span>
              ))}
            </div>
          </div>
        </header>

        <nav className="detail-tabs" aria-label="Pokémon details">
          {(
            [
              ['collection', 'Collection'],
              ['wanted', 'Wanted'],
              ['trade', 'For trade'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}>
              {label}
              {id === 'wanted' && wanted.size > 0 && <span>{wanted.size}</span>}
              {id === 'trade' && itemTrades.length > 0 && <span>{itemTrades.length}</span>}
            </button>
          ))}
        </nav>

        <div className="detail-sheet__body">
          {tab === 'collection' && (
            <div>
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
                      className={`category-tile category-tile--${state}`}
                      aria-pressed={rule === 'released' ? isCollected : undefined}
                      disabled={rule !== 'released' || pending}
                      onClick={() => onCollectionChange(item, category.id, !isCollected)}
                    >
                      <span className="category-tile__mark">
                        <Icon
                          name={isCollected ? 'check' : rule === 'released' ? 'plus' : 'lock'}
                        />
                      </span>
                      <strong>{category.label}</strong>
                      <small>
                        {state === 'collected'
                          ? 'Collected'
                          : state === 'missing'
                            ? 'Not yet'
                            : state === 'unknown'
                              ? 'Not cataloged'
                              : state}
                      </small>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'wanted' && (
            <div>
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Trade planning</span>
                  <h3>Wanted list</h3>
                </div>
                <Icon name="heart" />
              </div>
              <p className="section-intro">
                Request only things another trainer can actually provide. Costume means any costume
                for this species until individual costume forms join the catalog.
              </p>
              <div className="category-tile-grid category-tile-grid--wanted">
                {TRADE_REQUEST_OPTIONS.map((option) => {
                  const rule = option.id === 'costume' ? 'released' : item.rules[option.id];
                  const isWanted = wanted.has(option.id);
                  const isOwnedSize =
                    (option.id === 'xxl' || option.id === 'xxs') && collected.has(option.id);
                  return (
                    <button
                      type="button"
                      key={option.id}
                      className={`category-tile category-tile--wanted${isWanted ? ' is-active' : ''}${isOwnedSize ? ' is-owned' : ''}`}
                      aria-pressed={isWanted}
                      disabled={rule !== 'released' || isOwnedSize}
                      onClick={() => onWantedChange(item, option.id, !isWanted)}
                    >
                      <span className="category-tile__mark">
                        <Icon name={isOwnedSize ? 'check' : isWanted ? 'heart' : 'plus'} />
                      </span>
                      <strong>{option.label}</strong>
                      <small>
                        {isOwnedSize
                          ? 'Owned · no trade needed'
                          : option.id === 'costume'
                            ? isWanted
                              ? 'Any costume wanted'
                              : 'Request a costume'
                            : isWanted
                              ? 'Wanted'
                              : 'Add to list'}
                      </small>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'trade' && (
            <div>
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Real specimens</span>
                  <h3>For trade</h3>
                </div>
                <Icon name="swap" />
              </div>
              <p className="section-intro">
                Record combined traits on one actual Pokémon. Normal is implied when no special
                trait is selected.
              </p>
              <form className="trade-form" onSubmit={submitTrade}>
                <fieldset>
                  <legend>Traits on this specimen</legend>
                  <div className="trait-picker">
                    {TRADE_OFFER_OPTIONS.map((option) => {
                      const available =
                        option.id === 'costume' || item.rules[option.id] === 'released';
                      return (
                        <button
                          type="button"
                          key={option.id}
                          aria-pressed={traits.includes(option.id)}
                          disabled={!available}
                          onClick={() =>
                            setTraits((current) =>
                              current.includes(option.id)
                                ? current.filter((value) => value !== option.id)
                                : [...current, option.id],
                            )
                          }
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
                <div className="trade-form__row">
                  <label>
                    Quantity
                    <input
                      type="number"
                      min="1"
                      max="999"
                      value={quantity}
                      onChange={(event) => setQuantity(Number(event.target.value))}
                    />
                  </label>
                  <label className="trade-form__notes">
                    Note
                    <input
                      type="text"
                      maxLength={1000}
                      placeholder="Event, costume, meetup…"
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                    />
                  </label>
                </div>
                <button
                  className="button button--primary button--full"
                  type="submit"
                  disabled={tradeSaving}
                >
                  <Icon name="plus" /> {tradeSaving ? 'Saving…' : 'Add trade specimen'}
                </button>
              </form>

              {itemTrades.length > 0 && (
                <div className="trade-list">
                  <h4>Recorded offers</h4>
                  {itemTrades.map((trade) => (
                    <article key={trade.id}>
                      <div>
                        <strong>
                          {trade.quantity}× {item.name}
                        </strong>
                        <span>
                          {trade.traits.length ? trade.traits.join(' · ') : 'Normal'}
                          {trade.notes ? ` · ${trade.notes}` : ''}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Remove ${item.name} trade specimen`}
                        onClick={() => void onDeleteTrade(trade.id)}
                      >
                        <Icon name="close" />
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </dialog>
  );
}
