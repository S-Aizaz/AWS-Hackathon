/** Geographic coordinate in degrees. lat ∈ [-90, 90], lng ∈ [-180, 180). */
export interface LatLng {
  lat: number;
  lng: number;
}

export type RiskLevel = 'safe' | 'moderate' | 'critical';

/** Everything we know about a selected point. Fields fill in as data services come online. */
export interface LocationInfo {
  lat: number;
  lng: number;
  name?: string;
  /** Raw weather payload — typed as `unknown` until a weather provider is chosen. */
  weather?: unknown;
  risk?: RiskLevel;
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
