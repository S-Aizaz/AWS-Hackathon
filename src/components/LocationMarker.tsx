import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Quaternion, Vector3, type Mesh, type MeshBasicMaterial } from 'three';
import { GLOBE_RADIUS, LAYER_ALTITUDE } from '../config';
import { latLngToVector3 } from '../utils/geo';

const Z_AXIS = new Vector3(0, 0, 1);
const PULSE_PERIOD_S = 1.6;
const PULSE_MAX_SCALE = 3;

interface LocationMarkerProps {
  lat: number;
  lng: number;
  color?: string;
  /** Radius of the centre dot, in scene units (globe radius = 1). */
  size?: number;
}

/**
 * A dot with two expanding rings, lying flat on the surface.
 * Must be rendered inside <Globe> so it inherits the Earth's tilt and spin.
 */
export function LocationMarker({ lat, lng, color = '#38bdf8', size = 0.014 }: LocationMarkerProps) {
  const rings = [useRef<Mesh>(null), useRef<Mesh>(null)];

  const { position, quaternion } = useMemo(() => {
    const up = latLngToVector3(lat, lng, 1); // surface normal at this point
    return {
      position: up.clone().multiplyScalar(GLOBE_RADIUS * LAYER_ALTITUDE.marker),
      // Circle/ring geometries face +Z; rotate +Z onto the surface normal.
      quaternion: new Quaternion().setFromUnitVectors(Z_AXIS, up),
    };
  }, [lat, lng]);

  useFrame(({ clock }) => {
    rings.forEach((ref, i) => {
      const ring = ref.current;
      if (!ring) return;
      const phase = (clock.elapsedTime / PULSE_PERIOD_S + i / rings.length) % 1;
      ring.scale.setScalar(1 + phase * (PULSE_MAX_SCALE - 1));
      (ring.material as MeshBasicMaterial).opacity = 0.9 * (1 - phase) ** 1.5;
    });
  });

  return (
    <group position={position} quaternion={quaternion}>
      <mesh renderOrder={3}>
        <circleGeometry args={[size, 32]} />
        <meshBasicMaterial color={color} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {rings.map((ref, i) => (
        <mesh key={i} ref={ref} renderOrder={3}>
          <ringGeometry args={[size * 1.2, size * 1.6, 48]} />
          <meshBasicMaterial color={color} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
