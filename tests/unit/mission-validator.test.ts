import { describe, it, expect } from 'vitest';
import { validateMission } from '@/lib/validation/mission-validator';
import type { Waypoint } from '@/lib/types/mission';

function wp(overrides: Partial<Waypoint> & { lat: number; lon: number }): Waypoint {
  return {
    id: Math.random().toString(36).slice(2, 10),
    alt: 50,
    command: 'WAYPOINT',
    ...overrides,
  };
}

describe('validateMission', () => {
  it('returns EMPTY_MISSION error for empty mission', () => {
    const result = validateMission([]);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe('EMPTY_MISSION');
  });

  it('returns TOO_FEW_WAYPOINTS warning for single waypoint', () => {
    const result = validateMission([wp({ lat: 12.97, lon: 77.59, command: 'TAKEOFF' })]);
    expect(result.warnings.some((w) => w.code === 'TOO_FEW_WAYPOINTS')).toBe(true);
  });

  it('returns NO_TAKEOFF warning when first command is not TAKEOFF', () => {
    const result = validateMission([
      wp({ lat: 12.97, lon: 77.59, command: 'WAYPOINT' }),
      wp({ lat: 12.98, lon: 77.60, command: 'LAND' }),
    ]);
    expect(result.warnings.some((w) => w.code === 'NO_TAKEOFF')).toBe(true);
  });

  it('returns NO_LAND warning when last command is not LAND or RTL', () => {
    const result = validateMission([
      wp({ lat: 12.97, lon: 77.59, command: 'TAKEOFF' }),
      wp({ lat: 12.98, lon: 77.60, command: 'WAYPOINT' }),
    ]);
    expect(result.warnings.some((w) => w.code === 'NO_LAND')).toBe(true);
  });

  it('returns INVALID_COORDS error for lat > 90', () => {
    const result = validateMission([
      wp({ lat: 91, lon: 77.59, command: 'TAKEOFF' }),
      wp({ lat: 12.98, lon: 77.60, command: 'LAND' }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'INVALID_COORDS')).toBe(true);
  });

  it('returns ALTITUDE_EXCEEDED error when altitude exceeds maxAltitude', () => {
    const result = validateMission(
      [
        wp({ lat: 12.97, lon: 77.59, alt: 200, command: 'TAKEOFF' }),
        wp({ lat: 12.98, lon: 77.60, alt: 50, command: 'LAND' }),
      ],
      { maxAltitude: 120 },
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'ALTITUDE_EXCEEDED')).toBe(true);
  });

  it('returns OUTSIDE_GEOFENCE error for point outside geofence polygon', () => {
    const polygon: [number, number][] = [
      [12.96, 77.58],
      [12.96, 77.60],
      [12.98, 77.60],
      [12.98, 77.58],
    ];
    const result = validateMission(
      [
        wp({ lat: 12.97, lon: 77.59, command: 'TAKEOFF' }),
        wp({ lat: 13.10, lon: 77.59, command: 'LAND' }), // outside
      ],
      { geofence: { polygonPoints: polygon } },
    );
    expect(result.errors.some((e) => e.code === 'OUTSIDE_GEOFENCE')).toBe(true);
  });

  it('returns OUTSIDE_GEOFENCE error for point outside geofence circle', () => {
    const result = validateMission(
      [
        wp({ lat: 12.97, lon: 77.59, command: 'TAKEOFF' }),
        wp({ lat: 13.10, lon: 77.59, command: 'LAND' }), // far outside
      ],
      { geofence: { circleCenter: [12.97, 77.59], circleRadius: 100 } },
    );
    expect(result.errors.some((e) => e.code === 'OUTSIDE_GEOFENCE')).toBe(true);
  });

  it('returns no OUTSIDE_GEOFENCE error for point inside geofence polygon', () => {
    const polygon: [number, number][] = [
      [12.96, 77.58],
      [12.96, 77.61],
      [12.99, 77.61],
      [12.99, 77.58],
    ];
    const result = validateMission(
      [
        wp({ lat: 12.97, lon: 77.59, command: 'TAKEOFF' }),
        wp({ lat: 12.975, lon: 77.595, command: 'LAND' }),
      ],
      { geofence: { polygonPoints: polygon } },
    );
    expect(result.errors.filter((e) => e.code === 'OUTSIDE_GEOFENCE')).toHaveLength(0);
  });

  it('returns DUPLICATE_WAYPOINT warning for waypoints < 0.5m apart', () => {
    const result = validateMission([
      wp({ lat: 12.970000, lon: 77.590000, command: 'TAKEOFF' }),
      wp({ lat: 12.970000, lon: 77.590000, command: 'LAND' }), // same point
    ]);
    expect(result.warnings.some((w) => w.code === 'DUPLICATE_WAYPOINT')).toBe(true);
  });

  it('returns EXCESSIVE_DISTANCE warning for waypoints far apart', () => {
    const result = validateMission(
      [
        wp({ lat: 12.97, lon: 77.59, command: 'TAKEOFF' }),
        wp({ lat: 20.00, lon: 77.59, command: 'LAND' }), // ~780 km
      ],
      { maxDistanceBetweenWps: 1000 }, // 1 km
    );
    expect(result.warnings.some((w) => w.code === 'EXCESSIVE_DISTANCE')).toBe(true);
  });

  it('returns INVALID_JUMP_TARGET error for invalid DO_JUMP target', () => {
    const result = validateMission([
      wp({ lat: 12.97, lon: 77.59, command: 'TAKEOFF' }),
      wp({ lat: 12.98, lon: 77.60, command: 'DO_JUMP', param1: 99 }), // target out of range
      wp({ lat: 12.99, lon: 77.61, command: 'LAND' }),
    ]);
    expect(result.errors.some((e) => e.code === 'INVALID_JUMP_TARGET')).toBe(true);
  });

  it('returns TERRAIN_CLEARANCE error for terrain clearance violation', () => {
    const result = validateMission(
      [
        wp({ lat: 12.97, lon: 77.59, alt: 103, command: 'TAKEOFF' }),
        wp({ lat: 12.98, lon: 77.60, alt: 50, command: 'LAND' }),
      ],
      {
        terrainElevations: [{ waypointIndex: 0, groundElevation: 100 }],
        minTerrainClearance: 5,
      },
    );
    expect(result.errors.some((e) => e.code === 'TERRAIN_CLEARANCE')).toBe(true);
  });

  it('returns SELF_INTERSECTING_FENCE warning for self-intersecting geofence', () => {
    // Bowtie polygon (self-intersecting)
    const polygon: [number, number][] = [
      [12.96, 77.58],
      [12.98, 77.60],
      [12.96, 77.60],
      [12.98, 77.58],
    ];
    const result = validateMission(
      [wp({ lat: 12.97, lon: 77.59, command: 'TAKEOFF' }), wp({ lat: 12.975, lon: 77.59, command: 'LAND' })],
      { geofence: { polygonPoints: polygon } },
    );
    expect(result.warnings.some((w) => w.code === 'SELF_INTERSECTING_FENCE')).toBe(true);
  });

  it('returns valid=true and no errors for a valid mission with TAKEOFF + waypoints + LAND', () => {
    const polygon: [number, number][] = [
      [12.96, 77.58],
      [12.96, 77.61],
      [12.99, 77.61],
      [12.99, 77.58],
    ];
    const result = validateMission(
      [
        wp({ lat: 12.97, lon: 77.59, command: 'TAKEOFF' }),
        wp({ lat: 12.975, lon: 77.595 }),
        wp({ lat: 12.98, lon: 77.60, command: 'LAND' }),
      ],
      { geofence: { polygonPoints: polygon }, maxAltitude: 120 },
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
