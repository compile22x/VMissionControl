/**
 * @module flyability
 * @description Flyability assessment logic. Given a point, airspace zones,
 * NOTAMs, TFRs, and nearby traffic, produces a verdict (clear/advisory/restricted)
 * with guidance text and jurisdiction-specific CTA links.
 * @license GPL-3.0-only
 */

import type { Jurisdiction } from "@/lib/jurisdiction";
import type {
  AirspaceZone,
  Notam,
  TemporaryRestriction,
  AircraftState,
  Flyability,
  FlyabilityVerdict,
  CtaLink,
  NearestAirport,
} from "./types";
import { haversineDistance } from "./threat-calculator";

/** Known airports for nearest-airport detection. */
const KNOWN_AIRPORTS: { name: string; icao: string; lat: number; lon: number }[] = [
  { name: "Delhi Indira Gandhi", icao: "VIDP", lat: 28.5562, lon: 77.1000 },
  { name: "Bangalore Kempegowda", icao: "VOBL", lat: 13.1986, lon: 77.7066 },
  { name: "Mumbai Chhatrapati Shivaji", icao: "VABB", lat: 19.0896, lon: 72.8656 },
  { name: "John F. Kennedy", icao: "KJFK", lat: 40.6413, lon: -73.7781 },
  { name: "Los Angeles Intl", icao: "KLAX", lat: 33.9425, lon: -118.4081 },
  { name: "Sydney Kingsford Smith", icao: "YSSY", lat: -33.9461, lon: 151.1772 },
  { name: "Melbourne Tullamarine", icao: "YMML", lat: -37.6690, lon: 144.8410 },
];

export function assessFlyability(
  lat: number,
  lon: number,
  zones: AirspaceZone[],
  notams: Notam[],
  tfrs: TemporaryRestriction[],
  aircraft: AircraftState[],
  jurisdiction: Jurisdiction | null
): Flyability {
  // Find zones that contain this point
  const activeZones = zones.filter((z) => isPointInZone(lat, lon, z));

  // Count nearby traffic (within 5km)
  const trafficCount = aircraft.filter(
    (ac) => ac.lat && ac.lon && haversineDistance(lat, lon, ac.lat, ac.lon) < 5000
  ).length;

  // Find nearest airport
  const nearestAirport = findNearestAirport(lat, lon);

  // Filter active NOTAMs (by location proximity)
  const activeNotams = notams.filter(
    (n) => n.lat != null && n.lon != null && haversineDistance(lat, lon, n.lat!, n.lon!) < (n.radius ?? 10) * 1000
  );

  // Filter active TFRs (by time and location)
  const now = new Date();
  const activeTfrs = tfrs.filter((t) => {
    const from = new Date(t.validFrom);
    const to = new Date(t.validTo);
    return now >= from && now <= to;
  });

  // Determine verdict
  let verdict: FlyabilityVerdict = "clear";
  let maxAltitudeAgl = getDefaultMaxAlt(jurisdiction);

  for (const zone of activeZones) {
    if (zone.type === "prohibited" || zone.type === "dgcaRed") {
      verdict = "restricted";
      maxAltitudeAgl = 0;
      break;
    }
    if (zone.type === "restricted" || zone.type === "casaRestricted" || zone.type === "tfr") {
      verdict = "restricted";
      maxAltitudeAgl = 0;
    }
    if (zone.type === "classB" || zone.type === "classC" || zone.type === "classD") {
      if (verdict !== "restricted") verdict = "advisory";
      if (zone.laancCeiling != null) {
        maxAltitudeAgl = Math.min(maxAltitudeAgl, zone.laancCeiling);
      }
    }
    if (zone.type === "dgcaYellow" || zone.type === "casaCaution") {
      if (verdict !== "restricted") verdict = "advisory";
      maxAltitudeAgl = Math.min(maxAltitudeAgl, zone.ceilingAltitude);
    }
  }

  if (activeTfrs.length > 0 && verdict !== "restricted") {
    verdict = "restricted";
    maxAltitudeAgl = 0;
  }

  if (activeNotams.length > 0 && verdict === "clear") {
    verdict = "advisory";
  }

  // Generate guidance and CTA links
  const { guidance, ctaLinks } = getJurisdictionGuidance(jurisdiction, verdict, activeZones);

  return {
    verdict,
    maxAltitudeAgl,
    zones: activeZones,
    nearestAirport,
    activeNotams,
    activeTfrs,
    trafficCount,
    guidance,
    ctaLinks,
  };
}

function getDefaultMaxAlt(jurisdiction: Jurisdiction | null): number {
  switch (jurisdiction) {
    case "dgca": return 120;
    case "faa": return 122; // 400ft
    case "casa": return 120;
    default: return 120;
  }
}

function isPointInZone(lat: number, lon: number, zone: AirspaceZone): boolean {
  const coords = zone.geometry.type === "Polygon"
    ? zone.geometry.coordinates[0]
    : zone.geometry.coordinates[0]?.[0];

  if (!coords || coords.length < 3) return false;

  // Ray casting algorithm for point-in-polygon
  let inside = false;
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const xi = coords[i][1]; // lat
    const yi = coords[i][0]; // lon
    const xj = coords[j][1];
    const yj = coords[j][0];

    if ((yi > lon) !== (yj > lon) && lat < ((xj - xi) * (lon - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function findNearestAirport(lat: number, lon: number): NearestAirport | null {
  let nearest: NearestAirport | null = null;
  let minDist = Infinity;

  for (const airport of KNOWN_AIRPORTS) {
    const dist = haversineDistance(lat, lon, airport.lat, airport.lon);
    if (dist < minDist) {
      minDist = dist;
      const bearing = computeBearing(lat, lon, airport.lat, airport.lon);
      nearest = {
        name: airport.name,
        icao: airport.icao,
        distanceKm: dist / 1000,
        bearing,
      };
    }
  }

  return nearest;
}

function computeBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = Math.PI / 180;
  const dLon = (lon2 - lon1) * toRad;
  const y = Math.sin(dLon) * Math.cos(lat2 * toRad);
  const x = Math.cos(lat1 * toRad) * Math.sin(lat2 * toRad) -
    Math.sin(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function getJurisdictionGuidance(
  jurisdiction: Jurisdiction | null,
  verdict: FlyabilityVerdict,
  zones: AirspaceZone[]
): { guidance: string; ctaLinks: CtaLink[] } {
  const ctaLinks: CtaLink[] = [];
  let guidance = "";

  switch (jurisdiction) {
    case "dgca": {
      const hasRed = zones.some((z) => z.type === "dgcaRed");
      const hasYellow = zones.some((z) => z.type === "dgcaYellow");
      if (hasRed) {
        guidance = "DGCA Red Zone. No drone operations permitted. This area is within the no-fly perimeter of an airport or restricted facility.";
      } else if (hasYellow) {
        guidance = "DGCA Yellow Zone. Flight requires prior permission from the relevant authority via Digital Sky. Maximum altitude 60m AGL.";
      } else {
        guidance = "DGCA Green Zone. No permission needed for Nano/Micro category drones under 120m AGL. Register on Digital Sky for larger categories.";
      }
      ctaLinks.push(
        { label: "Register on Digital Sky", url: "https://digitalsky.dgca.gov.in" },
        { label: "DGCA Drone Rules", url: "https://dgca.gov.in/digigov-portal/" }
      );
      break;
    }
    case "faa": {
      const hasClassB = zones.some((z) => z.type === "classB");
      const hasClassC = zones.some((z) => z.type === "classC");
      if (hasClassB || hasClassC) {
        guidance = `FAA ${hasClassB ? "Class B" : "Class C"} airspace. LAANC authorization required before flight. Check the LAANC ceiling grid for approved altitudes. Part 107 rules apply.`;
      } else {
        guidance = "Outside controlled airspace. Part 107 rules apply: 400ft AGL max, visual line of sight, daylight/twilight only. Register at faadronezone.faa.gov.";
      }
      ctaLinks.push(
        { label: "Get LAANC Authorization", url: "https://www.aloft.ai" },
        { label: "Check B4UFLY", url: "https://www.faa.gov/uas/getting_started/b4ufly" },
        { label: "FAA DroneZone", url: "https://faadronezone.faa.gov" }
      );
      break;
    }
    case "casa": {
      const hasRestricted = zones.some((z) => z.type === "casaRestricted");
      if (hasRestricted) {
        guidance = "Within 5.5km of a controlled aerodrome. CASA approval required. Check Wing OpenSky for automated authorization when available.";
      } else {
        guidance = "Outside aerodrome restrictions. Sub-2kg excluded category: fly below 120m AGL, visual line of sight, not over people. Check CASA rules for your category.";
      }
      ctaLinks.push(
        { label: "Wing OpenSky", url: "https://opensky.wing.com" },
        { label: "CASA Drone Rules", url: "https://www.casa.gov.au/knowyourdrone" }
      );
      break;
    }
    default:
      if (verdict === "clear") {
        guidance = "No jurisdiction selected. Set your regulatory jurisdiction in Settings for location-specific guidance.";
      } else {
        guidance = "Airspace restrictions detected. Set your jurisdiction in Settings for detailed guidance.";
      }
  }

  return { guidance, ctaLinks };
}
