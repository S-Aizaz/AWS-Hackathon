import type { PlaceInfo } from '../types';
import { TtlCache, coordKey, fetchJson } from './http';

/**
 * Reverse geocoding from OpenStreetMap's Nominatim. This is the same endpoint the
 * OSM MCP server's `reverse_geocode` tool calls (github.com/jagan-shanmugam/osm-mcp-server).
 *
 * Usage policy (https://operations.osmfoundation.org/policies/nominatim/):
 *  - at most 1 request per second → requests are queued below,
 *  - cache results → 24 h cache,
 *  - show attribution "© OpenStreetMap contributors" → shown in the InfoPanel.
 * For production traffic, point NOMINATIM_URL at your own instance or a commercial provider.
 */
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
const MIN_INTERVAL_MS = 1100;

/** `null` = the lookup worked but there's no named place here (e.g. open ocean). */
const cache = new TtlCache<PlaceInfo | null>(24 * 60 * 60 * 1000);
let nextSlot = 0;

/** Wait for our turn so we never exceed 1 request/second, even when the user clicks rapidly. */
async function waitForSlot(signal?: AbortSignal): Promise<void> {
  const now = Date.now();
  const start = Math.max(now, nextSlot);
  nextSlot = start + MIN_INTERVAL_MS;
  const wait = start - now;
  if (wait <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, wait);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

export function buildReverseUrl(lat: number, lng: number): string {
  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: lat.toFixed(5),
    lon: lng.toFixed(5),
    zoom: '10', // city/town level, the useful granularity for weather
    addressdetails: '1',
    'accept-language': 'en',
  });
  return `${NOMINATIM_URL}?${params}`;
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** Map Nominatim's JSON to PlaceInfo; `null` when there's no place at this point. */
export function parseReverse(json: unknown): PlaceInfo | null {
  if (typeof json !== 'object' || json === null) return null;
  const j = json as Record<string, unknown>;
  if ('error' in j) return null; // {"error":"Unable to geocode"} over oceans/remote areas
  const a = (typeof j.address === 'object' && j.address !== null ? j.address : {}) as Record<string, unknown>;

  const locality =
    str(j.name) ??
    str(a.city) ??
    str(a.town) ??
    str(a.village) ??
    str(a.municipality) ??
    str(a.hamlet) ??
    str(a.suburb) ??
    str(a.county);
  const region = str(a.state) ?? str(a.region) ?? str(a.state_district);
  const country = str(a.country);
  const name = locality ?? region ?? country;
  const displayName = str(j.display_name);
  if (!name || !displayName) return null;

  return {
    name,
    region: region && region !== name ? region : undefined,
    country: country && country !== name ? country : undefined,
    countryCode: str(a.country_code)?.toUpperCase(),
    displayName,
  };
}

/** Nearest named place for a point, or null if there isn't one. */
export async function reverseGeocode(lat: number, lng: number, options: { signal?: AbortSignal } = {}): Promise<PlaceInfo | null> {
  const key = coordKey(lat, lng);
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  await waitForSlot(options.signal);
  const place = parseReverse(await fetchJson(buildReverseUrl(lat, lng), options));
  cache.set(key, place);
  return place;
}
