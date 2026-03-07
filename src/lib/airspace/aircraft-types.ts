/**
 * @module airspace/aircraft-types
 * @description ICAO ADS-B emitter category descriptions and common aircraft
 * type designators for enriching traffic display.
 * @license GPL-3.0-only
 */

/** Map ICAO ADS-B emitter category to description */
export function getCategoryDescription(category: number): string {
  const CATEGORIES: Record<number, string> = {
    0: "Unknown",
    1: "Light (< 15,500 lbs)",
    2: "Small (15,500 - 75,000 lbs)",
    3: "Large (75,000 - 300,000 lbs)",
    4: "High Vortex Large",
    5: "Heavy (> 300,000 lbs)",
    6: "High Performance",
    7: "Rotorcraft",
    8: "Glider / Sailplane",
    9: "Lighter-than-Air",
    10: "Parachutist",
    11: "Ultralight",
    12: "UAV",
    13: "Space Vehicle",
    14: "Emergency Vehicle",
    15: "Service Vehicle",
    16: "Point Obstacle",
    17: "Cluster Obstacle",
    18: "Line Obstacle",
  };
  return CATEGORIES[category] ?? "Unknown";
}

/** Common ICAO type designators */
const TYPE_NAMES: Record<string, string> = {
  A20N: "Airbus A320neo",
  A21N: "Airbus A321neo",
  A319: "Airbus A319",
  A320: "Airbus A320",
  A321: "Airbus A321",
  A332: "Airbus A330-200",
  A333: "Airbus A330-300",
  A339: "Airbus A330-900neo",
  A342: "Airbus A340-200",
  A359: "Airbus A350-900",
  A35K: "Airbus A350-1000",
  A388: "Airbus A380-800",
  B737: "Boeing 737",
  B738: "Boeing 737-800",
  B38M: "Boeing 737 MAX 8",
  B39M: "Boeing 737 MAX 9",
  B744: "Boeing 747-400",
  B748: "Boeing 747-8",
  B752: "Boeing 757-200",
  B763: "Boeing 767-300",
  B772: "Boeing 777-200",
  B77L: "Boeing 777-200LR",
  B77W: "Boeing 777-300ER",
  B788: "Boeing 787-8",
  B789: "Boeing 787-9",
  B78X: "Boeing 787-10",
  C172: "Cessna 172 Skyhawk",
  C208: "Cessna 208 Caravan",
  C510: "Cessna Citation Mustang",
  CRJ2: "Bombardier CRJ-200",
  CRJ7: "Bombardier CRJ-700",
  CRJ9: "Bombardier CRJ-900",
  E170: "Embraer E170",
  E190: "Embraer E190",
  E195: "Embraer E195",
  E75L: "Embraer E175",
  DH8D: "Bombardier Dash 8 Q400",
  AT76: "ATR 72-600",
  AT75: "ATR 72-500",
  SF34: "Saab 340",
  PC12: "Pilatus PC-12",
  GLF6: "Gulfstream G650",
  GALX: "Gulfstream G200",
  H25B: "Hawker 800",
  EC35: "Airbus H135",
  AS50: "Airbus H125",
  B06: "Bell 206",
  R22: "Robinson R22",
  R44: "Robinson R44",
};

export function getTypeDescription(typeCode: string): string {
  return TYPE_NAMES[typeCode.toUpperCase()] ?? typeCode;
}
