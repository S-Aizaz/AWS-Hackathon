import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BackSide, Color, FrontSide, type ShaderMaterial, type Vector3 } from 'three';
import { GLOBE_RADIUS } from '../config';

const HALO_SCALE = 1.15; // outer glow extends 15% beyond the surface
const RIM_SCALE = 1.02; // thin bright rim hugging the planet's edge
const HALO_INTENSITY = 0.9;
const RIM_INTENSITY = 1.4;

const vertexShader = /* glsl */ `
  varying vec3 vViewNormal;
  varying vec3 vViewPos;
  varying vec3 vWorldNormal;
  void main() {
    vViewNormal = normalize(normalMatrix * normal);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

/** Shared: dim the glow on the night side so the terminator reads clearly. */
const dayFactor = /* glsl */ `
  uniform vec3 uSunDir;
  float dayFactor(vec3 worldNormal) {
    float d = dot(normalize(worldNormal), uSunDir);
    return mix(0.12, 1.0, smoothstep(-0.35, 0.5, d));
  }
`;

/**
 * Outer halo, drawn on the BACK faces of a larger sphere. For a back face,
 * -dot(normal, viewDir) is 0 at the halo's outer silhouette and rises toward
 * the planet's limb (to uLimb). Normalising by uLimb gives a 0 → 1 falloff.
 */
const haloFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uLimb;
  varying vec3 vViewNormal;
  varying vec3 vViewPos;
  varying vec3 vWorldNormal;
  ${dayFactor}
  void main() {
    vec3 viewDir = normalize(-vViewPos);
    float d = clamp(-dot(normalize(vViewNormal), viewDir) / uLimb, 0.0, 1.0);
    float glow = pow(d, 2.5) * dayFactor(vWorldNormal) * uIntensity;
    gl_FragColor = vec4(uColor, glow);
    #include <colorspace_fragment>
  }
`;

/**
 * Inner rim: fresnel on the front faces, strongest where the surface turns away.
 * The smoothstep fades it back to 0 at the exact silhouette so it blends into
 * the halo instead of ending in a hard bright line.
 */
const rimFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec3 vViewNormal;
  varying vec3 vViewPos;
  varying vec3 vWorldNormal;
  ${dayFactor}
  void main() {
    vec3 viewDir = normalize(-vViewPos);
    float ndv = clamp(dot(normalize(vViewNormal), viewDir), 0.0, 1.0);
    float fresnel = pow(1.0 - ndv, 3.0) * smoothstep(0.0, 0.35, ndv);
    gl_FragColor = vec4(uColor, fresnel * dayFactor(vWorldNormal) * uIntensity);
    #include <colorspace_fragment>
  }
`;

interface AtmosphereProps {
  /** World-space unit vector toward the sun (shared, mutated each frame by the scene). */
  sunDirection: Vector3;
  color?: string;
  intensity?: number;
}

export function Atmosphere({ sunDirection, color = '#4da6ff', intensity = 1 }: AtmosphereProps) {
  const haloRef = useRef<ShaderMaterial>(null);
  const rimRef = useRef<ShaderMaterial>(null);

  // Initial values only. R3F copies these into the material's OWN uniforms object,
  // so later changes must be written to `material.uniforms` (via the refs below).
  const haloUniforms = useMemo(
    () => ({
      uColor: { value: new Color(color) },
      uIntensity: { value: HALO_INTENSITY * intensity },
      uSunDir: { value: sunDirection.clone() },
      uLimb: { value: Math.sqrt(1 - 1 / (HALO_SCALE * HALO_SCALE)) },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial values; updates go through refs
    [],
  );
  const rimUniforms = useMemo(
    () => ({
      uColor: { value: new Color(color) },
      uIntensity: { value: RIM_INTENSITY * intensity },
      uSunDir: { value: sunDirection.clone() },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial values; updates go through refs
    [],
  );

  useLayoutEffect(() => {
    for (const [mat, k] of [
      [haloRef.current, HALO_INTENSITY],
      [rimRef.current, RIM_INTENSITY],
    ] as const) {
      if (!mat) continue;
      mat.uniforms.uColor.value.set(color);
      mat.uniforms.uIntensity.value = k * intensity;
    }
  }, [color, intensity]);

  // The sun can move every frame (slider, or following the camera).
  useFrame(() => {
    haloRef.current?.uniforms.uSunDir.value.copy(sunDirection);
    rimRef.current?.uniforms.uSunDir.value.copy(sunDirection);
  });

  return (
    <>
      <mesh scale={GLOBE_RADIUS * HALO_SCALE} renderOrder={4}>
        <sphereGeometry args={[1, 64, 32]} />
        <shaderMaterial
          ref={haloRef}
          vertexShader={vertexShader}
          fragmentShader={haloFragment}
          uniforms={haloUniforms}
          side={BackSide}
          blending={AdditiveBlending}
          transparent
          depthWrite={false}
        />
      </mesh>
      <mesh scale={GLOBE_RADIUS * RIM_SCALE} renderOrder={4}>
        <sphereGeometry args={[1, 64, 32]} />
        <shaderMaterial
          ref={rimRef}
          vertexShader={vertexShader}
          fragmentShader={rimFragment}
          uniforms={rimUniforms}
          side={FrontSide}
          blending={AdditiveBlending}
          transparent
          depthWrite={false}
        />
      </mesh>
    </>
  );
}
