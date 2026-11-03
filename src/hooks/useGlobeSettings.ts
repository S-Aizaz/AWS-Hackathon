import { useCallback, useEffect, useState } from 'react';
import { LIGHTING_PRESETS, defaultSettings, sanitizeSettings } from '../settings';
import type { GlobeSettings, LightingPreset } from '../types';

const STORAGE_KEY = 'earth-explorer:settings:v1';

function load(): GlobeSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeSettings(JSON.parse(raw)) : defaultSettings();
  } catch {
    return defaultSettings(); // storage blocked or corrupt JSON
  }
}

/** Display settings, remembered per browser. */
export function useGlobeSettings() {
  const [settings, setSettings] = useState<GlobeSettings>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* private mode / storage full: settings just won't persist */
    }
  }, [settings]);

  const update = useCallback((patch: Partial<GlobeSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const applyPreset = useCallback((preset: LightingPreset) => {
    setSettings((prev) => ({ ...prev, ...LIGHTING_PRESETS[preset].values }));
  }, []);

  const reset = useCallback(() => setSettings(defaultSettings()), []);

  return { settings, update, applyPreset, reset };
}
