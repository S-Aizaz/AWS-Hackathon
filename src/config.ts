import type { RiskLevel, TextureQuality } from './types';

/** Scene units: the globe has radius 1. Everything else is relative to this. */
export const GLOBE_RADIUS = 1;

/** Mean Earth radius, used to convert kilometres to angles on the sphere. */
export const EARTH_RADIUS_KM = 6371;

/** Earth's axial tilt (obliquity), in radians. */
export const AXIAL_TILT = (23.4 * Math.PI) / 180;

/** Auto-rotation speed in radians/second (~1 revolution per 2 minutes). */
export const ROTATION_SPEED = (2 * Math.PI) / 120;

/** Clouds drift this much faster than the ground (radians/second, relative to the Earth). */
export const CLOUD_DRIFT_SPEED = 0.006;

/** How long after the last drag/zoom before auto-rotation resumes. */
export const RESUME_DELAY_MS = 3000;

/** A pointer that moves more than this between down and up is a drag, not a click. */
export const DRAG_THRESHOLD_PX = 5;

/** Distance of the directional light from the origin (only its direction matters for lighting). */
export const SUN_DISTANCE = 10;
/** Sun height above the equatorial plane when it isn't following the camera, in degrees. */
export const SUN_ELEVATION_DEG = 15;

export const CAMERA = {
  fov: 45,
  initialDistance: 3.2,
  minDistance: 1.2,
  maxDistance: 8,
} as const;

/**
 * Files live in /public/textures — see README for sources.
 * `bumpRoughnessClouds` packs three greyscale maps into one image:
 *   R = elevation (bump), G = land mask (roughness: oceans shiny), B = clouds.
 */
export interface TextureSet {
  day: string;
  night: string;
  bumpRoughnessClouds: string;
}

export const TEXTURE_SETS: Record<TextureQuality, TextureSet> = {
  standard: {
    day: '/textures/2k/earth_day.jpg',
    night: '/textures/2k/earth_night.jpg',
    bumpRoughnessClouds: '/textures/2k/earth_bump_roughness_clouds.jpg',
  },
  high: {
    day: '/textures/4k/earth_day.jpg',
    night: '/textures/4k/earth_night.jpg',
    bumpRoughnessClouds: '/textures/4k/earth_bump_roughness_clouds.jpg',
  },
};

/** Sphere tessellation per quality level (smoother silhouette when zoomed in). */
export const GLOBE_SEGMENTS: Record<TextureQuality, [number, number]> = {
  standard: [128, 64],
  high: [192, 96],
};

/** Small radial offsets above the surface, so layers don't z-fight. */
export const LAYER_ALTITUDE = {
  riskOverlay: 1.003,
  marker: 1.004,
  clouds: 1.012,
} as const;

export const RISK_COLORS: Record<RiskLevel, string> = {
  safe: '#22c55e',
  moderate: '#facc15',
  critical: '#ef4444',
};
