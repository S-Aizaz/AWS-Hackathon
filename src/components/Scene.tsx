import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, type ComponentRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { Vector3, type DirectionalLight } from 'three';
import { CAMERA, GLOBE_RADIUS, SUN_DISTANCE, SUN_ELEVATION_DEG } from '../config';
import { useIdleAutoRotate } from '../hooks/useIdleAutoRotate';
import type { GlobeSettings, LatLng, RiskZone } from '../types';
import { Globe } from './Globe';
import { LocationMarker } from './LocationMarker';
import { RiskOverlay } from './RiskOverlay';

/** Camera distance at which the globe (plus its glow) fits both the width and height of the view. */
function fitDistance(aspect: number): number {
  const visibleRadius = GLOBE_RADIUS * 1.12;
  const halfV = (CAMERA.fov * Math.PI) / 360;
  const halfH = Math.atan(Math.tan(halfV) * aspect);
  return visibleRadius / Math.sin(Math.min(halfV, halfH));
}

const DEG2RAD = Math.PI / 180;
const _right = new Vector3();
const _up = new Vector3();

interface SceneProps {
  selected: LatLng | null;
  zones: RiskZone[];
  settings: GlobeSettings;
  onLocationSelect: (coords: LatLng) => void;
}

/** Everything inside the <Canvas>: lights, background, controls and the globe with its overlays. */
export function Scene({ selected, zones, settings, onLocationSelect }: SceneProps) {
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);
  const sunRef = useRef<DirectionalLight>(null);
  const { factorRef, onStart, onEnd } = useIdleAutoRotate(settings.autoRotate);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const aspect = useThree((s) => s.size.width / s.size.height);

  // While new-quality textures load, keep showing the old globe instead of a blank canvas.
  const quality = useDeferredValue(settings.quality);

  /** Single source of truth for where the sun is (world-space unit vector). Shaders hold it by reference. */
  const sunDirection = useMemo(() => new Vector3(1, 0, 0), []);

  // On first load, back the camera off on narrow (portrait/phone) screens so the
  // whole globe is visible. Runs once: after that, zoom belongs to the user.
  const fittedRef = useRef(false);
  useLayoutEffect(() => {
    if (fittedRef.current || !Number.isFinite(aspect) || aspect <= 0) return;
    fittedRef.current = true;
    const distance = Math.min(CAMERA.maxDistance, Math.max(CAMERA.initialDistance, fitDistance(aspect)));
    camera.position.setLength(distance);
  }, [camera, aspect]);

  // Overall brightness.
  useEffect(() => {
    gl.toneMappingExposure = settings.exposure;
  }, [gl, settings.exposure]);

  useFrame(({ camera: cam }) => {
    // Sun position: either fixed in the sky (azimuth slider), or just behind the
    // viewer's shoulder (up and to the right) so whatever you look at is lit.
    if (settings.sunFollowsCamera) {
      cam.matrixWorld.extractBasis(_right, _up, sunDirection); // 3rd basis = camera backward = toward viewer
      sunDirection.addScaledVector(_right, 0.55).addScaledVector(_up, 0.35).normalize();
    } else {
      const az = settings.sunAzimuth * DEG2RAD;
      const el = SUN_ELEVATION_DEG * DEG2RAD;
      sunDirection.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    }
    sunRef.current?.position.copy(sunDirection).multiplyScalar(SUN_DISTANCE);

    // Rotate more slowly when zoomed in, so dragging feels consistent at every distance.
    const controls = controlsRef.current;
    if (controls) {
      const t = (cam.position.length() - CAMERA.minDistance) / (CAMERA.maxDistance - CAMERA.minDistance);
      controls.rotateSpeed = 0.1 + 0.5 * Math.min(1, Math.max(0, t));
    }
  });

  return (
    <>
      <ambientLight intensity={settings.ambientIntensity} />
      <directionalLight ref={sunRef} intensity={settings.sunIntensity} />
      <Stars radius={300} depth={60} count={6000} factor={6} saturation={0} fade speed={0.3} />

      <Globe
        onLocationSelect={onLocationSelect}
        spinFactorRef={factorRef}
        quality={quality}
        showClouds={settings.clouds}
        nightLights={settings.nightLights}
        sunDirection={sunDirection}
      >
        <RiskOverlay zones={zones} />
        {selected && <LocationMarker lat={selected.lat} lng={selected.lng} />}
      </Globe>

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        zoomSpeed={0.6}
        minDistance={CAMERA.minDistance}
        maxDistance={CAMERA.maxDistance}
        onStart={onStart}
        onEnd={onEnd}
      />
    </>
  );
}
