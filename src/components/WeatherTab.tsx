import type { ReactNode } from 'react';
import type { WeatherReport } from '../types';
import { compassDirection, dayLabel, describeWeatherCode, fmt, formatLocalClock } from '../utils/weather';

interface WeatherTabProps {
  weather?: WeatherReport;
  loading: boolean;
  error?: string;
  onRetry?: () => void;
}

export function WeatherTab({ weather, loading, error, onRetry }: WeatherTabProps) {
  if (loading && !weather) return <WeatherSkeleton />;

  if (!weather) {
    return (
      <div className="weather__error" role="alert">
        <p>{error ?? 'No weather data for this location.'}</p>
        {onRetry && (
          <button type="button" className="btn" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    );
  }

  const { current, daily } = weather;
  const today = daily[0];
  const conditions = describeWeatherCode(current.weatherCode, current.isDay);

  return (
    <div className="weather">
      <div className="weather__now">
        <span className="weather__icon" role="img" aria-label={conditions.label}>
          {conditions.icon}
        </span>
        <div>
          <div className="weather__temp">{fmt(current.temperatureC, 0, '°C')}</div>
          <div className="weather__label">{conditions.label}</div>
        </div>
      </div>
      <p className="weather__sub">
        Feels like {fmt(current.apparentTemperatureC, 0, '°')}
        {today && (
          <>
            {' '}
            · H {fmt(today.tempMaxC, 0, '°')} L {fmt(today.tempMinC, 0, '°')}
          </>
        )}
      </p>

      <dl className="weather__grid">
        <Stat label="Wind">
          {current.windDirectionDeg !== null && (
            <span
              className="weather__arrow"
              style={{ transform: `rotate(${current.windDirectionDeg}deg)` }}
              title={`From ${compassDirection(current.windDirectionDeg)}`}
              aria-hidden="true"
            >
              ↓
            </span>
          )}
          {fmt(current.windSpeedKmh, 0, ' km/h')}
          {current.windDirectionDeg !== null && ` ${compassDirection(current.windDirectionDeg)}`}
        </Stat>
        <Stat label="Gusts">{fmt(current.windGustsKmh, 0, ' km/h')}</Stat>
        <Stat label="Humidity">{fmt(current.humidityPct, 0, '%')}</Stat>
        <Stat label="Precipitation">{fmt(current.precipitationMm, 1, ' mm')}</Stat>
        <Stat label="Cloud cover">{fmt(current.cloudCoverPct, 0, '%')}</Stat>
        <Stat label="Pressure">{fmt(current.pressureHpa, 0, ' hPa')}</Stat>
      </dl>

      {daily.length > 0 && (
        <>
          <h3 className="weather__heading">{daily.length}-day forecast</h3>
          <ul className="forecast">
            {daily.map((day, i) => {
              const d = describeWeatherCode(day.weatherCode, true);
              return (
                <li key={day.date} className="forecast__row">
                  <span className="forecast__day">{dayLabel(day.date, i)}</span>
                  <span className="forecast__icon" role="img" aria-label={d.label} title={d.label}>
                    {d.icon}
                  </span>
                  <span className="forecast__rain" title="Chance of precipitation">
                    {day.precipitationProbabilityPct !== null ? `💧${fmt(day.precipitationProbabilityPct, 0, '%')}` : ''}
                  </span>
                  <span className="forecast__temps">
                    <strong>{fmt(day.tempMaxC, 0, '°')}</strong>
                    <span>{fmt(day.tempMinC, 0, '°')}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <p className="weather__meta">
        {loading ? 'Refreshing…' : `Updated ${formatLocalClock(current.time)} local time`}
      </p>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="weather__stat">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function WeatherSkeleton() {
  return (
    <div className="weather" aria-busy="true" aria-label="Loading weather">
      <div className="skeleton skeleton--hero" />
      <div className="skeleton skeleton--line" />
      <div className="skeleton skeleton--grid" />
      <div className="skeleton skeleton--list" />
    </div>
  );
}
