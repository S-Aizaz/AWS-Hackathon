import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Quaternion, Vector3, type ShaderMaterial } from 'three';
import { GLOBE_RADIUS, LAYER_ALTITUDE, RISK_COLORS } from '../config';
import type { RiskZone } from '../types';
import { kmToAngularRadius, latLngToVector3 } from '../utils/geo';

const Y_AXIS = new Vector3(0, 1, 0);

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// For a SphereGeometry cap starting at the pole, uv.y runs 1 (cap centre) → 0 (cap edge).
const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uPulse;
  varying vec2 vUv;
  void main() {
    float t = 1.0 - vUv.y;                                   // 0 centre → 1 edge (linear in angle)
    float fill = 0.2 + 0.12 * t;                             // slightly denser toward the edge
    float rim = smoothstep(0.8, 0.95, t) * (1.0 - smoothstep(0.95, 1.0, t));
    float pulse = 1.0 + uPulse * 0.35 * sin(uTime * 3.0);    // critical zones breathe
    float alpha = (fill + rim * 0.7) * pulse;
    alpha *= 1.0 - smoothstep(0.985, 1.0, t);                // feather the outer edge
    gl_FragColor = vec4(uColor, clamp(alpha, 0.0, 1.0));
    #include <colorspace_fragment>
  }
`;

interface RiskOverlayProps {
  zones: RiskZone[];
}

/**
 * Coloured, semi-transparent patches on the globe surface.
 * Render inside <Globe> so the patches spin with the Earth.
 * Data-agnostic: pass any RiskZone[] (sample data now, API results later).
 */
export function RiskOverlay({ zones }: RiskOverlayProps) {
  return (
    <group>
      {zones.map((zone) => (
        <RiskZonePatch key={zone.id} zone={zone} />
      ))}
    </group>
  );
}

/**
 * One zone = a spherical cap: a slice of a sphere from the pole down to the
 * zone's angular radius. It's built around +Y, then rotated so +Y points at the
 * zone's centre. This gives a true geodesic circle that hugs the curvature at any
 * size, unlike a flat disc.
 */
function RiskZonePatch({ zone }: { zone: RiskZone }) {
  const angularRadius = kmToAngularRadius(zone.radiusKm);
  const radius = GLOBE_RADIUS * LAYER_ALTITUDE.riskOverlay;

  const quaternion = useMemo(
    () => new Quaternion().setFromUnitVectors(Y_AXIS, latLngToVector3(zone.lat, zone.lng, 1)),
    [zone.lat, zone.lng],
  );

  const materialRef = useRef<ShaderMaterial>(null);

  // Initial values only. R3F copies these into the material's OWN uniforms object,
  // so later changes must be written to `material.uniforms` (via the ref).
  const uniforms = useMemo(
    () => ({
      uColor: { value: new Color(RISK_COLORS[zone.risk]) },
      uTime: { value: 0 },
      uPulse: { value: zone.risk === 'critical' ? 1 : 0 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial values; updates go through the ref
    [],
  );

  useLayoutEffect(() => {
    const mat = materialRef.current;
    if (!mat) return;
    mat.uniforms.uColor.value.set(RISK_COLORS[zone.risk]);
    mat.uniforms.uPulse.value = zone.risk === 'critical' ? 1 : 0;
  }, [zone.risk]);

  useFrame(({ clock }) => {
    if (materialRef.current) materialRef.current.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <mesh quaternion={quaternion} renderOrder={2} name={`risk-zone-${zone.id}`}>
      <sphereGeometry args={[radius, 64, 16, 0, Math.PI * 2, 0, angularRadius]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
