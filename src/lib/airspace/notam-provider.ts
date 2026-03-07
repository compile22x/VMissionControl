/**
 * @module airspace/notam-provider
 * @description NOTAM fetcher stub for MVP.
 * @license GPL-3.0-only
 */

import type { BoundingBox, Notam } from "./types";

/**
 * Fetch NOTAMs for the given bounding box.
 * MVP stub: real NOTAM APIs require FAA/ICAO credentials.
 */
export async function fetchNotams(_bbox: BoundingBox): Promise<Notam[]> {
  return [];
}
