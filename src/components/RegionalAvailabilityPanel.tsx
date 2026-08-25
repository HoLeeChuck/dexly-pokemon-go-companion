import { useMemo, useState } from 'react';
import type { CatalogItem } from '../../shared/types';
import {
  REGION_PREFERENCES,
  coarseRegionFromCoordinates,
  isRegionPreference,
  recommendedForRegion,
  type RegionPreference,
} from '../catalog/regionalAvailability';
import { catalogDisplayName } from '../lib/catalogDisplay';
import { Icon } from './Icon';

export function RegionalAvailabilityPanel({
  catalog,
  preference,
  onPreferenceChange,
}: {
  catalog: readonly CatalogItem[];
  preference: string;
  onPreferenceChange: (preference: RegionPreference) => void;
}) {
  const selected = isRegionPreference(preference) ? preference : 'no-preference';
  const [locationMessage, setLocationMessage] = useState('');
  const regionalForms = useMemo(
    () =>
      catalog
        .filter((item) => item.isReleased && item.availability?.mode === 'regional')
        .sort((left, right) => catalogDisplayName(left).localeCompare(catalogDisplayName(right))),
    [catalog],
  );
  const recommended = regionalForms.filter((item) => recommendedForRegion(item, selected));
  const vivillon = regionalForms.filter((item) => item.dexNumber === 666);

  function useApproximateLocation() {
    if (!navigator.geolocation) {
      setLocationMessage('Location is not available in this browser. Choose a region manually.');
      return;
    }
    setLocationMessage('Waiting for browser permission…');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const coarse = coarseRegionFromCoordinates(coords.latitude, coords.longitude);
        onPreferenceChange(coarse);
        setLocationMessage(
          'Saved an approximate region only. CatchGrid discarded the coordinates immediately.',
        );
      },
      () =>
        setLocationMessage(
          'Location was not shared. Nothing changed; choose a region manually or keep No preference.',
        ),
      { enableHighAccuracy: false, maximumAge: 86_400_000, timeout: 10_000 },
    );
  }

  return (
    <section className="panel regional-availability-panel" aria-labelledby="regional-heading">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Regional availability</span>
          <h2 id="regional-heading">What may be available near you</h2>
        </div>
        <Icon name="grid" />
      </div>
      <p>
        This preference highlights likely local forms. It never hides forms or changes your
        collection, and event availability can override the usual regions.
      </p>
      <div className="regional-preference-controls">
        <label>
          Country or region
          <select
            value={selected}
            onChange={(event) => onPreferenceChange(event.target.value as RegionPreference)}
          >
            {REGION_PREFERENCES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="button button--secondary" onClick={useApproximateLocation}>
          <Icon name="user" /> Use approximate location
        </button>
      </div>
      <p className="backup-help">
        Location is requested only after you press the button. Coordinates stay in this browser, are
        converted locally, and are never stored or sent to CatchGrid.
      </p>
      {locationMessage && <p role="status">{locationMessage}</p>}

      {selected !== 'no-preference' && (
        <div className="regional-recommendations">
          <h3>Likely near you</h3>
          {recommended.length ? (
            <ul>
              {recommended.map((item) => (
                <li key={item.id}>
                  <strong>{catalogDisplayName(item)}</strong>
                  {item.availability?.note && <span>{item.availability.note}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p>No form-specific recommendation is available. The complete list remains below.</p>
          )}
        </div>
      )}

      <details className="regional-form-browser">
        <summary>Browse all regional forms ({regionalForms.length})</summary>
        <ul>
          {regionalForms.map((item) => (
            <li key={item.id}>
              <strong>{catalogDisplayName(item)}</strong>
              <span>{item.availability?.note ?? item.availability?.zones.join(', ')}</span>
            </li>
          ))}
        </ul>
      </details>

      <details className="vivillon-browser">
        <summary>Vivillon pattern map and accessible list ({vivillon.length})</summary>
        <p>
          Pokémon GO awards Scatterbug encounters from pinned postcards; evolve Scatterbug through
          Spewpa to retain that habitat pattern. The in-game Vivillon Collector map is the precise
          source for a postcard location.
        </p>
        <div className="vivillon-zone-map" aria-hidden="true">
          <span>Americas</span>
          <span>Europe & Africa</span>
          <span>Asia-Pacific</span>
        </div>
        <ul>
          {vivillon.map((item) => (
            <li key={item.id}>
              <strong>{catalogDisplayName(item)}</strong>
              <span>{item.availability?.note ?? 'See the in-game Vivillon map.'}</span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
