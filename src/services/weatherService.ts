import type { CurrentWeather, DailyForecast, WeatherReport } from '../types';
import { TtlCache, coordKey, fetchJson } from './http';

/**
 * Weather from Open-Meteo (https://open-meteo.com): free, no API key, CORS-enabled.
 * Licence: CC BY 4.0, so the UI must show "Weather data by Open-Meteo.com".
 */
const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
const FORECAST_DAYS = 5;

const CURRENT_VARS = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'precipitation',
  'weather_code',
  'cloud_cover',
  'surface_pressure',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'is_day',
] as const;

const DAILY_VARS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
  'precipitation_probability_max',
  'wind_speed_10m_max',
  'uv_index_max',
] as const;

const cache = new TtlCache<WeatherReport>(10 * 60 * 1000); // model data updates every ~15 min

export function buildForecastUrl(lat: number, lng: number): string {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lng.toFixed(4),
    current: CURRENT_VARS.join(','),
    daily: DAILY_VARS.join(','),
    timezone: 'auto', // times come back in the location's local time
    forecast_days: String(FORECAST_DAYS),
  });
  return `${ENDPOINT}?${params}`;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const at = (arr: unknown, i: number): unknown => (Array.isArray(arr) ? arr[i] : undefined);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Map Open-Meteo's JSON to our WeatherReport. Throws if the core structure is missing. */
export function parseForecast(json: unknown): WeatherReport {
  if (!isObj(json) || !isObj(json.current)) {
    const reason = isObj(json) && typeof json.reason === 'string' ? json.reason : 'unexpected response';
    throw new Error(`Weather data unavailable: ${reason}`);
  }
  const c = json.current;
  const current: CurrentWeather = {
    time: typeof c.time === 'string' ? c.time : '',
    temperatureC: num(c.temperature_2m),
    apparentTemperatureC: num(c.apparent_temperature),
    humidityPct: num(c.relative_humidity_2m),
    precipitationMm: num(c.precipitation),
    weatherCode: num(c.weather_code),
    cloudCoverPct: num(c.cloud_cover),
    pressureHpa: num(c.surface_pressure),
    windSpeedKmh: num(c.wind_speed_10m),
    windDirectionDeg: num(c.wind_direction_10m),
    windGustsKmh: num(c.wind_gusts_10m),
    isDay: c.is_day === 1,
  };

  const d = isObj(json.daily) ? json.daily : {};
  const dates = Array.isArray(d.time) ? d.time : [];
  const daily: DailyForecast[] = dates
    .map((date, i) => ({
      date: String(date),
      weatherCode: num(at(d.weather_code, i)),
      tempMaxC: num(at(d.temperature_2m_max, i)),
      tempMinC: num(at(d.temperature_2m_min, i)),
      precipitationMm: num(at(d.precipitation_sum, i)),
      precipitationProbabilityPct: num(at(d.precipitation_probability_max, i)),
      windSpeedMaxKmh: num(at(d.wind_speed_10m_max, i)),
      uvIndexMax: num(at(d.uv_index_max, i)),
    }))
    .filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day.date));

  return {
    timezone: typeof json.timezone === 'string' ? json.timezone : 'GMT',
    timezoneAbbreviation: typeof json.timezone_abbreviation === 'string' ? json.timezone_abbreviation : '',
    utcOffsetSeconds: num(json.utc_offset_seconds) ?? 0,
    elevationM: num(json.elevation),
    current,
    daily,
  };
}

/** Current conditions + 5-day forecast for a point. Cached for 10 minutes per ~1 km cell. */
export async function fetchWeather(lat: number, lng: number, options: { signal?: AbortSignal } = {}): Promise<WeatherReport> {
  const key = coordKey(lat, lng);
  const cached = cache.get(key);
  if (cached) return cached;
  const report = parseForecast(await fetchJson(buildForecastUrl(lat, lng), options));
  cache.set(key, report);
  return report;
}
