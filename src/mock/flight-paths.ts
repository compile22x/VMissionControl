/**
 * GPS waypoint routes around Bangalore for demo drones.
 * Each path is a closed loop — drone cycles through waypoints continuously.
 */

export interface PathWaypoint {
  lat: number;
  lon: number;
  alt: number; // meters AGL
  speed: number; // m/s target ground speed
}

/**
 * Path 0: Alpha-1 — Security patrol circuit around Cubbon Park.
 */
const CUBBON_PARK_PATROL: PathWaypoint[] = [
  { lat: 12.9766, lon: 77.5933, alt: 40, speed: 8 },
  { lat: 12.9790, lon: 77.5960, alt: 45, speed: 8 },
  { lat: 12.9810, lon: 77.5993, alt: 40, speed: 8 },
  { lat: 12.9795, lon: 77.6025, alt: 45, speed: 8 },
  { lat: 12.9770, lon: 77.6040, alt: 40, speed: 8 },
  { lat: 12.9745, lon: 77.6020, alt: 45, speed: 8 },
  { lat: 12.9730, lon: 77.5985, alt: 40, speed: 8 },
  { lat: 12.9745, lon: 77.5950, alt: 45, speed: 8 },
];

/**
 * Path 1: Bravo-2 — Survey grid over Ulsoor Lake.
 */
const ULSOOR_LAKE_SURVEY: PathWaypoint[] = [
  { lat: 12.9836, lon: 77.6094, alt: 80, speed: 5 },
  { lat: 12.9850, lon: 77.6094, alt: 80, speed: 5 },
  { lat: 12.9850, lon: 77.6130, alt: 80, speed: 5 },
  { lat: 12.9836, lon: 77.6130, alt: 80, speed: 5 },
  { lat: 12.9836, lon: 77.6165, alt: 80, speed: 5 },
  { lat: 12.9850, lon: 77.6165, alt: 80, speed: 5 },
  { lat: 12.9850, lon: 77.6200, alt: 80, speed: 5 },
  { lat: 12.9836, lon: 77.6200, alt: 80, speed: 5 },
  { lat: 12.9822, lon: 77.6200, alt: 80, speed: 5 },
  { lat: 12.9822, lon: 77.6165, alt: 80, speed: 5 },
  { lat: 12.9822, lon: 77.6130, alt: 80, speed: 5 },
  { lat: 12.9822, lon: 77.6094, alt: 80, speed: 5 },
];

/**
 * Path 2: Echo-5 — SAR search grid near Whitefield.
 */
const WHITEFIELD_SAR: PathWaypoint[] = [
  { lat: 12.9698, lon: 77.7500, alt: 60, speed: 10 },
  { lat: 12.9730, lon: 77.7530, alt: 65, speed: 10 },
  { lat: 12.9760, lon: 77.7500, alt: 60, speed: 10 },
  { lat: 12.9730, lon: 77.7470, alt: 65, speed: 10 },
  { lat: 12.9698, lon: 77.7440, alt: 60, speed: 10 },
  { lat: 12.9666, lon: 77.7470, alt: 65, speed: 10 },
  { lat: 12.9666, lon: 77.7530, alt: 60, speed: 10 },
  { lat: 12.9698, lon: 77.7560, alt: 65, speed: 10 },
];

export const FLIGHT_PATHS: PathWaypoint[][] = [
  CUBBON_PARK_PATROL,
  ULSOOR_LAKE_SURVEY,
  WHITEFIELD_SAR,
];

/**
 * Interpolate position between two waypoints.
 * Returns { lat, lon, alt, heading, progress (0-1) }.
 */
export function interpolatePath(
  from: PathWaypoint,
  to: PathWaypoint,
  t: number
): { lat: number; lon: number; alt: number; heading: number } {
  const lat = from.lat + (to.lat - from.lat) * t;
  const lon = from.lon + (to.lon - from.lon) * t;
  const alt = from.alt + (to.alt - from.alt) * t;

  // Calculate heading
  const dLon = to.lon - from.lon;
  const y = Math.sin(dLon * (Math.PI / 180)) * Math.cos(to.lat * (Math.PI / 180));
  const x =
    Math.cos(from.lat * (Math.PI / 180)) * Math.sin(to.lat * (Math.PI / 180)) -
    Math.sin(from.lat * (Math.PI / 180)) * Math.cos(to.lat * (Math.PI / 180)) * Math.cos(dLon * (Math.PI / 180));
  const heading = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;

  return { lat, lon, alt, heading };
}
