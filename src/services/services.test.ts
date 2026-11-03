import { afterEach, describe, expect, it, vi } from 'vitest';
import { describeError, HttpError } from './http';
import { getLocationInfo } from './locationService';
import { buildReverseUrl, parseReverse } from './placeService';
import { buildForecastUrl, parseForecast } from './weatherService';

/** Trimmed real Open-Meteo response (New York, 2026-11-03). */
const OPEN_METEO = {
  latitude: 40.710335,
  longitude: -73.99308,
  utc_offset_seconds: -18000,
  timezone: 'America/New_York',
  timezone_abbreviation: 'GMT-5',
  elevation: 27.0,
  current: {
    time: '2026-11-03T16:15',
    interval: 900,
    temperature_2m: 19.4,
    apparent_temperature: 17.5,
    relative_humidity_2m: 49,
    precipitation: 0.0,
    weather_code: 0,
    cloud_cover: 13,
    surface_pressure: 1020.6,
    wind_speed_10m: 10.5,
    wind_direction_10m: 189,
    wind_gusts_10m: 19.8,
    is_day: 1,
  },
  daily: {
    time: ['2026-11-03', '2026-11-04'],
    weather_code: [3, 53],
    temperature_2m_max: [21.0, 19.8],
    temperature_2m_min: [11.2, 12.0],
    precipitation_sum: [0, 2.4],
    precipitation_probability_max: [5, null],
    wind_speed_10m_max: [14.1, 20.3],
    uv_index_max: [3.1, 2.0],
  },
};

/** Real Nominatim response shape (zoom=10). */
const NOMINATIM = {
  name: 'Manhattan',
  display_name: 'Manhattan, New York County, New York, United States',
  address: {
    suburb: 'Manhattan',
    county: 'New York County',
    city: 'New York',
    state: 'New York',
    country: 'United States',
    country_code: 'us',
  },
};

describe('weatherService', () => {
  it('builds a forecast URL with local timezone and rounded coordinates', () => {
    const url = new URL(buildForecastUrl(40.712345678, -74.006));
    expect(url.origin).toBe('https://api.open-meteo.com');
    expect(url.searchParams.get('latitude')).toBe('40.7123');
    expect(url.searchParams.get('timezone')).toBe('auto');
    expect(url.searchParams.get('current')).toContain('wind_gusts_10m');
  });

  it('parses current conditions and the daily forecast', () => {
    const r = parseForecast(OPEN_METEO);
    expect(r.timezone).toBe('America/New_York');
    expect(r.utcOffsetSeconds).toBe(-18000);
    expect(r.current).toMatchObject({ temperatureC: 19.4, windDirectionDeg: 189, isDay: true, weatherCode: 0 });
    expect(r.daily).toHaveLength(2);
    expect(r.daily[1]).toMatchObject({ date: '2026-11-04', precipitationMm: 2.4, precipitationProbabilityPct: null });
  });

  it('turns missing values into null instead of crashing', () => {
    const r = parseForecast({ current: { time: 'x', temperature_2m: null }, daily: { time: ['2026-01-01'] } });
    expect(r.current.temperatureC).toBeNull();
    expect(r.current.windSpeedKmh).toBeNull();
    expect(r.daily[0].tempMaxC).toBeNull();
  });

  it('throws a readable error on API error payloads', () => {
    expect(() => parseForecast({ error: true, reason: 'Latitude must be in range' })).toThrow(/Latitude must be in range/);
  });
});

describe('placeService', () => {
  it('builds a Nominatim reverse URL', () => {
    const url = new URL(buildReverseUrl(40.71, -74.01));
    expect(url.hostname).toBe('nominatim.openstreetmap.org');
    expect(url.searchParams.get('format')).toBe('jsonv2');
    expect(url.searchParams.get('zoom')).toBe('10');
  });

  it('extracts name, region and country', () => {
    expect(parseReverse(NOMINATIM)).toEqual({
      name: 'Manhattan',
      region: 'New York',
      country: 'United States',
      countryCode: 'US',
      displayName: 'Manhattan, New York County, New York, United States',
    });
  });

  it('falls back through address fields and drops duplicates', () => {
    const p = parseReverse({ display_name: 'Nunavut, Canada', address: { state: 'Nunavut', country: 'Canada' } });
    expect(p).toMatchObject({ name: 'Nunavut', region: undefined, country: 'Canada' });
  });

  it('returns null over open ocean', () => {
    expect(parseReverse({ error: 'Unable to geocode' })).toBeNull();
    expect(parseReverse(null)).toBeNull();
  });
});

describe('getLocationInfo', () => {
  afterEach(() => vi.unstubAllGlobals());

  const respond = (body: unknown, status = 200) =>
    Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

  it('combines weather and place data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => (url.includes('open-meteo') ? respond(OPEN_METEO) : respond(NOMINATIM))),
    );
    const info = await getLocationInfo(10.001, 20.001);
    expect(info.name).toBe('Manhattan');
    expect(info.weather?.current.temperatureC).toBe(19.4);
    expect(info.errors).toBeUndefined();
  });

  it('keeps the weather when the place lookup fails (and vice versa)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => (url.includes('open-meteo') ? respond(OPEN_METEO) : respond({}, 503))),
    );
    const info = await getLocationInfo(-30.001, 50.001);
    expect(info.weather).toBeDefined();
    expect(info.place).toBeUndefined();
    expect(info.errors?.place).toMatch(/temporarily unavailable/);
  });

  it('rejects when aborted, so stale results are never shown', async () => {
    vi.stubGlobal('fetch', vi.fn(() => respond(OPEN_METEO)));
    const controller = new AbortController();
    controller.abort();
    await expect(getLocationInfo(1.5, 2.5, { signal: controller.signal })).rejects.toThrow();
  });
});

describe('describeError', () => {
  it('gives friendly messages', () => {
    expect(describeError(new HttpError(429, 'x'))).toMatch(/Too many requests/);
    expect(describeError(new TypeError('Failed to fetch'))).toMatch(/Network error/);
    expect(describeError(new DOMException('t', 'TimeoutError'))).toMatch(/too long/);
  });
});
