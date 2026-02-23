/**
 * MockFlightEngine — Core simulation loop for demo mode.
 *
 * Writes directly to Zustand stores at configurable tick rate.
 * Components consume store data identically whether mock or real.
 */

import { DEMO_DRONES, configToFleetDrone, type DemoDroneConfig } from "./drones";
import { FLIGHT_PATHS, interpolatePath } from "./flight-paths";
import { generateAlert, batteryAlert } from "./alerts";
import { useFleetStore } from "@/stores/fleet-store";
import { useTelemetryStore } from "@/stores/telemetry-store";
import { useDroneStore } from "@/stores/drone-store";
import { haversineDistance } from "@/lib/telemetry-utils";
import type { FleetDrone } from "@/lib/types";

interface DroneSimState {
  config: DemoDroneConfig;
  pathProgress: number;       // 0-1 progress between current and next waypoint
  currentWaypointIdx: number;
  battery: number;            // current percentage
  tickCount: number;
  lastAlertTick: number;
  batteryAlertSent: boolean;
}

class MockFlightEngine {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private states: DroneSimState[] = [];
  private tickRate = 200; // ms
  private running = false;

  constructor() {
    this.states = DEMO_DRONES.map((cfg) => ({
      config: cfg,
      pathProgress: 0,
      currentWaypointIdx: 0,
      battery: cfg.batteryStart,
      tickCount: 0,
      lastAlertTick: 0,
      batteryAlertSent: false,
    }));
  }

  start(intervalMs = 200): void {
    if (this.running) return;
    this.tickRate = intervalMs;
    this.running = true;

    // Initialize fleet store with demo drones
    const initialDrones = DEMO_DRONES.map(configToFleetDrone);
    useFleetStore.getState().setDrones(initialDrones);

    // Select first drone by default
    useDroneStore.getState().selectDrone("alpha-1");

    this.intervalId = setInterval(() => this.tick(), this.tickRate);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.running = false;
  }

  tick(): void {
    const fleetStore = useFleetStore.getState();
    const telemetryStore = useTelemetryStore.getState();
    const selectedId = useDroneStore.getState().selectedId;
    const now = Date.now();

    for (const state of this.states) {
      state.tickCount++;
      const cfg = state.config;

      // Skip non-flying drones
      if (cfg.pathIndex < 0) continue;

      const path = FLIGHT_PATHS[cfg.pathIndex];
      if (!path || path.length < 2) continue;

      // Advance along path
      const wp = path[state.currentWaypointIdx];
      const nextIdx = (state.currentWaypointIdx + 1) % path.length;
      const nextWp = path[nextIdx];

      // Speed-based progress increment
      const segmentDist = haversineDistance(wp.lat, wp.lon, nextWp.lat, nextWp.lon);
      const stepDist = (wp.speed * this.tickRate) / 1000; // meters per tick
      const progressStep = segmentDist > 0 ? stepDist / segmentDist : 0.01;
      state.pathProgress += progressStep;

      // Move to next waypoint when segment complete
      if (state.pathProgress >= 1) {
        state.pathProgress = 0;
        state.currentWaypointIdx = nextIdx;
      }

      // Interpolate position
      const pos = interpolatePath(wp, nextWp, state.pathProgress);

      // GPS jitter
      const jitterLat = (Math.random() - 0.5) * 0.00002;
      const jitterLon = (Math.random() - 0.5) * 0.00002;

      // Battery drain: ~80% over 30 min = ~0.044% per second
      state.battery = Math.max(5, state.battery - (0.044 * this.tickRate) / 1000);

      // Attitude: bank into turns
      const headingDelta = pos.heading - (fleetStore.drones.find(d => d.id === cfg.id)?.position?.heading ?? pos.heading);
      const roll = Math.max(-30, Math.min(30, headingDelta * 0.5));
      const pitch = (nextWp.alt - wp.alt) > 0 ? -5 : (nextWp.alt - wp.alt) < 0 ? 5 : -2;

      // Update fleet store
      const droneUpdate: Partial<FleetDrone> = {
        lastHeartbeat: now,
        position: {
          timestamp: now,
          lat: pos.lat + jitterLat,
          lon: pos.lon + jitterLon,
          alt: pos.alt,
          relativeAlt: pos.alt,
          heading: pos.heading,
          groundSpeed: wp.speed,
          airSpeed: wp.speed * 1.05,
          climbRate: (nextWp.alt - wp.alt) * progressStep,
        },
        battery: {
          timestamp: now,
          voltage: 22.2 * (state.battery / 100),
          current: 10 + Math.random() * 5,
          remaining: state.battery,
          consumed: (100 - state.battery) * 22,
        },
        gps: {
          timestamp: now,
          fixType: 3,
          satellites: 14 + Math.floor(Math.random() * 6),
          hdop: 0.8 + Math.random() * 0.4,
          lat: pos.lat + jitterLat,
          lon: pos.lon + jitterLon,
          alt: 920 + pos.alt,
        },
      };
      fleetStore.updateDrone(cfg.id, droneUpdate);

      // Push telemetry to ring buffers for selected drone
      if (cfg.id === selectedId) {
        telemetryStore.pushAttitude({
          timestamp: now,
          roll,
          pitch,
          yaw: pos.heading,
          rollSpeed: roll * 0.1,
          pitchSpeed: pitch * 0.05,
          yawSpeed: headingDelta * 0.02,
        });
        telemetryStore.pushPosition(droneUpdate.position!);
        // Push battery at 2Hz (every 2.5 ticks at 5Hz)
        if (state.tickCount % 3 === 0) {
          telemetryStore.pushBattery(droneUpdate.battery!);
        }
        telemetryStore.pushGps(droneUpdate.gps!);
        telemetryStore.pushVfr({
          timestamp: now,
          airspeed: wp.speed * 1.05,
          groundspeed: wp.speed,
          heading: pos.heading,
          throttle: 45 + Math.random() * 15,
          alt: pos.alt,
          climb: (nextWp.alt - wp.alt) * progressStep,
        });
        telemetryStore.pushRc({
          timestamp: now,
          channels: [1500, 1500, 1500, 1500, 1000, 1000, 1000, 1000, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500],
          rssi: 200 + Math.floor(Math.random() * 55),
        });
      }

      // Alerts
      if (state.battery <= 30 && !state.batteryAlertSent) {
        fleetStore.addAlert(batteryAlert(cfg.id, cfg.name, state.battery));
        state.batteryAlertSent = true;
      }

      // Random alerts every ~60s per drone
      if (state.tickCount - state.lastAlertTick > 300 && Math.random() < 0.02) {
        fleetStore.addAlert(generateAlert(cfg.id, cfg.name));
        state.lastAlertTick = state.tickCount;
      }
    }

    fleetStore.touch();
  }

  isRunning(): boolean {
    return this.running;
  }
}

/** Singleton mock engine instance. */
export const mockEngine = new MockFlightEngine();
