import { useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh, Texture, WebGLProgramParametersWithUniforms } from 'three';
import { CLOUD_DRIFT_SPEED, GLOBE_RADIUS, LAYER_ALTITUDE } from '../config';

/**
 * Clouds come from the BLUE channel of the packed bump/roughness/clouds texture.
 * three's alphaMap reads green, so swap the channel, and use a smoothstep to cut
 * the faint haze in cloud-free areas so the ground underneath stays crisp.
 */
function patchBlueChannelAlpha(shader: WebGLProgramParametersWithUniforms) {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <alphamap_fragment>',
    /* glsl */ `
    #ifdef USE_ALPHAMAP
      diffuseColor.a *= smoothstep(0.12, 0.85, texture2D(alphaMap, vAlphaMapUv).b);
    #endif`,
  );
}

interface CloudsProps {
  /** The packed texture (B channel = cloud cover). */
  texture: Texture;
  /** Shared with the Earth: clouds stop drifting when the spin is stopped. */
  spinFactorRef?: RefObject<number>;
  opacity?: number;
}

/**
 * Transparent cloud shell slightly above the surface.
 * It lives inside the Earth's spin group, so it already turns with the planet;
 * the extra drift below makes it rotate a little faster than the ground.
 */
export function Clouds({ texture, spinFactorRef, opacity = 0.95 }: CloudsProps) {
  const ref = useRef<Mesh>(null);

  useFrame((_, delta) => {
    const factor = spinFactorRef?.current ?? 1;
    if (ref.current) ref.current.rotation.y += CLOUD_DRIFT_SPEED * factor * Math.min(delta, 0.1);
  });

  return (
    // renderOrder + depthWrite=false: clouds never hide overlays/markers drawn after them.
    <mesh ref={ref} scale={GLOBE_RADIUS * LAYER_ALTITUDE.clouds} renderOrder={1}>
      <sphereGeometry args={[1, 128, 64]} />
      <meshStandardMaterial
        color="#ffffff"
        alphaMap={texture}
        roughness={1}
        metalness={0}
        transparent
        opacity={opacity}
        depthWrite={false}
        onBeforeCompile={patchBlueChannelAlpha}
      />
    </mesh>
  );
}
