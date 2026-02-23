import type { FlightRecord, SuiteType } from "@/lib/types";
import { randomId } from "@/lib/utils";

const SUITE_NAMES: SuiteType[] = ["sentry", "survey", "sar", "agriculture", "cargo", "inspection"];
const DRONE_NAMES = ["Alpha-1", "Bravo-2", "Echo-5", "Charlie", "Delta"];
const DRONE_IDS = ["alpha-1", "bravo-2", "echo-5", "charlie", "delta"];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Generate 30 days of mock flight history (87 flights). */
export function generateFlightHistory(): FlightRecord[] {
  const records: FlightRecord[] = [];
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  for (let i = 0; i < 87; i++) {
    const droneIdx = randomInt(0, 3); // exclude Delta (maintenance)
    const date = now - Math.random() * thirtyDaysMs;
    const duration = randomInt(300, 2400); // 5-40 min
    const distance = randomInt(500, 15000); // 0.5-15 km
    const isAborted = Math.random() < 0.05;
    const isEmergency = Math.random() < 0.02;

    records.push({
      id: randomId(),
      droneId: DRONE_IDS[droneIdx],
      droneName: DRONE_NAMES[droneIdx],
      suiteType: SUITE_NAMES[randomInt(0, SUITE_NAMES.length - 1)],
      date,
      duration,
      distance,
      maxAlt: randomInt(30, 120),
      maxSpeed: randomInt(5, 18),
      batteryUsed: randomInt(15, 65),
      waypointCount: randomInt(4, 24),
      status: isEmergency ? "emergency" : isAborted ? "aborted" : "completed",
    });
  }

  return records.sort((a, b) => b.date - a.date);
}

let _cachedHistory: FlightRecord[] | null = null;

export function getFlightHistory(): FlightRecord[] {
  if (!_cachedHistory) _cachedHistory = generateFlightHistory();
  return _cachedHistory;
}
