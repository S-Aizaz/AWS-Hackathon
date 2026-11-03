import type { LocationInfo } from '../types';
import { describeError } from './http';
import { reverseGeocode } from './placeService';
import { fetchWeather } from './weatherService';

export interface LocationRequestOptions {
  /** Aborted when the user clicks somewhere else before this request finishes. */
  signal?: AbortSignal;
}

/**
 * Single entry point for "what do we know about this point?".
 * The UI only talks to this function, so data sources can change freely behind it.
 *
 * Sources (queried in parallel; one failing doesn't hide the other):
 *   - weather → Open-Meteo        (services/weatherService.ts)
 *   - place   → OSM Nominatim     (services/placeService.ts)
 * Later: derive `risk` from the weather here (e.g. wind gusts, precipitation thresholds).
 */
export async function getLocationInfo(
  lat: number,
  lng: number,
  options: LocationRequestOptions = {},
): Promise<LocationInfo> {
  const { signal } = options;
  signal?.throwIfAborted();

  const [weather, place] = await Promise.allSettled([
    fetchWeather(lat, lng, { signal }),
    reverseGeocode(lat, lng, { signal }),
  ]);
  // If the user clicked elsewhere meanwhile, drop this result entirely.
  signal?.throwIfAborted();

  const info: LocationInfo = { lat, lng };
  const errors: NonNullable<LocationInfo['errors']> = {};

  if (weather.status === 'fulfilled') info.weather = weather.value;
  else errors.weather = describeError(weather.reason);

  if (place.status === 'fulfilled') {
    if (place.value) {
      info.place = place.value;
      info.name = place.value.name;
    }
  } else {
    errors.place = describeError(place.reason);
  }

  if (errors.weather || errors.place) info.errors = errors;
  return info;
}
