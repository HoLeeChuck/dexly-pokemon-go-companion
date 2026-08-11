import type {
  CatalogItem,
  CollectionEntry,
  TradeRequestTrait,
  TradeSpecimen,
  WantedEntry,
} from '../../shared/types';
import { Icon } from './Icon';
import { PokemonSprite } from './PokemonSprite';

const requestLabels: Readonly<Record<TradeRequestTrait, string>> = {
  normal: 'Normal',
  shiny: 'Shiny',
  xxl: 'XXL',
  xxs: 'XXS',
  costume: 'Costume',
};

export function TradePage({
  catalog,
  collectionEntries,
  wantedEntries,
  tradeSpecimens,
  onOpen,
  onCollectionChange,
  onWantedChange,
}: {
  catalog: readonly CatalogItem[];
  collectionEntries: readonly CollectionEntry[];
  wantedEntries: readonly WantedEntry[];
  tradeSpecimens: readonly TradeSpecimen[];
  onOpen: (item: CatalogItem) => void;
  onCollectionChange: (item: CatalogItem, categoryId: 'xxl' | 'xxs', collected: boolean) => void;
  onWantedChange: (item: CatalogItem, traitId: TradeRequestTrait, wanted: boolean) => Promise<void>;
}) {
  const byId = new Map(catalog.map((item) => [item.id, item]));
  const ownedSizes = new Set(
    collectionEntries
      .filter(
        (entry) => entry.collected && (entry.categoryId === 'xxl' || entry.categoryId === 'xxs'),
      )
      .map((entry) => `${entry.formId}:${entry.categoryId}`),
  );
  const activeWanted = wantedEntries.filter(
    (entry) =>
      entry.wanted &&
      entry.categoryId &&
      !(
        (entry.categoryId === 'xxl' || entry.categoryId === 'xxs') &&
        ownedSizes.has(`${entry.formId}:${entry.categoryId}`)
      ),
  );
  const wantedIds = [...new Set(activeWanted.map((entry) => entry.formId))];
  const offeredIds = [...new Set(tradeSpecimens.map((entry) => entry.formId))];

  return (
    <section className="page page--trade">
      <header className="page-hero trade-hero">
        <div>
          <span className="eyebrow eyebrow--light">
            <Icon name="swap" /> Trade kit
          </span>
          <h1>Ask for what a trade can deliver.</h1>
          <p>Normal, Shiny, XXL, XXS, and costume requests—kept separate from your Dex history.</p>
        </div>
        <div className="trade-hero__cards" aria-hidden="true">
          <span />
          <span />
          <Icon name="swap" />
        </div>
      </header>

      <div className="trade-trait-strip" aria-label="Supported trade requests">
        {Object.values(requestLabels).map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="trade-stats">
        <article>
          <span className="stat-icon stat-icon--heart">
            <Icon name="heart" />
          </span>
          <div>
            <strong>{activeWanted.length}</strong>
            <small>Active requests</small>
          </div>
        </article>
        <article>
          <span className="stat-icon stat-icon--swap">
            <Icon name="swap" />
          </span>
          <div>
            <strong>{tradeSpecimens.reduce((sum, item) => sum + item.quantity, 0)}</strong>
            <small>Specimens offered</small>
          </div>
        </article>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Your shortlist</span>
            <h2>Wanted</h2>
          </div>
          <span>{wantedIds.length} Pokémon</span>
        </div>
        {wantedIds.length ? (
          <div className="trade-wanted-list">
            {wantedIds.map((id) => {
              const item = byId.get(id);
              if (!item) return null;
              const traits = activeWanted
                .filter((entry) => entry.formId === id && entry.categoryId)
                .map((entry) => entry.categoryId as TradeRequestTrait);
              return (
                <article className="trade-wanted-card" key={id}>
                  <button
                    type="button"
                    className="trade-wanted-card__pokemon"
                    onClick={() => onOpen(item)}
                  >
                    <PokemonSprite item={item} />
                    <span>
                      <strong>{item.name}</strong>
                      <small>#{String(item.dexNumber).padStart(4, '0')}</small>
                    </span>
                    <Icon name="chevron-right" />
                  </button>
                  <div className="trade-request-list">
                    {traits.map((trait) => (
                      <div key={trait}>
                        <span>{requestLabels[trait]}</span>
                        {(trait === 'xxl' || trait === 'xxs') && (
                          <button
                            type="button"
                            onClick={() => onCollectionChange(item, trait, true)}
                          >
                            <Icon name="check" /> I have this
                          </button>
                        )}
                        <button
                          type="button"
                          className="trade-request-list__remove"
                          aria-label={`Remove ${requestLabels[trait]} request for ${item.name}`}
                          onClick={() => void onWantedChange(item, trait, false)}
                        >
                          <Icon name="close" />
                        </button>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="inline-empty">
            <Icon name="heart" />
            <div>
              <strong>No active requests</strong>
              <p>Open any Pokémon and add a realistic request from its Wanted tab.</p>
            </div>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Combined traits preserved</span>
            <h2>For trade</h2>
          </div>
          <span>{tradeSpecimens.length} records</span>
        </div>
        {offeredIds.length ? (
          <div className="offer-list">
            {offeredIds.map((id) => {
              const item = byId.get(id);
              if (!item) return null;
              const specimens = tradeSpecimens.filter((entry) => entry.formId === id);
              return (
                <button type="button" key={id} onClick={() => onOpen(item)}>
                  <PokemonSprite item={item} />
                  <div>
                    <strong>{item.name}</strong>
                    {specimens.map((specimen) => (
                      <span key={specimen.id}>
                        {specimen.quantity}×{' '}
                        {specimen.traits.length ? specimen.traits.join(' + ') : 'Normal'}
                      </span>
                    ))}
                  </div>
                  <Icon name="chevron-right" />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="inline-empty">
            <Icon name="swap" />
            <div>
              <strong>No trade specimens yet</strong>
              <p>Record a real Normal, Shiny, size, or costume specimen from Pokémon details.</p>
            </div>
          </div>
        )}
      </section>

      <div className="notice notice--info trade-rules">
        <Icon name="shield" />
        <div>
          <strong>Trade requests stay practical</strong>
          <p>
            IVs reroll, Lucky status is not transferred, and Shadow Pokémon cannot be traded. Dexly
            keeps this list focused on Normal, Shiny, XXL, XXS, and costume requests.
          </p>
        </div>
      </div>
    </section>
  );
}
