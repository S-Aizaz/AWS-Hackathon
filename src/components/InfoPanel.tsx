import type { CSSProperties } from 'react';
import { RISK_COLORS } from '../config';
import type { LocationInfo, RiskLevel } from '../types';
import { formatLatLng } from '../utils/geo';

interface InfoPanelProps {
  location: LocationInfo | null;
  loading?: boolean;
  onClear?: () => void;
}

const RISK_LABEL: Record<RiskLevel, string> = {
  safe: 'Safe',
  moderate: 'Moderate',
  critical: 'Critical',
};

/** Shows whatever LocationInfo contains. Sections fill in as services start returning data. */
export function InfoPanel({ location, loading = false, onClear }: InfoPanelProps) {
  return (
    <aside className="panel" aria-live="polite">
      <header className="panel__header">
        <h1 className="panel__title">{location?.name ?? (location ? 'Selected location' : 'Earth Explorer')}</h1>
        {location && onClear && (
          <button type="button" className="panel__close" onClick={onClear} aria-label="Clear selection">
            ×
          </button>
        )}
      </header>

      {!location ? (
        <p className="panel__empty">Click anywhere on the globe to select a location.</p>
      ) : (
        <>
          <section className="panel__section">
            <h2>Coordinates</h2>
            <p className="panel__coords">{formatLatLng(location)}</p>
            <dl className="panel__grid">
              <dt>Latitude</dt>
              <dd>{location.lat.toFixed(5)}</dd>
              <dt>Longitude</dt>
              <dd>{location.lng.toFixed(5)}</dd>
            </dl>
          </section>

          <section className="panel__section">
            <h2>Weather</h2>
            {loading ? (
              <p className="panel__muted">Loading…</p>
            ) : location.weather !== undefined ? (
              <pre className="panel__pre">{JSON.stringify(location.weather, null, 2)}</pre>
            ) : (
              <p className="panel__muted">No weather data yet. A provider will be connected in a later phase.</p>
            )}
          </section>

          <section className="panel__section">
            <h2>Risk status</h2>
            {location.risk ? (
              <span className="badge" style={{ '--badge-color': RISK_COLORS[location.risk] } as CSSProperties}>
                {RISK_LABEL[location.risk]}
              </span>
            ) : (
              <p className="panel__muted">Not assessed.</p>
            )}
          </section>
        </>
      )}
    </aside>
  );
}
