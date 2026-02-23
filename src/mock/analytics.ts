import type { AnalyticsData } from "@/lib/types";
import { getFlightHistory } from "./history";

/** Generate analytics aggregation from flight history. */
export function generateAnalytics(): AnalyticsData {
  const flights = getFlightHistory();

  const totalFlights = flights.length;
  const totalFlightTime = flights.reduce((s, f) => s + f.duration, 0);
  const totalDistance = flights.reduce((s, f) => s + f.distance, 0);
  const avgFlightTime = totalFlights > 0 ? totalFlightTime / totalFlights : 0;
  const avgBatteryUsed =
    totalFlights > 0
      ? flights.reduce((s, f) => s + f.batteryUsed, 0) / totalFlights
      : 0;
  const completedFlights = flights.filter((f) => f.status === "completed").length;
  const missionSuccessRate = totalFlights > 0 ? (completedFlights / totalFlights) * 100 : 0;

  // Flights per day (last 30 days)
  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const flightsPerDay: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const dayStart = now - i * dayMs;
    const dayEnd = dayStart + dayMs;
    const date = new Date(dayStart).toISOString().slice(0, 10);
    const count = flights.filter((f) => f.date >= dayStart && f.date < dayEnd).length;
    flightsPerDay.push({ date, count });
  }

  // Utilization by drone
  const droneMap = new Map<string, { name: string; seconds: number }>();
  for (const f of flights) {
    const existing = droneMap.get(f.droneId);
    if (existing) {
      existing.seconds += f.duration;
    } else {
      droneMap.set(f.droneId, { name: f.droneName, seconds: f.duration });
    }
  }
  const utilizationByDrone = Array.from(droneMap.entries()).map(([droneId, d]) => ({
    droneId,
    droneName: d.name,
    hours: d.seconds / 3600,
  }));

  // Battery degradation (simulated — gradual decline)
  const batteryDegradation: { date: string; avgCapacity: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now - i * dayMs).toISOString().slice(0, 10);
    batteryDegradation.push({
      date,
      avgCapacity: 100 - (29 - i) * 0.15 + Math.random() * 0.5,
    });
  }

  return {
    totalFlights,
    totalFlightTime,
    totalDistance,
    avgFlightTime,
    avgBatteryUsed,
    missionSuccessRate,
    flightsPerDay,
    utilizationByDrone,
    batteryDegradation,
  };
}
