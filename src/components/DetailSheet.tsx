import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { deriveCollectionState } from '../../shared/domain';
import type {
  CatalogItem,
  Category,
  CategoryId,
  CollectionEntry,
  TradeSpecimen,
  WantedEntry,
} from '../../shared/types';
import { Icon } from './Icon';
import { PokemonSprite } from './PokemonSprite';

type DetailTab = 'collection' | 'wanted' | 'trade';

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
  onClose,
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
  onClose: () => void;
  onCollectionChange: (item: CatalogItem, categoryId: CategoryId, collected: boolean) => void;
  onWantedChange: (item: CatalogItem, categoryId: CategoryId, wanted: boolean) => void;
  onAddTrade: (input: {
    formId: string;
    traits: CategoryId[];
    quantity: number;
    notes: string;
  }) => Promise<void>;
  onDeleteTrade: (tradeId: string) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<DetailTab>('collection');
  const [traits, setTraits] = useState<CategoryId[]>([]);
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
          .map((entry) => entry.categoryId as CategoryId),
      ),
    [wantedEntries, item.id],
  );
  const itemTrades = tradeSpecimens.filter((trade) => trade.formId === item.id);

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
      <section className="detail-sheet">
        <div className="detail-sheet__handle" aria-hidden="true" />
        <header className="detail-hero">
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
                <span key={type} className={`type-chip type-chip--${type}`}>
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
                Wanted is separate from collection history. Choose the traits you would accept in a
                trade.
              </p>
              <div className="category-tile-grid category-tile-grid--wanted">
                {categories.map((category) => {
                  const rule = item.rules[category.id] ?? 'unknown';
                  const isWanted = wanted.has(category.id);
                  const misleading = ['hundo', 'lucky', 'shadow'].includes(category.id);
                  return (
                    <button
                      type="button"
                      key={category.id}
                      className={`category-tile category-tile--wanted${isWanted ? ' is-active' : ''}`}
                      aria-pressed={isWanted}
                      disabled={rule === 'ineligible' || category.id === 'shadow'}
                      onClick={() => onWantedChange(item, category.id, !isWanted)}
                    >
                      <span className="category-tile__mark">
                        <Icon name={isWanted ? 'heart' : 'plus'} />
                      </span>
                      <strong>{category.label}</strong>
                      <small>
                        {misleading
                          ? category.id === 'shadow'
                            ? 'Cannot trade'
                            : 'Not transferable'
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
                Record combined traits on one actual Pokémon. IVs reroll, Lucky status does not
                transfer, and Shadow Pokémon cannot be traded.
              </p>
              <form className="trade-form" onSubmit={submitTrade}>
                <fieldset>
                  <legend>Traits on this specimen</legend>
                  <div className="trait-picker">
                    {categories
                      .filter((category) => category.id !== 'normal' && category.id !== 'shadow')
                      .map((category) => (
                        <button
                          type="button"
                          key={category.id}
                          aria-pressed={traits.includes(category.id)}
                          onClick={() =>
                            setTraits((current) =>
                              current.includes(category.id)
                                ? current.filter((value) => value !== category.id)
                                : [...current, category.id],
                            )
                          }
                        >
                          {category.label}
                        </button>
                      ))}
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
