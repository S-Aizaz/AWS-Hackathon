import { Vector3, type Object3D } from 'three';
import { EARTH_RADIUS_KM } from '../config';
import type { LatLng } from '../types';

/*
 * Coordinate convention
 * ---------------------
 * These formulas match the UV layout of three.js `SphereGeometry`, so an
 * equirectangular texture (u = 0 at 180°W, u = 0.5 at the prime meridian,
 * v = 1 at the North Pole) lands exactly where the math says it should.
 *
 * In the globe's LOCAL frame (before tilt or spin is applied):
 *   +Y  → North Pole                      (lat = +90)
 *   +X  → lat 0, lng 0   (Gulf of Guinea)
 *   -Z  → lat 0, lng 90°E (Indian Ocean)
 *   +Z  → lat 0, lng 90°W (Galápagos)
 *
 *   x =  r · cos(lat) · cos(lng)
 *   y =  r · sin(lat)
 *   z = -r · cos(lat) · sin(lng)   ← minus sign: east is toward -Z
 *
 * Inverse:
 *   lat = asin(y / |p|)
 *   lng = atan2(-z, x)
 */

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/** Wrap any longitude into [-180, 180). */
export function normalizeLng(lng: number): number {
  const wrapped = (((lng + 180) % 360) + 360) % 360 - 180;
  // Avoid returning -0, which is surprising in UIs and test output.
  return wrapped === 0 ? 0 : wrapped;
}

/** Latitude/longitude (degrees) → point on a sphere of `radius` in the globe's local frame. */
export function latLngToVector3(lat: number, lng: number, radius = 1, target = new Vector3()): Vector3 {
  const phi = lat * DEG2RAD;
  const lambda = lng * DEG2RAD;
  const cosPhi = Math.cos(phi);
  return target.set(
    radius * cosPhi * Math.cos(lambda),
    radius * Math.sin(phi),
    -radius * cosPhi * Math.sin(lambda),
  );
}

/**
 * Point in the globe's local frame → latitude/longitude (degrees).
 * The point doesn't need to be exactly on the surface; only its direction matters.
 */
export function vector3ToLatLng(point: Vector3): LatLng {
  const r = point.length();
  if (r === 0) return { lat: 0, lng: 0 };
  // Clamp guards against |y/r| drifting a hair past 1 from float error.
  const lat = Math.asin(Math.min(1, Math.max(-1, point.y / r))) * RAD2DEG;
  // At the poles longitude is undefined; atan2(0, 0) returns 0, which is fine.
  const lng = normalizeLng(Math.atan2(-point.z, point.x) * RAD2DEG);
  return { lat, lng };
}

/**
 * Rotation compensation: convert a WORLD-space point (e.g. a raycast hit) to
 * lat/lng on a globe that may be tilted, spinning, scaled or moved.
 *
 * `globe` is the object whose local frame follows the convention above (the
 * Earth mesh). `worldToLocal` applies the inverse of its full world matrix, which
 * undoes the axial tilt and the current spin angle in one step. That's why the
 * same screen pixel gives different coordinates as the Earth turns underneath it.
 */
export function worldPointToLatLng(worldPoint: Vector3, globe: Object3D): LatLng {
  globe.updateWorldMatrix(true, false);
  const local = globe.worldToLocal(worldPoint.clone());
  return vector3ToLatLng(local);
}

/** Great-circle distance in km (haversine). */
export function greatCircleDistanceKm(a: LatLng, b: LatLng, earthRadiusKm = EARTH_RADIUS_KM): number {
  const dLat = (b.lat - a.lat) * DEG2RAD;
  const dLng = (b.lng - a.lng) * DEG2RAD;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * DEG2RAD) * Math.cos(b.lat * DEG2RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Surface distance in km → angle (radians) subtended at the Earth's centre. */
export function kmToAngularRadius(km: number, earthRadiusKm = EARTH_RADIUS_KM): number {
  return Math.min(Math.PI, Math.max(0, km / earthRadiusKm));
}

/** "40.71° N, 74.01° W" */
export function formatLatLng({ lat, lng }: LatLng, digits = 2): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(digits)}° ${ns}, ${Math.abs(lng).toFixed(digits)}° ${ew}`;
}
