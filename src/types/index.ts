/** Geographic coordinate in degrees. lat ∈ [-90, 90], lng ∈ [-180, 180). */
export interface LatLng {
  lat: number;
  lng: number;
}

export type RiskLevel = 'safe' | 'moderate' | 'critical';

/** Everything we know about a selected point. Fields fill in as data services respond. */
export interface LocationInfo {
  lat: number;
  lng: number;
  /** Short human-readable name (e.g. "Manhattan"), if the point is near a named place. */
  name?: string;
  place?: PlaceInfo;
  weather?: WeatherReport;
  risk?: RiskLevel;
  /** Per-source failures, so one failing API doesn't hide the other's data. */
  errors?: Partial<Record<'weather' | 'place', string>>;
}

/** Reverse-geocoded place (OpenStreetMap / Nominatim). */
export interface PlaceInfo {
  name: string;
  /** State / region, when different from the name. */
  region?: string;
  country?: string;
  countryCode?: string;
  /** Full address line as returned by the geocoder. */
  displayName: string;
}

/**
 * Numbers are `null` when the provider has no value for that point
 * (e.g. some variables are unavailable over open ocean).
 */
export interface CurrentWeather {
  /** Local time at the location, ISO without offset (e.g. "2026-11-03T16:15"). */
  time: string;
  temperatureC: number | null;
  apparentTemperatureC: number | null;
  humidityPct: number | null;
  precipitationMm: number | null;
  /** WMO weather interpretation code. */
  weatherCode: number | null;
  cloudCoverPct: number | null;
  pressureHpa: number | null;
  windSpeedKmh: number | null;
  /** Direction the wind blows FROM, degrees clockwise from north. */
  windDirectionDeg: number | null;
  windGustsKmh: number | null;
  isDay: boolean;
}

export interface DailyForecast {
  /** Local date, "YYYY-MM-DD". */
  date: string;
  weatherCode: number | null;
  tempMaxC: number | null;
  tempMinC: number | null;
  precipitationMm: number | null;
  precipitationProbabilityPct: number | null;
  windSpeedMaxKmh: number | null;
  uvIndexMax: number | null;
}

export interface WeatherReport {
  /** IANA zone (e.g. "America/New_York") or "GMT" over open ocean. */
  timezone: string;
  timezoneAbbreviation: string;
  utcOffsetSeconds: number;
  elevationM: number | null;
  current: CurrentWeather;
  daily: DailyForecast[];
}

/** A circular area on the globe surface, drawn by <RiskOverlay />. */
export interface RiskZone {
  id: string;
  lat: number;
  lng: number;
  radiusKm: number;
  risk: RiskLevel;
  label?: string;
}

export type TextureQuality = 'standard' | 'high';

export type LightingPreset = 'realistic' | 'bright' | 'even';

/** User-adjustable display options (persisted in localStorage). */
export interface GlobeSettings {
  /** Earth spins on its own when true. */
  autoRotate: boolean;
  clouds: boolean;
  /** City lights glow on the night side. */
  nightLights: boolean;
  quality: TextureQuality;
  /** Directional "sun" light intensity. */
  sunIntensity: number;
  /** Uniform fill light, brightens the night side. */
  ambientIntensity: number;
  /** Overall brightness (renderer tone-mapping exposure). */
  exposure: number;
  /** Sun direction around the globe in degrees (-180..180); ignored when sunFollowsCamera. */
  sunAzimuth: number;
  /** Keep the sun just behind the viewer so the side you're looking at is always lit. */
  sunFollowsCamera: boolean;
}
