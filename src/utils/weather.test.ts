import { describe, expect, it } from 'vitest';
import { compassDirection, dayLabel, describeWeatherCode, fmt, formatLocalClock, localTimeAt } from './weather';

describe('describeWeatherCode', () => {
  it('maps known WMO codes with day/night icons', () => {
    expect(describeWeatherCode(0, true)).toEqual({ label: 'Clear sky', icon: '☀️' });
    expect(describeWeatherCode(0, false)).toEqual({ label: 'Clear sky', icon: '🌙' });
    expect(describeWeatherCode(95).label).toBe('Thunderstorm');
  });

  it('falls back for unknown or missing codes', () => {
    expect(describeWeatherCode(42).label).toBe('Unknown conditions');
    expect(describeWeatherCode(null).label).toBe('Unknown conditions');
  });
});

describe('compassDirection', () => {
  it.each([
    [0, 'N'],
    [11, 'N'],
    [12, 'NNE'],
    [90, 'E'],
    [189, 'S'],
    [270, 'W'],
    [349, 'N'],
    [-90, 'W'],
    [720, 'N'],
  ])('%d° → %s', (deg, dir) => {
    expect(compassDirection(deg)).toBe(dir);
  });
});

describe('fmt', () => {
  it('rounds, adds units, and shows a dash for missing values', () => {
    expect(fmt(19.44, 0, '°')).toBe('19°');
    expect(fmt(0.04, 1, ' mm')).toBe('0 mm');
    expect(fmt(-0.2, 0, '°')).toBe('0°'); // no "-0°"
    expect(fmt(null, 0, '%')).toBe('—');
  });
});

describe('time helpers', () => {
  it('formats a local ISO time without shifting it', () => {
    expect(formatLocalClock('2026-11-03T16:15', 'en-GB')).toBe('16:15');
    expect(formatLocalClock('garbage', 'en-GB')).toBe('');
  });

  it('computes wall-clock time from a UTC offset', () => {
    const now = Date.UTC(2026, 10, 3, 21, 30); // 21:30 UTC
    expect(localTimeAt(-5 * 3600, now, 'en-GB')).toBe('16:30');
    expect(localTimeAt(5.5 * 3600, now, 'en-GB')).toBe('3:00'); // next day, India (+5:30)
  });

  it('labels forecast days', () => {
    expect(dayLabel('2026-11-03', 0, 'en-US')).toBe('Today');
    expect(dayLabel('2026-11-04', 1, 'en-US')).toBe('Wed');
  });
});
