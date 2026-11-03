import { useCallback, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { Color, LinearSRGBColorSpace, SRGBColorSpace, type Group, type Mesh, type Vector3, type WebGLProgramParametersWithUniforms } from 'three';
import {
  AXIAL_TILT,
  DRAG_THRESHOLD_PX,
  GLOBE_RADIUS,
  GLOBE_SEGMENTS,
  ROTATION_SPEED,
  TEXTURE_SETS,
} from '../config';
import type { LatLng, TextureQuality } from '../types';
import { worldPointToLatLng } from '../utils/geo';
import { Atmosphere } from './Atmosphere';
import { Clouds } from './Clouds';

/** Ocean vs land roughness. Low ocean roughness = visible sun glint on the water. */
const OCEAN_ROUGHNESS = 0.32;
const LAND_ROUGHNESS = 0.92;
const CITY_LIGHTS_COLOR = new Color('#ffcf8a');
const CITY_LIGHTS_INTENSITY = 1.8;
const BUMP_SCALE = 3;

interface GlobeProps {
  /** Fired with the clicked coordinate (drags are ignored). */
  onLocationSelect?: (coords: LatLng) => void;
  /** 0 = stopped, 1 = full speed. Owned by the interaction layer (see useIdleAutoRotate). */
  spinFactorRef?: RefObject<number>;
  quality: TextureQuality;
  showClouds: boolean;
  nightLights: boolean;
  /** World-space unit vector toward the sun. Mutated by the scene each frame; read by shaders. */
  sunDirection: Vector3;
  /**
   * Surface-attached content (markers, risk overlays, …). Rendered inside the
   * spinning frame, so anything placed with latLngToVector3() stays glued to the
   * ground as the Earth turns, with no per-frame bookkeeping.
   */
  children?: ReactNode;
}

/**
 * Scene graph:
 *
 *   tilt group   (rotation.z = 23.4°: fixed, tilts the spin axis)
 *   ├─ spin group (rotation.y += speed·dt: Earth's daily rotation)
 *   │   ├─ Earth mesh   ← raycast target; its local frame IS the lat/lng frame
 *   │   ├─ Clouds       (extra drift on top of the spin)
 *   │   └─ children     (markers, overlays)
 *   └─ Atmosphere       (rotationally symmetric, so it doesn't need to spin)
 */
export function Globe({
  onLocationSelect,
  spinFactorRef,
  quality,
  showClouds,
  nightLights,
  sunDirection,
  children,
}: GlobeProps) {
  const spinRef = useRef<Group>(null);
  const earthRef = useRef<Mesh>(null);
  const maxAnisotropy = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  const urls = TEXTURE_SETS[quality];

  const { day, night, packed } = useTexture({
    day: urls.day,
    night: urls.night,
    packed: urls.bumpRoughnessClouds,
  });

  useLayoutEffect(() => {
    // Colour maps are sRGB; the packed bump/roughness/clouds map is data and must stay linear.
    day.colorSpace = SRGBColorSpace;
    night.colorSpace = SRGBColorSpace;
    packed.colorSpace = LinearSRGBColorSpace;
    const anisotropy = Math.min(16, maxAnisotropy); // crisp texture at grazing angles near the limb
    for (const tex of [day, night, packed]) {
      tex.anisotropy = anisotropy;
      tex.needsUpdate = true;
    }
  }, [day, night, packed, maxAnisotropy]);

  /**
   * Patch MeshStandardMaterial's shader:
   *  - roughness: remap the land mask (G) to ocean/land roughness instead of 0..1,
   *  - emissive (city lights): only on the night side, fading across the terminator.
   * `sunDirection` is passed by reference, so the uniform follows the sun automatically.
   */
  const onBeforeCompile = useCallback(
    (shader: WebGLProgramParametersWithUniforms) => {
      shader.uniforms.uSunDir = { value: sunDirection };
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uSunDir;')
        .replace(
          '#include <roughnessmap_fragment>',
          /* glsl */ `
          float roughnessFactor = roughness;
          #ifdef USE_ROUGHNESSMAP
            float landMask = texture2D(roughnessMap, vRoughnessMapUv).g;
            roughnessFactor *= mix(${OCEAN_ROUGHNESS.toFixed(3)}, ${LAND_ROUGHNESS.toFixed(3)}, landMask);
          #endif`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          /* glsl */ `
          #ifdef USE_EMISSIVEMAP
            vec4 emissiveColor = texture2D(emissiveMap, vEmissiveMapUv);
            vec3 sunView = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
            float sunDot = dot(normalize(vNormal), sunView);
            float nightSide = 1.0 - smoothstep(-0.2, 0.1, sunDot);
            totalEmissiveRadiance *= emissiveColor.rgb * nightSide;
          #endif`,
        );
    },
    [sunDirection],
  );

  useFrame((_, delta) => {
    const spin = spinRef.current;
    if (!spin) return;
    const factor = spinFactorRef?.current ?? 1;
    // Clamp delta so returning to a background tab doesn't jump the globe.
    spin.rotation.y += ROTATION_SPEED * factor * Math.min(delta, 0.1);
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    // R3F reports how far (px) the pointer moved between down and up.
    // Anything beyond a few pixels was a drag to rotate, not a selection.
    if (e.delta > DRAG_THRESHOLD_PX || !earthRef.current) return;
    e.stopPropagation();
    // e.point is the raycast hit in WORLD space. worldPointToLatLng undoes the
    // tilt + current spin (the mesh's world matrix) before converting to lat/lng.
    onLocationSelect?.(worldPointToLatLng(e.point, earthRef.current));
  };

  const [widthSegments, heightSegments] = GLOBE_SEGMENTS[quality];

  return (
    <group rotation={[0, 0, AXIAL_TILT]}>
      <group ref={spinRef}>
        <mesh ref={earthRef} onClick={handleClick}>
          <sphereGeometry args={[GLOBE_RADIUS, widthSegments, heightSegments]} />
          <meshStandardMaterial
            map={day}
            bumpMap={packed} // three reads the R channel (elevation)
            bumpScale={BUMP_SCALE}
            roughnessMap={packed} // three reads the G channel (land mask), remapped above
            roughness={1}
            metalness={0}
            emissiveMap={night}
            emissive={CITY_LIGHTS_COLOR}
            emissiveIntensity={nightLights ? CITY_LIGHTS_INTENSITY : 0}
            onBeforeCompile={onBeforeCompile}
          />
        </mesh>
        {showClouds && <Clouds texture={packed} spinFactorRef={spinFactorRef} />}
        {children}
      </group>
      <Atmosphere sunDirection={sunDirection} />
    </group>
  );
}
