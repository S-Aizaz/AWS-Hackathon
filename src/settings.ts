import type { GlobeSettings, LightingPreset, TextureQuality } from './types';

/** Slider ranges, shared by the settings UI and by validation of stored values. */
export const RANGES = {
  sunIntensity: { min: 0, max: 6, step: 0.1 },
  ambientIntensity: { min: 0, max: 4, step: 0.05 },
  exposure: { min: 0.4, max: 2.5, step: 0.05 },
  sunAzimuth: { min: -180, max: 180, step: 1 },
} as const;

type LightingValues = Pick<
  GlobeSettings,
  'sunIntensity' | 'ambientIntensity' | 'exposure' | 'nightLights' | 'sunFollowsCamera'
>;

export const LIGHTING_PRESETS: Record<LightingPreset, { label: string; description: string; values: LightingValues }> = {
  realistic: {
    label: 'Realistic',
    description: 'Fixed sun, dark night side with city lights',
    values: { sunIntensity: 3.2, ambientIntensity: 0.08, exposure: 1, nightLights: true, sunFollowsCamera: false },
  },
  bright: {
    label: 'Bright',
    description: 'Sun behind you, so the side you see is always in daylight',
    values: { sunIntensity: 3.6, ambientIntensity: 0.6, exposure: 1.2, nightLights: false, sunFollowsCamera: true },
  },
  even: {
    label: 'Even',
    description: 'Soft, uniform light everywhere, best for reading overlays',
    values: { sunIntensity: 1, ambientIntensity: 2.6, exposure: 1.1, nightLights: false, sunFollowsCamera: true },
  },
};

/** Phones and small screens start on 2K textures; everything else gets 4K. */
export function defaultQuality(): TextureQuality {
  if (typeof window === 'undefined' || !window.matchMedia) return 'high';
  return window.matchMedia('(max-width: 640px), (pointer: coarse)').matches ? 'standard' : 'high';
}

export function defaultSettings(): GlobeSettings {
  return {
    autoRotate: true,
    clouds: true,
    quality: defaultQuality(),
    sunAzimuth: 60,
    ...LIGHTING_PRESETS.realistic.values,
  };
}

/** Which preset (if any) the current lighting values match. */
export function matchingPreset(settings: GlobeSettings): LightingPreset | null {
  const eq = (a: number, b: number) => Math.abs(a - b) < 1e-6;
  for (const [name, { values }] of Object.entries(LIGHTING_PRESETS) as Array<[LightingPreset, { values: LightingValues }]>) {
    if (
      eq(settings.sunIntensity, values.sunIntensity) &&
      eq(settings.ambientIntensity, values.ambientIntensity) &&
      eq(settings.exposure, values.exposure) &&
      settings.nightLights === values.nightLights &&
      settings.sunFollowsCamera === values.sunFollowsCamera
    ) {
      return name;
    }
  }
  return null;
}

/**
 * Merge untrusted input (e.g. from localStorage) over the defaults.
 * Wrong types are dropped and numbers are clamped to their slider range.
 */
export function sanitizeSettings(input: unknown, defaults: GlobeSettings = defaultSettings()): GlobeSettings {
  const out: GlobeSettings = { ...defaults };
  if (!input || typeof input !== 'object') return out;
  const raw = input as Record<string, unknown>;

  for (const key of ['autoRotate', 'clouds', 'nightLights', 'sunFollowsCamera'] as const) {
    if (typeof raw[key] === 'boolean') out[key] = raw[key];
  }
  if (raw.quality === 'standard' || raw.quality === 'high') out.quality = raw.quality;
  for (const key of Object.keys(RANGES) as Array<keyof typeof RANGES>) {
    const v = raw[key];
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[key] = Math.min(RANGES[key].max, Math.max(RANGES[key].min, v));
    }
  }
  return out;
}
