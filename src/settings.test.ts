import { describe, expect, it } from 'vitest';
import { LIGHTING_PRESETS, defaultSettings, matchingPreset, sanitizeSettings } from './settings';
import type { GlobeSettings } from './types';

const base: GlobeSettings = { ...defaultSettings(), quality: 'high' };

describe('sanitizeSettings', () => {
  it('returns defaults for non-objects', () => {
    expect(sanitizeSettings(null, base)).toEqual(base);
    expect(sanitizeSettings('nope', base)).toEqual(base);
  });

  it('keeps valid values and drops wrong types', () => {
    const out = sanitizeSettings(
      { autoRotate: false, clouds: 'yes', quality: 'ultra', exposure: 1.5, sunIntensity: 'bright' },
      base,
    );
    expect(out.autoRotate).toBe(false);
    expect(out.clouds).toBe(base.clouds);
    expect(out.quality).toBe('high');
    expect(out.exposure).toBe(1.5);
    expect(out.sunIntensity).toBe(base.sunIntensity);
  });

  it('clamps numbers into their slider range and ignores NaN', () => {
    const out = sanitizeSettings({ exposure: 99, ambientIntensity: -3, sunAzimuth: Number.NaN }, base);
    expect(out.exposure).toBe(2.5);
    expect(out.ambientIntensity).toBe(0);
    expect(out.sunAzimuth).toBe(base.sunAzimuth);
  });
});

describe('matchingPreset', () => {
  it('recognises each preset and reports custom values as null', () => {
    for (const [name, preset] of Object.entries(LIGHTING_PRESETS)) {
      expect(matchingPreset({ ...base, ...preset.values })).toBe(name);
    }
    expect(matchingPreset({ ...base, exposure: 1.77 })).toBeNull();
  });
});
