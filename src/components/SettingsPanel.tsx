import { useId, useState, type ReactNode } from 'react';
import { LIGHTING_PRESETS, RANGES, matchingPreset } from '../settings';
import type { GlobeSettings, LightingPreset, TextureQuality } from '../types';

interface SettingsPanelProps {
  settings: GlobeSettings;
  onChange: (patch: Partial<GlobeSettings>) => void;
  onPreset: (preset: LightingPreset) => void;
  onReset: () => void;
}

/** Display controls: spin, clouds, texture quality, and lighting/brightness. */
export function SettingsPanel({ settings, onChange, onPreset, onReset }: SettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const activePreset = matchingPreset(settings);

  return (
    <div className="settings">
      <div className="settings__bar">
        <button
          type="button"
          className="settings__toggle"
          aria-pressed={settings.autoRotate}
          onClick={() => onChange({ autoRotate: !settings.autoRotate })}
          title={settings.autoRotate ? 'Stop spinning' : 'Start spinning'}
        >
          {settings.autoRotate ? <PauseIcon /> : <PlayIcon />}
          <span>Spin</span>
        </button>
        <button
          type="button"
          className="settings__toggle"
          aria-pressed={settings.clouds}
          onClick={() => onChange({ clouds: !settings.clouds })}
          title={settings.clouds ? 'Hide clouds' : 'Show clouds'}
        >
          <CloudIcon off={!settings.clouds} />
          <span>Clouds</span>
        </button>
        <button
          type="button"
          className="settings__toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          title="Lighting & display settings"
        >
          <GearIcon />
          <span>Display</span>
        </button>
      </div>

      {open && (
        <div id={panelId} className="settings__panel" role="region" aria-label="Display settings">
          <Section title="Globe">
            <Switch label="Spin" checked={settings.autoRotate} onChange={(v) => onChange({ autoRotate: v })} />
            <Switch label="Clouds" checked={settings.clouds} onChange={(v) => onChange({ clouds: v })} />
            <Switch
              label="City lights at night"
              checked={settings.nightLights}
              onChange={(v) => onChange({ nightLights: v })}
            />
            <div className="settings__row">
              <span>Texture quality</span>
              <Segmented<TextureQuality>
                value={settings.quality}
                options={[
                  ['standard', '2K'],
                  ['high', '4K'],
                ]}
                onChange={(quality) => onChange({ quality })}
              />
            </div>
          </Section>

          <Section title="Lighting">
            <div className="settings__presets" role="group" aria-label="Lighting presets">
              {(Object.keys(LIGHTING_PRESETS) as LightingPreset[]).map((name) => (
                <button
                  key={name}
                  type="button"
                  className="chip"
                  aria-pressed={activePreset === name}
                  title={LIGHTING_PRESETS[name].description}
                  onClick={() => onPreset(name)}
                >
                  {LIGHTING_PRESETS[name].label}
                </button>
              ))}
            </div>
            <p className="settings__note">
              {activePreset ? LIGHTING_PRESETS[activePreset].description : 'Custom lighting'}
            </p>

            <Slider
              label="Brightness"
              value={settings.exposure}
              {...RANGES.exposure}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(exposure) => onChange({ exposure })}
            />
            <Slider
              label="Sunlight"
              value={settings.sunIntensity}
              {...RANGES.sunIntensity}
              format={(v) => v.toFixed(1)}
              onChange={(sunIntensity) => onChange({ sunIntensity })}
            />
            <Slider
              label="Night-side fill"
              value={settings.ambientIntensity}
              {...RANGES.ambientIntensity}
              format={(v) => v.toFixed(2)}
              onChange={(ambientIntensity) => onChange({ ambientIntensity })}
            />
            <Switch
              label="Light where I'm looking"
              checked={settings.sunFollowsCamera}
              onChange={(v) => onChange({ sunFollowsCamera: v })}
            />
            <Slider
              label="Sun direction"
              value={settings.sunAzimuth}
              {...RANGES.sunAzimuth}
              format={(v) => `${Math.round(v)}°`}
              disabled={settings.sunFollowsCamera}
              onChange={(sunAzimuth) => onChange({ sunAzimuth })}
            />
          </Section>

          <button type="button" className="settings__reset" onClick={onReset}>
            Reset to defaults
          </button>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="settings__section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="settings__row switch">
      <span>{label}</span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch__track" aria-hidden="true" />
    </label>
  );
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  format: (v: number) => string;
  onChange: (v: number) => void;
}

function Slider({ label, value, min, max, step, disabled, format, onChange }: SliderProps) {
  const id = useId();
  return (
    <div className={`slider${disabled ? ' slider--disabled' : ''}`}>
      <label htmlFor={id} className="slider__label">
        <span>{label}</span>
        <output htmlFor={id}>{format(value)}</output>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<[T, string]>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map(([v, label]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

const iconProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

function PauseIcon() {
  return (
    <svg {...iconProps}>
      <path d="M9 5v14M15 5v14" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg {...iconProps}>
      <path d="M7 4.5v15l12-7.5z" />
    </svg>
  );
}

function CloudIcon({ off }: { off: boolean }) {
  return (
    <svg {...iconProps}>
      <path d="M17.5 19H8a5 5 0 1 1 1.6-9.74A6 6 0 0 1 21 11.5 3.75 3.75 0 0 1 17.5 19z" />
      {off && <path d="M3 3l18 18" />}
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
