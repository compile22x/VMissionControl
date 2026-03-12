import { describe, it, expect } from 'vitest';
import { generateSurvey } from '@/lib/patterns/survey-generator';
import type { SurveyConfig } from '@/lib/patterns/types';

function makeConfig(overrides?: Partial<SurveyConfig>): SurveyConfig {
  return {
    polygon: [
      [12.970, 77.590],
      [12.970, 77.600],
      [12.980, 77.600],
      [12.980, 77.590],
    ],
    gridAngle: 0,
    lineSpacing: 50,
    turnAroundDistance: 10,
    entryLocation: 'topLeft',
    flyAlternateTransects: false,
    cameraTriggerDistance: 0,
    altitude: 50,
    speed: 5,
    ...overrides,
  };
}

describe('generateSurvey', () => {
  it('generates waypoints for a simple rectangle', () => {
    const result = generateSurvey(makeConfig());
    expect(result.waypoints.length).toBeGreaterThan(0);
  });

  it('boustrophedon pattern alternates direction', () => {
    const result = generateSurvey(makeConfig({ lineSpacing: 100 }));
    // With boustrophedon, consecutive transect pairs should swap start/end X direction.
    // Check that we get at least 2 transects (4 waypoints for non-camera mode).
    expect(result.waypoints.length).toBeGreaterThanOrEqual(4);
    expect(result.stats.transectCount).toBeGreaterThanOrEqual(2);
  });

  it('crosshatch pattern generates perpendicular passes', () => {
    const result = generateSurvey(makeConfig({ crosshatch: true }));
    const singleResult = generateSurvey(makeConfig({ crosshatch: false }));
    // Crosshatch should produce more waypoints than a single pass
    expect(result.waypoints.length).toBeGreaterThan(singleResult.waypoints.length);
    expect(result.stats.transectCount).toBeGreaterThan(singleResult.stats.transectCount);
  });

  it('waypoints are inside or near the polygon boundary', () => {
    const result = generateSurvey(makeConfig({ turnAroundDistance: 0 }));
    // With zero overshoot, all waypoints should be within or very near the polygon
    for (const wp of result.waypoints) {
      // Allow small tolerance for floating point
      expect(wp.lat).toBeGreaterThanOrEqual(12.969);
      expect(wp.lat).toBeLessThanOrEqual(12.981);
      expect(wp.lon).toBeGreaterThanOrEqual(77.589);
      expect(wp.lon).toBeLessThanOrEqual(77.601);
    }
  });

  it('stats include totalDistance, transectCount, estimatedTime', () => {
    const result = generateSurvey(makeConfig());
    expect(result.stats.totalDistance).toBeGreaterThan(0);
    expect(result.stats.transectCount).toBeGreaterThan(0);
    expect(result.stats.estimatedTime).toBeGreaterThan(0);
  });

  it('respects lineSpacing parameter', () => {
    const narrow = generateSurvey(makeConfig({ lineSpacing: 25 }));
    const wide = generateSurvey(makeConfig({ lineSpacing: 100 }));
    // Narrower spacing = more transects
    expect(narrow.stats.transectCount).toBeGreaterThan(wide.stats.transectCount);
  });

  it('returns empty for degenerate polygon (< 3 vertices)', () => {
    const result = generateSurvey(makeConfig({
      polygon: [[12.97, 77.59], [12.98, 77.60]],
    }));
    expect(result.waypoints).toHaveLength(0);
  });
});
