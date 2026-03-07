/**
 * @module airspace/threat-calculator
 * @description Pure functions for CPA (Closest Point of Approach) computation
 * and threat classification. No store access, no side effects.
 * @license GPL-3.0-only
 */

import type { AircraftState, ThreatAssessment, ThreatLevel } from "./types";

const DEG_TO_RAD = Math.PI / 180;
const EARTH_RADIUS_M = 6_371_000;
const LAT_M_PER_DEG = 111_320;

// ── Haversine ────────────────────────────────────────────────────────

export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLon = (lon2 - lon1) * DEG_TO_RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG_TO_RAD) *
      Math.cos(lat2 * DEG_TO_RAD) *
      Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── CPA computation ──────────────────────────────────────────────────

/**
 * Compute Closest Point of Approach between drone position and an aircraft.
 * Uses linear extrapolation of current velocity/heading over a short horizon.
 * Drone is assumed stationary (conservative — worst case for collision risk).
 */
export function computeCPA(
  droneLat: number,
  droneLon: number,
  droneAltMsl: number,
  aircraft: AircraftState,
): { distanceM: number; timeS: number; altitudeDeltaM: number } {
  const acAlt = aircraft.altitudeMsl ?? 0;
  const altitudeDeltaM = acAlt - droneAltMsl;

  // If aircraft has no velocity or heading, CPA is current distance
  if (aircraft.velocity == null || aircraft.heading == null || aircraft.velocity <= 0) {
    const dist = haversineDistance(droneLat, droneLon, aircraft.lat, aircraft.lon);
    return {
      distanceM: Math.sqrt(dist ** 2 + altitudeDeltaM ** 2),
      timeS: 0,
      altitudeDeltaM,
    };
  }

  // Convert positions to local meters (approximate flat-earth projection)
  const cosLat = Math.cos(droneLat * DEG_TO_RAD);
  const lonMPerDeg = LAT_M_PER_DEG * cosLat;

  const dx = (aircraft.lon - droneLon) * lonMPerDeg;
  const dy = (aircraft.lat - droneLat) * LAT_M_PER_DEG;
  const dz = altitudeDeltaM;

  // Aircraft velocity components (heading: 0=north, 90=east, clockwise)
  const headingRad = aircraft.heading * DEG_TO_RAD;
  const vx = aircraft.velocity * Math.sin(headingRad);
  const vy = aircraft.velocity * Math.cos(headingRad);
  const vz = aircraft.verticalRate ?? 0;

  // Relative velocity (drone stationary, so it's just aircraft velocity)
  // Distance squared as function of time: |P + V*t|^2
  // d/dt = 0 => t_cpa = -(P dot V) / (V dot V)
  const vDotV = vx * vx + vy * vy + vz * vz;
  if (vDotV < 0.01) {
    // Aircraft essentially stationary
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return { distanceM: dist, timeS: 0, altitudeDeltaM };
  }

  const pDotV = dx * vx + dy * vy + dz * vz;
  const tCpa = Math.max(0, -pDotV / vDotV);

  // Cap extrapolation at 120 seconds (beyond that, linear model is unreliable)
  const t = Math.min(tCpa, 120);

  const cpaDx = dx + vx * t;
  const cpaDy = dy + vy * t;
  const cpaDz = dz + vz * t;
  const cpaDistance = Math.sqrt(cpaDx * cpaDx + cpaDy * cpaDy + cpaDz * cpaDz);

  return { distanceM: cpaDistance, timeS: t, altitudeDeltaM };
}

// ── Threat classification ────────────────────────────────────────────

export function classifyThreat(cpa: {
  distanceM: number;
  timeS: number;
}): ThreatLevel {
  if (cpa.distanceM < 500 && cpa.timeS < 30) return "ra";
  if (cpa.distanceM < 1500 && cpa.timeS < 60) return "ta";
  if (cpa.distanceM < 3000) return "proximate";
  return "other";
}

// ── Batch threat computation ─────────────────────────────────────────

export function computeAllThreats(
  droneLat: number,
  droneLon: number,
  droneAltMsl: number,
  aircraft: AircraftState[],
): ThreatAssessment[] {
  return aircraft.map((ac) => {
    const cpa = computeCPA(droneLat, droneLon, droneAltMsl, ac);
    return {
      icao24: ac.icao24,
      level: classifyThreat(cpa),
      cpaDistance: cpa.distanceM,
      cpaTime: cpa.timeS,
      altitudeDelta: cpa.altitudeDeltaM,
    };
  });
}
