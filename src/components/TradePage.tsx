import type { CatalogItem, TradeSpecimen, WantedEntry } from '../../shared/types';
import { Icon } from './Icon';
import { PokemonSprite } from './PokemonSprite';

export function TradePage({
  catalog,
  wantedEntries,
  tradeSpecimens,
  onOpen,
}: {
  catalog: readonly CatalogItem[];
  wantedEntries: readonly WantedEntry[];
  tradeSpecimens: readonly TradeSpecimen[];
  onOpen: (item: CatalogItem) => void;
}) {
  const byId = new Map(catalog.map((item) => [item.id, item]));
  const wantedIds = [
    ...new Set(wantedEntries.filter((entry) => entry.wanted).map((entry) => entry.formId)),
  ];
  const offeredIds = [...new Set(tradeSpecimens.map((entry) => entry.formId))];

  return (
    <section className="page page--trade">
      <header className="page-hero trade-hero">
        <div>
          <span className="eyebrow eyebrow--light">
            <Icon name="swap" /> Trade kit
          </span>
          <h1>Plan trades without mixing up your Dex.</h1>
          <p>Wanted goals and actual trade specimens stay separate from collection history.</p>
        </div>
        <div className="trade-hero__cards" aria-hidden="true">
          <span />
          <span />
          <Icon name="swap" />
        </div>
      </header>

      <div className="trade-stats">
        <article>
          <span className="stat-icon stat-icon--heart">
            <Icon name="heart" />
          </span>
          <div>
            <strong>{wantedIds.length}</strong>
            <small>Pokémon wanted</small>
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
          <span>{wantedEntries.length} trait goals</span>
        </div>
        {wantedIds.length ? (
          <div className="mini-card-grid">
            {wantedIds.map((id) => {
              const item = byId.get(id);
              if (!item) return null;
              const traits = wantedEntries
                .filter((entry) => entry.formId === id && entry.wanted)
                .map((entry) => entry.categoryId)
                .filter(Boolean);
              return (
                <button type="button" key={id} onClick={() => onOpen(item)}>
                  <PokemonSprite item={item} />
                  <span>
                    <strong>{item.name}</strong>
                    <small>{traits.join(' · ')}</small>
                  </span>
                  <Icon name="chevron-right" />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="inline-empty">
            <Icon name="heart" />
            <div>
              <strong>No wanted entries yet</strong>
              <p>Open any Pokémon and add traits from its Wanted tab.</p>
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
              <p>
                Record a real specimen—including combined Shiny, costume, or size traits—from
                Pokémon details.
              </p>
            </div>
          </div>
        )}
      </section>

      <div className="notice notice--info trade-rules">
        <Icon name="shield" />
        <div>
          <strong>Game rules stay explicit</strong>
          <p>
            IVs reroll during a trade, Lucky status does not transfer, and Shadow Pokémon cannot be
            traded. Dexly will not promise those outcomes.
          </p>
        </div>
      </div>
    </section>
  );
}
