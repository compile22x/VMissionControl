/**
 * @module airspace/airspace-provider
 * @description Jurisdiction dispatcher for loading airspace zones.
 * @license GPL-3.0-only
 */

import type { Jurisdiction } from "@/lib/jurisdiction";
import type { AirspaceZone, BoundingBox } from "./types";
import { getUSAirspaceZones } from "./faa-data";
import { getIndiaAirspaceZones } from "./dgca-zones";
import { getAustraliaAirspaceZones } from "./casa-zones";
import { getICAOStandardZones } from "./icao-zones";
import { fetchOpenAIPAirspaces } from "./openaip-provider";

export async function loadAirspaceZones(
  jurisdiction: Jurisdiction | null,
  bbox: BoundingBox,
): Promise<AirspaceZone[]> {
  switch (jurisdiction) {
    case "faa":
      return getUSAirspaceZones(bbox);
    case "dgca":
      return getIndiaAirspaceZones(bbox);
    case "casa":
      return getAustraliaAirspaceZones(bbox);
    case "easa":
    case "caa_uk":
    case "caac":
    case "jcab":
    case "tcca":
      return []; // Zone data can be populated as available
    default:
      return [];
  }
}

export async function loadAllAirspaceZones(
  bbox: BoundingBox,
  openAipApiKey?: string | null,
): Promise<AirspaceZone[]> {
  const apiKey = openAipApiKey || process.env.NEXT_PUBLIC_OPENAIP_API_KEY;

  // Always load jurisdiction-specific circle zones + ICAO standards
  const [india, us, au] = await Promise.all([
    getIndiaAirspaceZones(bbox),
    getUSAirspaceZones(bbox),
    getAustraliaAirspaceZones(bbox),
  ]);
  const icao = getICAOStandardZones(bbox);
  const baseZones = [...india, ...us, ...au, ...icao];

  if (!apiKey) return baseZones;

  // Merge OpenAIP real polygons on top of circle fallbacks
  try {
    const countries = [
      // Europe
      "GB", "DE", "FR", "ES", "IT", "NL", "BE", "AT", "CH", "SE",
      "NO", "DK", "FI", "PL", "CZ", "HU", "RO", "PT", "IE", "GR",
      "HR", "BG", "SK", "SI", "LT", "LV", "EE",
      // Americas
      "US", "CA", "BR", "MX", "AR", "CL", "CO",
      // Asia-Pacific
      "IN", "JP", "KR", "CN", "AU", "NZ", "SG", "TH", "MY", "ID",
      "PH", "VN",
      // Middle East & Africa
      "AE", "SA", "IL", "ZA", "EG", "KE", "NG",
    ];
    const openAipZones = await fetchOpenAIPAirspaces(countries, apiKey);
    if (openAipZones.length > 0) {
      console.log(`[airspace] OpenAIP: ${openAipZones.length} polygons + ${baseZones.length} circle zones`);
      return [...baseZones, ...openAipZones];
    }
  } catch (err) {
    console.warn("[airspace] OpenAIP fetch failed, using circle fallbacks:", err);
  }

  return baseZones;
}
