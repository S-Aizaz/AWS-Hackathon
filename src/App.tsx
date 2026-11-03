import { Suspense, useCallback, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Loader } from '@react-three/drei';
import { CanvasErrorBoundary } from './components/CanvasErrorBoundary';
import { InfoPanel } from './components/InfoPanel';
import { RiskLegend } from './components/RiskLegend';
import { Scene } from './components/Scene';
import { SettingsPanel } from './components/SettingsPanel';
import { CAMERA } from './config';
import { SAMPLE_RISK_ZONES } from './data/sampleZones';
import { useGlobeSettings } from './hooks/useGlobeSettings';
import { getLocationInfo } from './services/locationService';
import type { LatLng, LocationInfo, RiskZone } from './types';

export default function App() {
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [loading, setLoading] = useState(false);
  // Swap SAMPLE_RISK_ZONES for fetched data later; RiskOverlay only needs RiskZone[].
  const [zones] = useState<RiskZone[]>(SAMPLE_RISK_ZONES);
  const requestRef = useRef<AbortController | null>(null);
  const { settings, update, applyPreset, reset } = useGlobeSettings();

  const handleLocationSelect = useCallback(async ({ lat, lng }: LatLng) => {
    // Cancel a still-running lookup for a previous click.
    requestRef.current?.abort();
    const request = new AbortController();
    requestRef.current = request;

    setLocation({ lat, lng }); // show coordinates + marker immediately
    setLoading(true);
    try {
      const info = await getLocationInfo(lat, lng, { signal: request.signal });
      if (!request.signal.aborted) setLocation(info);
    } catch (err) {
      if (!request.signal.aborted) console.error('getLocationInfo failed', err);
    } finally {
      if (requestRef.current === request) setLoading(false);
    }
  }, []);

  const handleClear = useCallback(() => {
    requestRef.current?.abort();
    setLocation(null);
    setLoading(false);
  }, []);

  return (
    <div className="app">
      <CanvasErrorBoundary>
        <Canvas
          className="globe-canvas"
          dpr={[1, 2]} // cap pixel ratio at 2: retina-sharp, but no 3× cost on phones
          camera={{ fov: CAMERA.fov, position: [0, 0, CAMERA.initialDistance], near: 0.1, far: 1000 }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
        >
          <color attach="background" args={['#000005']} />
          <Suspense fallback={null}>
            <Scene selected={location} zones={zones} settings={settings} onLocationSelect={handleLocationSelect} />
          </Suspense>
        </Canvas>
      </CanvasErrorBoundary>
      <Loader />

      <InfoPanel location={location} loading={loading} onClear={handleClear} />
      <SettingsPanel settings={settings} onChange={update} onPreset={applyPreset} onReset={reset} />
      <RiskLegend />
      <p className="hint">Drag to rotate · Scroll or pinch to zoom · Click to select</p>
    </div>
  );
}
