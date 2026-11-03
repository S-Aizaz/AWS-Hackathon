import { useId, useState, type CSSProperties } from 'react';
import { RISK_COLORS } from '../config';
import type { LocationInfo, RiskLevel } from '../types';
import { formatLatLng } from '../utils/geo';
import { fmt, localTimeAt } from '../utils/weather';
import { WeatherTab } from './WeatherTab';

interface InfoPanelProps {
  location: LocationInfo | null;
  loading?: boolean;
  onClear?: () => void;
  onRetry?: () => void;
}

type Tab = 'weather' | 'details';

const RISK_LABEL: Record<RiskLevel, string> = {
  safe: 'Safe',
  moderate: 'Moderate',
  critical: 'Critical',
};

/** Shows whatever LocationInfo contains, split into Weather and Details tabs. */
export function InfoPanel({ location, loading = false, onClear, onRetry }: InfoPanelProps) {
  const [tab, setTab] = useState<Tab>('weather');
  const baseId = useId();

  if (!location) {
    return (
      <aside className="panel" aria-live="polite">
        <header className="panel__header">
          <h1 className="panel__title">Earth Explorer</h1>
        </header>
        <p className="panel__empty">Click anywhere on the globe to see live weather for that spot.</p>
      </aside>
    );
  }

  const { place, weather } = location;
  const subtitle = [place?.region, place?.country].filter(Boolean).join(', ');
  // No place name + elevation exactly 0 (Open-Meteo's value for sea cells) → we're over water.
  const overWater = !place && weather?.elevationM === 0;
  const title = place?.name ?? (loading ? 'Locating…' : overWater ? 'Open ocean' : 'Unnamed area');

  return (
    <aside className="panel" aria-live="polite">
      <header className="panel__header">
        <div className="panel__heading">
          <h1 className="panel__title">{title}</h1>
          {subtitle && <p className="panel__subtitle">{subtitle}</p>}
        </div>
        {onClear && (
          <button type="button" className="panel__close" onClick={onClear} aria-label="Clear selection">
            ×
          </button>
        )}
      </header>
      <p className="panel__coords">
        {formatLatLng(location)}
        {weather && <span className="panel__time"> · {localTimeAt(weather.utcOffsetSeconds)} local</span>}
      </p>

      <div className="tabs" role="tablist" aria-label="Location information">
        {(['weather', 'details'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`${baseId}-tab-${t}`}
            aria-selected={tab === t}
            aria-controls={`${baseId}-panel-${t}`}
            className="tabs__tab"
            onClick={() => setTab(t)}
          >
            {t === 'weather' ? 'Weather' : 'Details'}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`${baseId}-panel-${tab}`} aria-labelledby={`${baseId}-tab-${tab}`} className="tabs__panel">
        {tab === 'weather' ? (
          <WeatherTab weather={weather} loading={loading} error={location.errors?.weather} onRetry={onRetry} />
        ) : (
          <DetailsTab location={location} />
        )}
      </div>

      <p className="panel__attribution">
        Weather data by{' '}
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
          Open-Meteo.com
        </a>{' '}
        · Places ©{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          OpenStreetMap contributors
        </a>
      </p>
    </aside>
  );
}

function DetailsTab({ location }: { location: LocationInfo }) {
  const { place, weather, errors } = location;
  return (
    <>
      <dl className="panel__grid">
        <dt>Latitude</dt>
        <dd>{location.lat.toFixed(5)}</dd>
        <dt>Longitude</dt>
        <dd>{location.lng.toFixed(5)}</dd>
        {weather && (
          <>
            <dt>Elevation</dt>
            <dd>{fmt(weather.elevationM, 0, ' m')}</dd>
            <dt>Time zone</dt>
            <dd>
              {weather.timezone}
              {weather.timezoneAbbreviation && weather.timezoneAbbreviation !== weather.timezone
                ? ` (${weather.timezoneAbbreviation})`
                : ''}
            </dd>
          </>
        )}
      </dl>

      <section className="panel__section">
        <h2>Address</h2>
        {place ? (
          <p className="panel__text">{place.displayName}</p>
        ) : (
          <p className="panel__muted">
            {errors?.place ??
              (weather?.elevationM === 0 ? 'Open water: no address here.' : 'No named place nearby (remote area).')}
          </p>
        )}
      </section>

      <section className="panel__section">
        <h2>Risk status</h2>
        {location.risk ? (
          <span className="badge" style={{ '--badge-color': RISK_COLORS[location.risk] } as CSSProperties}>
            {RISK_LABEL[location.risk]}
          </span>
        ) : (
          <p className="panel__muted">Not assessed yet.</p>
        )}
      </section>
    </>
  );
}
