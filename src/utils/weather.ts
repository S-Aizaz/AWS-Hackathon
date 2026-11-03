/**
 * Display helpers for weather data. Pure functions, unit-tested in weather.test.ts.
 */

interface WmoInfo {
  label: string;
  day: string;
  night: string;
}

/** WMO weather interpretation codes (WW), as used by Open-Meteo. */
const WMO: Record<number, WmoInfo> = {
  0: { label: 'Clear sky', day: '☀️', night: '🌙' },
  1: { label: 'Mainly clear', day: '🌤️', night: '🌙' },
  2: { label: 'Partly cloudy', day: '⛅', night: '☁️' },
  3: { label: 'Overcast', day: '☁️', night: '☁️' },
  45: { label: 'Fog', day: '🌫️', night: '🌫️' },
  48: { label: 'Freezing fog', day: '🌫️', night: '🌫️' },
  51: { label: 'Light drizzle', day: '🌦️', night: '🌧️' },
  53: { label: 'Drizzle', day: '🌦️', night: '🌧️' },
  55: { label: 'Heavy drizzle', day: '🌧️', night: '🌧️' },
  56: { label: 'Freezing drizzle', day: '🌧️', night: '🌧️' },
  57: { label: 'Heavy freezing drizzle', day: '🌧️', night: '🌧️' },
  61: { label: 'Light rain', day: '🌦️', night: '🌧️' },
  63: { label: 'Rain', day: '🌧️', night: '🌧️' },
  65: { label: 'Heavy rain', day: '🌧️', night: '🌧️' },
  66: { label: 'Freezing rain', day: '🌧️', night: '🌧️' },
  67: { label: 'Heavy freezing rain', day: '🌧️', night: '🌧️' },
  71: { label: 'Light snow', day: '🌨️', night: '🌨️' },
  73: { label: 'Snow', day: '🌨️', night: '🌨️' },
  75: { label: 'Heavy snow', day: '❄️', night: '❄️' },
  77: { label: 'Snow grains', day: '🌨️', night: '🌨️' },
  80: { label: 'Light showers', day: '🌦️', night: '🌧️' },
  81: { label: 'Showers', day: '🌦️', night: '🌧️' },
  82: { label: 'Violent showers', day: '⛈️', night: '⛈️' },
  85: { label: 'Snow showers', day: '🌨️', night: '🌨️' },
  86: { label: 'Heavy snow showers', day: '❄️', night: '❄️' },
  95: { label: 'Thunderstorm', day: '⛈️', night: '⛈️' },
  96: { label: 'Thunderstorm with hail', day: '⛈️', night: '⛈️' },
  99: { label: 'Severe thunderstorm with hail', day: '⛈️', night: '⛈️' },
};

export function describeWeatherCode(code: number | null, isDay = true): { label: string; icon: string } {
  const info = code === null ? undefined : WMO[code];
  if (!info) return { label: 'Unknown conditions', icon: '🌡️' };
  return { label: info.label, icon: isDay ? info.day : info.night };
}

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

/** 0° → "N", 190° → "S", 359° → "N". */
export function compassDirection(deg: number): string {
  const normalized = ((deg % 360) + 360) % 360;
  return COMPASS[Math.round(normalized / 22.5) % 16];
}

/** Format a number, or "—" when missing. */
export function fmt(value: number | null, digits = 0, unit = ''): string {
  if (value === null) return '—';
  const rounded = Number(value.toFixed(digits));
  return `${Object.is(rounded, -0) ? 0 : rounded}${unit}`;
}

/** "2026-11-03T16:15" → "16:15" (or "4:15 PM", per the viewer's locale). Input is already local to the place. */
export function formatLocalClock(isoLocal: string, locale?: string): string {
  const m = /T(\d{2}):(\d{2})/.exec(isoLocal);
  if (!m) return '';
  const d = new Date(Date.UTC(2000, 0, 1, Number(m[1]), Number(m[2])));
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(d);
}

/** Current wall-clock time at a location, given its UTC offset. */
export function localTimeAt(utcOffsetSeconds: number, now = Date.now(), locale?: string): string {
  const d = new Date(now + utcOffsetSeconds * 1000);
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(d);
}

/** "2026-11-03" → "Today" / "Tue" (relative to the first forecast day, which is "today" at the location). */
export function dayLabel(date: string, index: number, locale?: string): string {
  if (index === 0) return 'Today';
  const [y, mo, d] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(y, mo - 1, d)));
}
