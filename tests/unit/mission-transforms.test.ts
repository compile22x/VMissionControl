import { describe, it, expect } from 'vitest';
import {
  moveMission,
  moveMissionByBearing,
  rotateMission,
  scaleMission,
} from '@/lib/transforms/mission-transforms';
import type { Waypoint } from '@/lib/types/mission';

function wp(lat: number, lon: number, extra?: Partial<Waypoint>): Waypoint {
  return {
    id: Math.random().toString(36).slice(2, 10),
    lat,
    lon,
    alt: 50,
    command: 'WAYPOINT',
    ...extra,
  };
}

const sampleWaypoints: Waypoint[] = [
  wp(12.970, 77.590, { id: 'a', alt: 30, command: 'TAKEOFF' }),
  wp(12.975, 77.595, { id: 'b', alt: 50 }),
  wp(12.980, 77.600, { id: 'c', alt: 40, command: 'LAND' }),
];

describe('moveMission', () => {
  it('shifts all waypoints by delta', () => {
    const moved = moveMission(sampleWaypoints, 0.01, 0.02);
    for (let i = 0; i < sampleWaypoints.length; i++) {
      expect(moved[i].lat).toBeCloseTo(sampleWaypoints[i].lat + 0.01, 8);
      expect(moved[i].lon).toBeCloseTo(sampleWaypoints[i].lon + 0.02, 8);
    }
  });

  it('preserves altitude and other properties', () => {
    const moved = moveMission(sampleWaypoints, 0.01, 0.02);
    for (let i = 0; i < sampleWaypoints.length; i++) {
      expect(moved[i].alt).toBe(sampleWaypoints[i].alt);
      expect(moved[i].id).toBe(sampleWaypoints[i].id);
      expect(moved[i].command).toBe(sampleWaypoints[i].command);
    }
  });

  it('returns empty array for empty input', () => {
    expect(moveMission([], 1, 1)).toEqual([]);
  });

  it('returns a NEW array (non-mutating)', () => {
    const moved = moveMission(sampleWaypoints, 0.01, 0.02);
    expect(moved).not.toBe(sampleWaypoints);
    expect(moved[0]).not.toBe(sampleWaypoints[0]);
  });
});

describe('moveMissionByBearing', () => {
  it('moves all waypoints by bearing and distance', () => {
    const moved = moveMissionByBearing(sampleWaypoints, 0, 1000); // 1km north
    for (let i = 0; i < sampleWaypoints.length; i++) {
      // Moved north means lat increased
      expect(moved[i].lat).toBeGreaterThan(sampleWaypoints[i].lat);
      // Lon should stay roughly the same (bearing=0 is due north)
      expect(moved[i].lon).toBeCloseTo(sampleWaypoints[i].lon, 3);
    }
  });
});

describe('rotateMission', () => {
  it('returns approximately same positions for 0 degree rotation', () => {
    const rotated = rotateMission(sampleWaypoints, 0);
    for (let i = 0; i < sampleWaypoints.length; i++) {
      expect(rotated[i].lat).toBeCloseTo(sampleWaypoints[i].lat, 6);
      expect(rotated[i].lon).toBeCloseTo(sampleWaypoints[i].lon, 6);
    }
  });

  it('flips positions around centroid for 180 degree rotation', () => {
    const rotated = rotateMission(sampleWaypoints, 180);
    // Centroid
    const cLat = sampleWaypoints.reduce((s, w) => s + w.lat, 0) / sampleWaypoints.length;
    const cLon = sampleWaypoints.reduce((s, w) => s + w.lon, 0) / sampleWaypoints.length;
    // After 180 degree rotation, each point should be reflected through the centroid
    for (let i = 0; i < sampleWaypoints.length; i++) {
      const expectedLat = 2 * cLat - sampleWaypoints[i].lat;
      const expectedLon = 2 * cLon - sampleWaypoints[i].lon;
      expect(rotated[i].lat).toBeCloseTo(expectedLat, 4);
      expect(rotated[i].lon).toBeCloseTo(expectedLon, 4);
    }
  });

  it('returns empty array for empty input', () => {
    expect(rotateMission([], 90)).toEqual([]);
  });

  it('preserves waypoint id/alt/command properties', () => {
    const rotated = rotateMission(sampleWaypoints, 45);
    for (let i = 0; i < sampleWaypoints.length; i++) {
      expect(rotated[i].id).toBe(sampleWaypoints[i].id);
      expect(rotated[i].alt).toBe(sampleWaypoints[i].alt);
      expect(rotated[i].command).toBe(sampleWaypoints[i].command);
    }
  });

  it('returns a NEW array (non-mutating)', () => {
    const rotated = rotateMission(sampleWaypoints, 45);
    expect(rotated).not.toBe(sampleWaypoints);
  });
});

describe('scaleMission', () => {
  it('returns approximately same positions for factor 1', () => {
    const scaled = scaleMission(sampleWaypoints, 1);
    for (let i = 0; i < sampleWaypoints.length; i++) {
      expect(scaled[i].lat).toBeCloseTo(sampleWaypoints[i].lat, 8);
      expect(scaled[i].lon).toBeCloseTo(sampleWaypoints[i].lon, 8);
    }
  });

  it('doubles distances from centroid for factor 2', () => {
    const cLat = sampleWaypoints.reduce((s, w) => s + w.lat, 0) / sampleWaypoints.length;
    const cLon = sampleWaypoints.reduce((s, w) => s + w.lon, 0) / sampleWaypoints.length;
    const scaled = scaleMission(sampleWaypoints, 2);
    for (let i = 0; i < sampleWaypoints.length; i++) {
      const expectedLat = cLat + (sampleWaypoints[i].lat - cLat) * 2;
      const expectedLon = cLon + (sampleWaypoints[i].lon - cLon) * 2;
      expect(scaled[i].lat).toBeCloseTo(expectedLat, 8);
      expect(scaled[i].lon).toBeCloseTo(expectedLon, 8);
    }
  });

  it('returns empty array for empty input', () => {
    expect(scaleMission([], 2)).toEqual([]);
  });

  it('preserves waypoint id/alt/command properties', () => {
    const scaled = scaleMission(sampleWaypoints, 2);
    for (let i = 0; i < sampleWaypoints.length; i++) {
      expect(scaled[i].id).toBe(sampleWaypoints[i].id);
      expect(scaled[i].alt).toBe(sampleWaypoints[i].alt);
      expect(scaled[i].command).toBe(sampleWaypoints[i].command);
    }
  });

  it('returns a NEW array (non-mutating)', () => {
    const scaled = scaleMission(sampleWaypoints, 2);
    expect(scaled).not.toBe(sampleWaypoints);
  });
});
