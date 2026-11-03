import type { RiskZone } from '../types';

/**
 * Hard-coded demo zones so the overlay is visible during development.
 * Replace with real data (e.g. from a service that returns RiskZone[]).
 */
export const SAMPLE_RISK_ZONES: RiskZone[] = [
  { id: 'gulf-storm', lat: 25.5, lng: -89.5, radiusKm: 650, risk: 'critical', label: 'Sample: tropical storm' },
  { id: 'bay-of-bengal', lat: 16, lng: 88.5, radiusKm: 500, risk: 'critical', label: 'Sample: cyclone watch' },
  { id: 'sahel-heat', lat: 15, lng: 2, radiusKm: 900, risk: 'moderate', label: 'Sample: heat advisory' },
  { id: 'scandinavia', lat: 62, lng: 15, radiusKm: 700, risk: 'safe', label: 'Sample: calm conditions' },
];
