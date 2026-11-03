import { describe, expect, it } from 'vitest';
import { Group, Mesh, SphereGeometry, Vector3 } from 'three';
import {
  formatLatLng,
  greatCircleDistanceKm,
  kmToAngularRadius,
  latLngToVector3,
  normalizeLng,
  vector3ToLatLng,
  worldPointToLatLng,
} from './geo';

const EPS = 1e-9;

/** Smallest signed difference between two longitudes, so 179.99 vs -180 counts as close. */
const lngDiff = (a: number, b: number) => Math.abs(normalizeLng(a - b));

describe('normalizeLng', () => {
  it.each([
    [0, 0],
    [180, -180],
    [-180, -180],
    [190, -170],
    [-190, 170],
    [540, -180],
    [359, -1],
    [-720, 0],
  ])('%d → %d', (input, expected) => {
    expect(normalizeLng(input)).toBeCloseTo(expected, 9);
  });
});

describe('latLngToVector3', () => {
  it('maps cardinal points to the documented axes', () => {
    const cases: Array<[number, number, [number, number, number]]> = [
      [0, 0, [1, 0, 0]], // prime meridian / equator → +X
      [0, 90, [0, 0, -1]], // 90°E → -Z
      [0, -90, [0, 0, 1]], // 90°W → +Z
      [0, 180, [-1, 0, 0]], // antimeridian → -X
      [90, 0, [0, 1, 0]], // North Pole → +Y
      [-90, 0, [0, -1, 0]], // South Pole → -Y
    ];
    for (const [lat, lng, [x, y, z]] of cases) {
      const v = latLngToVector3(lat, lng);
      expect(v.x).toBeCloseTo(x, 9);
      expect(v.y).toBeCloseTo(y, 9);
      expect(v.z).toBeCloseTo(z, 9);
    }
  });

  it('scales by radius', () => {
    const v = latLngToVector3(37.5, -122.3, 2.5);
    expect(v.length()).toBeCloseTo(2.5, 9);
  });

  it('writes into a provided target vector', () => {
    const target = new Vector3();
    const result = latLngToVector3(10, 20, 1, target);
    expect(result).toBe(target);
  });
});

describe('vector3ToLatLng', () => {
  it('round-trips latLngToVector3 across the globe', () => {
    for (let lat = -89; lat <= 89; lat += 7.3) {
      for (let lng = -179; lng < 180; lng += 11.7) {
        for (const radius of [0.5, 1, 6371]) {
          const out = vector3ToLatLng(latLngToVector3(lat, lng, radius));
          expect(out.lat).toBeCloseTo(lat, 9);
          expect(lngDiff(out.lng, lng)).toBeLessThan(EPS);
        }
      }
    }
  });

  it('only depends on direction, not distance from the centre', () => {
    const p = latLngToVector3(-33.87, 151.21, 1);
    const a = vector3ToLatLng(p);
    const b = vector3ToLatLng(p.clone().multiplyScalar(0.97)); // e.g. hit on a slightly flat facet
    expect(b.lat).toBeCloseTo(a.lat, 9);
    expect(b.lng).toBeCloseTo(a.lng, 9);
  });

  it('handles the poles and the origin without NaN', () => {
    expect(vector3ToLatLng(new Vector3(0, 5, 0))).toEqual({ lat: 90, lng: 0 });
    expect(vector3ToLatLng(new Vector3(0, -5, 0))).toEqual({ lat: -90, lng: 0 });
    expect(vector3ToLatLng(new Vector3(0, 0, 0))).toEqual({ lat: 0, lng: 0 });
  });

  it('returns longitudes in [-180, 180)', () => {
    const { lng } = vector3ToLatLng(new Vector3(-1, 0, 0));
    expect(lng).toBe(-180);
  });

  it('agrees with three.js SphereGeometry UVs (so equirectangular textures line up)', () => {
    const geo = new SphereGeometry(1, 36, 18);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    const v = new Vector3();
    let checked = 0;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const u = uv.getX(i);
      const t = uv.getY(i);
      if (t <= 0 || t >= 1) continue; // pole vertices: longitude is undefined
      const expectedLat = t * 180 - 90;
      const expectedLng = u * 360 - 180;
      const out = vector3ToLatLng(v);
      // Geometry attributes are float32, so allow ~1e-4° of slack.
      expect(out.lat).toBeCloseTo(expectedLat, 4);
      expect(lngDiff(out.lng, expectedLng)).toBeLessThan(1e-4);
      checked++;
    }
    expect(checked).toBeGreaterThan(500);
  });
});

describe('worldPointToLatLng (rotation compensation)', () => {
  /** Mirror of the real scene graph: tilt group → spin group → earth mesh. */
  function makeGlobe(tilt: number, spin: number) {
    const tiltGroup = new Group();
    tiltGroup.rotation.z = tilt;
    const spinGroup = new Group();
    spinGroup.rotation.y = spin;
    const earth = new Mesh(new SphereGeometry(1, 8, 8));
    tiltGroup.add(spinGroup);
    spinGroup.add(earth);
    tiltGroup.updateMatrixWorld(true);
    return { tiltGroup, spinGroup, earth };
  }

  it('recovers lat/lng after tilt and arbitrary spin', () => {
    const tilt = (23.4 * Math.PI) / 180;
    for (const spin of [0, 0.7, Math.PI, 4.2, 37.1]) {
      const { earth } = makeGlobe(tilt, spin);
      for (const [lat, lng] of [
        [51.5, -0.13],
        [-33.87, 151.21],
        [35.68, 139.69],
        [0, 0],
        [-75, -100],
      ]) {
        // Where would this coordinate appear in the world right now?
        const world = earth.localToWorld(latLngToVector3(lat, lng, 1));
        const out = worldPointToLatLng(world, earth);
        expect(out.lat).toBeCloseTo(lat, 9);
        expect(lngDiff(out.lng, lng)).toBeLessThan(1e-9);
      }
    }
  });

  it('gives a different coordinate for the same world point after the globe spins', () => {
    const world = new Vector3(0, 0, 1); // the point facing a camera on +Z
    const before = worldPointToLatLng(world, makeGlobe(0, 0).earth);
    const after = worldPointToLatLng(world, makeGlobe(0, Math.PI / 2).earth);
    // +Y rotation is Earth's real (eastward, counter-clockwise from above the
    // North Pole) spin, so the meridian facing a fixed viewer moves WEST: 90°W → 180°.
    expect(before.lng).toBeCloseTo(-90, 9);
    expect(lngDiff(after.lng, 180)).toBeLessThan(1e-9);
  });

  it('accounts for globe translation and scale', () => {
    const { tiltGroup, earth } = makeGlobe(0.3, 1.1);
    tiltGroup.position.set(4, -2, 7);
    tiltGroup.scale.setScalar(3);
    tiltGroup.updateMatrixWorld(true);
    const world = earth.localToWorld(latLngToVector3(12.34, -56.78, 1));
    const out = worldPointToLatLng(world, earth);
    expect(out.lat).toBeCloseTo(12.34, 9);
    expect(out.lng).toBeCloseTo(-56.78, 9);
  });

  it('does not mutate the input point', () => {
    const { earth } = makeGlobe(0.4, 2);
    const world = new Vector3(0.3, 0.4, 0.866);
    const copy = world.clone();
    worldPointToLatLng(world, earth);
    expect(world.equals(copy)).toBe(true);
  });
});

describe('distance helpers', () => {
  it('computes London → New York ≈ 5570 km', () => {
    const d = greatCircleDistanceKm({ lat: 51.5074, lng: -0.1278 }, { lat: 40.7128, lng: -74.006 });
    expect(d).toBeGreaterThan(5550);
    expect(d).toBeLessThan(5590);
  });

  it('is zero for identical points and half the circumference for antipodes', () => {
    expect(greatCircleDistanceKm({ lat: 10, lng: 20 }, { lat: 10, lng: 20 })).toBeCloseTo(0, 9);
    expect(greatCircleDistanceKm({ lat: 0, lng: 0 }, { lat: 0, lng: 180 })).toBeCloseTo(Math.PI * 6371, 6);
  });

  it('converts km to angular radius and clamps', () => {
    expect(kmToAngularRadius(6371)).toBeCloseTo(1, 12);
    expect(kmToAngularRadius(-5)).toBe(0);
    expect(kmToAngularRadius(1e9)).toBe(Math.PI);
  });
});

describe('formatLatLng', () => {
  it('uses hemisphere letters', () => {
    expect(formatLatLng({ lat: 40.7128, lng: -74.006 })).toBe('40.71° N, 74.01° W');
    expect(formatLatLng({ lat: -33.8688, lng: 151.2093 }, 1)).toBe('33.9° S, 151.2° E');
  });
});
