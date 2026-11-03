import { RISK_COLORS } from '../config';
import type { RiskLevel } from '../types';

const ITEMS: Array<[RiskLevel, string]> = [
  ['safe', 'Safe'],
  ['moderate', 'Moderate'],
  ['critical', 'Critical'],
];

export function RiskLegend() {
  return (
    <ul className="legend" aria-label="Risk legend">
      {ITEMS.map(([level, label]) => (
        <li key={level}>
          <span className="legend__swatch" style={{ background: RISK_COLORS[level] }} />
          {label}
        </li>
      ))}
    </ul>
  );
}
