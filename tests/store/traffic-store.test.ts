import { describe, it, expect, beforeEach } from 'vitest';
import { useTrafficStore } from '@/stores/traffic-store';
import type { AircraftState, TrafficAlert } from '@/lib/airspace/types';

function makeAircraft(overrides: Partial<AircraftState> = {}): AircraftState {
  return {
    icao24: 'abc123',
    callsign: 'TEST1',
    originCountry: 'India',
    lat: 12.97,
    lon: 77.59,
    altitudeMsl: 1000,
    altitudeAgl: null,
    velocity: 100,
    heading: 90,
    verticalRate: 0,
    squawk: '7000',
    category: 1,
    lastSeen: Date.now(),
    ...overrides,
  };
}

describe('traffic-store', () => {
  beforeEach(() => {
    useTrafficStore.getState().clear();
  });

  it('initial state has empty aircraft map', () => {
    const state = useTrafficStore.getState();
    expect(state.aircraft.size).toBe(0);
    expect(state.alerts).toEqual([]);
    expect(state.threatLevels.size).toBe(0);
    expect(state.polling).toBe(false);
    expect(state.connectionQuality).toBe('disconnected');
  });

  it('updateAircraft() adds new aircraft', () => {
    const ac1 = makeAircraft({ icao24: 'abc001' });
    const ac2 = makeAircraft({ icao24: 'abc002', callsign: 'TEST2' });

    useTrafficStore.getState().updateAircraft([ac1, ac2]);

    const state = useTrafficStore.getState();
    expect(state.aircraft.size).toBe(2);
    expect(state.aircraft.get('abc001')?.callsign).toBe('TEST1');
    expect(state.aircraft.get('abc002')?.callsign).toBe('TEST2');
  });

  it('updateAircraft() updates existing aircraft', () => {
    const ac = makeAircraft({ icao24: 'abc001', altitudeMsl: 1000 });
    useTrafficStore.getState().updateAircraft([ac]);

    const updated = makeAircraft({ icao24: 'abc001', altitudeMsl: 2000 });
    useTrafficStore.getState().updateAircraft([updated]);

    const state = useTrafficStore.getState();
    expect(state.aircraft.size).toBe(1);
    expect(state.aircraft.get('abc001')?.altitudeMsl).toBe(2000);
  });

  it('updateAircraft() removes stale entries', () => {
    const staleTime = Date.now() - 130_000; // 130 seconds ago (>120s threshold)
    const stale = makeAircraft({ icao24: 'stale01', lastSeen: staleTime });
    const fresh = makeAircraft({ icao24: 'fresh01', lastSeen: Date.now() });

    // Add both: stale one already in map, fresh one incoming
    useTrafficStore.setState({
      aircraft: new Map([['stale01', stale]]),
    });
    useTrafficStore.getState().updateAircraft([fresh]);

    const state = useTrafficStore.getState();
    expect(state.aircraft.has('stale01')).toBe(false);
    expect(state.aircraft.has('fresh01')).toBe(true);
  });

  it('aircraft map is correctly keyed by icao24', () => {
    const aircraft = [
      makeAircraft({ icao24: 'aaa111' }),
      makeAircraft({ icao24: 'bbb222' }),
      makeAircraft({ icao24: 'ccc333' }),
    ];
    useTrafficStore.getState().updateAircraft(aircraft);

    const state = useTrafficStore.getState();
    expect(state.aircraft.size).toBe(3);
    expect(Array.from(state.aircraft.keys()).sort()).toEqual(['aaa111', 'bbb222', 'ccc333']);
  });

  it('addAlert() appends an alert', () => {
    const alert: TrafficAlert = {
      id: 'alert-1',
      icao24: 'abc001',
      callsign: 'TEST1',
      level: 'ta',
      distanceKm: 2.5,
      altitudeDelta: 100,
      timestamp: Date.now(),
      dismissed: false,
    };

    useTrafficStore.getState().addAlert(alert);
    expect(useTrafficStore.getState().alerts).toHaveLength(1);
    expect(useTrafficStore.getState().alerts[0].id).toBe('alert-1');
  });

  it('dismissAlert() marks alert as dismissed', () => {
    const alert: TrafficAlert = {
      id: 'alert-1',
      icao24: 'abc001',
      callsign: null,
      level: 'ra',
      distanceKm: 1.0,
      altitudeDelta: 50,
      timestamp: Date.now(),
      dismissed: false,
    };

    useTrafficStore.getState().addAlert(alert);
    useTrafficStore.getState().dismissAlert('alert-1');
    expect(useTrafficStore.getState().alerts[0].dismissed).toBe(true);
  });

  it('recordFailure() tracks consecutive failures and degrades quality', () => {
    useTrafficStore.getState().recordFailure('timeout');
    expect(useTrafficStore.getState().consecutiveFailures).toBe(1);
    expect(useTrafficStore.getState().connectionQuality).toBe('degraded');
    expect(useTrafficStore.getState().lastError).toBe('timeout');

    useTrafficStore.getState().recordFailure('timeout');
    useTrafficStore.getState().recordFailure('timeout');
    expect(useTrafficStore.getState().consecutiveFailures).toBe(3);
    expect(useTrafficStore.getState().connectionQuality).toBe('disconnected');
  });

  it('recordSuccess() resets failures and sets quality to good', () => {
    useTrafficStore.getState().recordFailure('err');
    useTrafficStore.getState().recordFailure('err');

    useTrafficStore.getState().recordSuccess('adsb.lol');
    const state = useTrafficStore.getState();
    expect(state.consecutiveFailures).toBe(0);
    expect(state.lastError).toBeNull();
    expect(state.connectionQuality).toBe('good');
    expect(state.dataSource).toBe('adsb.lol');
  });

  it('toggleTracked() adds and removes tracked aircraft', () => {
    useTrafficStore.getState().toggleTracked('abc001');
    expect(useTrafficStore.getState().trackedAircraft.has('abc001')).toBe(true);

    useTrafficStore.getState().toggleTracked('abc001');
    expect(useTrafficStore.getState().trackedAircraft.has('abc001')).toBe(false);
  });

  it('clear() resets entire state', () => {
    useTrafficStore.getState().updateAircraft([makeAircraft()]);
    useTrafficStore.getState().addAlert({
      id: 'a', icao24: 'x', callsign: null, level: 'ta',
      distanceKm: 1, altitudeDelta: 0, timestamp: 0, dismissed: false,
    });
    useTrafficStore.getState().recordFailure('oops');

    useTrafficStore.getState().clear();

    const state = useTrafficStore.getState();
    expect(state.aircraft.size).toBe(0);
    expect(state.alerts).toEqual([]);
    expect(state.consecutiveFailures).toBe(0);
    expect(state.connectionQuality).toBe('disconnected');
  });
});
