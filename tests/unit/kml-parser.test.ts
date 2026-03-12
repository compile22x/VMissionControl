import { describe, it, expect } from 'vitest';
import { parseKML } from '@/lib/formats/kml-parser';

describe('parseKML', () => {
  it('parses KML with single Placemark containing Point coordinates', () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <Point>
        <coordinates>77.59,12.97,50</coordinates>
      </Point>
    </Placemark>
  </Document>
</kml>`;
    const result = parseKML(kml);
    expect(result.waypoints).toHaveLength(1);
    // KML is lon,lat but output should be lat,lon
    expect(result.waypoints[0].lat).toBeCloseTo(12.97);
    expect(result.waypoints[0].lon).toBeCloseTo(77.59);
    expect(result.waypoints[0].alt).toBe(50);
  });

  it('swaps coordinate order from KML lon,lat to lat,lon', () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <Point>
        <coordinates>-122.0822,37.4220,0</coordinates>
      </Point>
    </Placemark>
  </Document>
</kml>`;
    const result = parseKML(kml);
    expect(result.waypoints[0].lat).toBeCloseTo(37.4220);
    expect(result.waypoints[0].lon).toBeCloseTo(-122.0822);
  });

  it('parses LineString coordinates into paths and waypoints', () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <LineString>
        <coordinates>77.59,12.97,0 77.60,12.98,0 77.61,12.99,0</coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`;
    const result = parseKML(kml);
    expect(result.paths).toHaveLength(1);
    expect(result.paths[0]).toHaveLength(3);
    expect(result.waypoints).toHaveLength(3);
    // Check coordinate swap on path
    expect(result.paths[0][0]).toEqual([12.97, 77.59]);
  });

  it('parses Polygon coordinates into polygons array', () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>77.58,12.96,0 77.60,12.96,0 77.60,12.98,0 77.58,12.98,0 77.58,12.96,0</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`;
    const result = parseKML(kml);
    expect(result.polygons).toHaveLength(1);
    // KML polygon is closed (first == last), parser removes duplicate closing vertex
    expect(result.polygons[0]).toHaveLength(4);
    // Check lat,lon order
    expect(result.polygons[0][0]).toEqual([12.96, 77.58]);
  });

  it('handles empty document', () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document></Document>
</kml>`;
    const result = parseKML(kml);
    expect(result.waypoints).toHaveLength(0);
    expect(result.polygons).toHaveLength(0);
    expect(result.paths).toHaveLength(0);
  });

  it('handles malformed XML gracefully', () => {
    // DOMParser returns a document with parsererror, but won't throw
    const result = parseKML('<not-valid-kml><<>');
    expect(result.waypoints).toHaveLength(0);
    expect(result.polygons).toHaveLength(0);
    expect(result.paths).toHaveLength(0);
  });
});
