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

export async function loadAllAirspaceZones(bbox: BoundingBox): Promise<AirspaceZone[]> {
  const apiKey = process.env.NEXT_PUBLIC_OPENAIP_API_KEY;

  if (apiKey) {
    try {
      const countries = ["IN", "US", "AU", "GB", "DE", "FR", "ES", "IT", "JP", "CA"];
      const openAipZones = await fetchOpenAIPAirspaces(countries, apiKey);
      if (openAipZones.length > 0) {
        console.log(`[airspace] OpenAIP: ${openAipZones.length} real airspace polygons loaded`);
        return openAipZones;
      }
    } catch (err) {
      console.warn("[airspace] OpenAIP fetch failed, falling back to circles:", err);
    }
  }

  // Fallback: circle-based zones
  const [india, us, au] = await Promise.all([
    getIndiaAirspaceZones(bbox),
    getUSAirspaceZones(bbox),
    getAustraliaAirspaceZones(bbox),
  ]);
  const icao = getICAOStandardZones(bbox);
  return [...india, ...us, ...au, ...icao];
}
