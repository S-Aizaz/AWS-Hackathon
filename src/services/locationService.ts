import type { LocationInfo } from '../types';

export interface LocationRequestOptions {
  /** Aborted when the user clicks somewhere else before this request finishes. */
  signal?: AbortSignal;
}

/**
 * Single entry point for "what do we know about this point?".
 *
 * Phase 1: returns only the coordinates.
 * Later phases, plug data sources in here and leave the UI alone:
 *   - reverse geocoding        → `name`
 *   - weather API              → `weather` (pass `options.signal` to fetch())
 *   - risk classification      → `risk`
 */
export async function getLocationInfo(
  lat: number,
  lng: number,
  options: LocationRequestOptions = {},
): Promise<LocationInfo> {
  options.signal?.throwIfAborted();

  // Example for later:
  // const res = await fetch(`https://api.example.com/weather?lat=${lat}&lon=${lng}`, { signal: options.signal });
  // const weather = await res.json();
  // return { lat, lng, weather, risk: classifyRisk(weather) };

  return { lat, lng };
}
