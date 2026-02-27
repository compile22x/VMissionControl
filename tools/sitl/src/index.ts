// index.ts — CLI entry point for altnautica-sitl
// SPDX-License-Identifier: GPL-3.0-only

import { SitlLauncher, type SitlConfig } from './launcher/sitl.js';
import { TcpWsBridge } from './bridge/tcp-ws.js';
import {
  Dashboard,
  parseHeartbeat,
  parseGlobalPositionInt,
} from './dashboard/terminal.js';
import { resolvePreset } from './presets/resolve.js';
import { listPresets } from './presets/presets.js';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  drones: number;
  wsPort: number;
  lat: number;
  lon: number;
  speedup: number;
  wind?: { speed: number; direction: number };
  ardupilotHome?: string;
  vehicle: string;
  noDashboard: boolean;
  preset?: string;
  listPresets: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    drones: 1,
    wsPort: 5760,
    lat: 12.9716,
    lon: 77.5946,
    speedup: 1,
    vehicle: 'ArduCopter',
    noDashboard: false,
    listPresets: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    switch (arg) {
      case '--drones':
        args.drones = parseInt(next, 10);
        i++;
        break;
      case '--ws-port':
        args.wsPort = parseInt(next, 10);
        i++;
        break;
      case '--lat':
        args.lat = parseFloat(next);
        i++;
        break;
      case '--lon':
        args.lon = parseFloat(next);
        i++;
        break;
      case '--speedup':
        args.speedup = parseFloat(next);
        i++;
        break;
      case '--wind': {
        const [speed, dir] = next.split(',').map(Number);
        args.wind = { speed, direction: dir };
        i++;
        break;
      }
      case '--ardupilot':
        args.ardupilotHome = next;
        i++;
        break;
      case '--vehicle':
        args.vehicle = next;
        i++;
        break;
      case '--no-dashboard':
        args.noDashboard = true;
        break;
      case '--preset':
        args.preset = next;
        i++;
        break;
      case '--list-presets':
        args.listPresets = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`Unknown argument: ${arg}`);
        printHelp();
        process.exit(1);
    }
  }

  return args;
}

function printHelp(): void {
  console.log(`
altnautica-sitl — ArduPilot SITL launcher + TCP→WebSocket bridge

Usage:
  npx tsx src/index.ts [options]

Options:
  --drones <N>        Number of ArduCopter instances (default: 1)
  --ws-port <port>    WebSocket port for GCS connection (default: 5760)
  --lat <degrees>     Home latitude (default: 12.9716 — Bangalore)
  --lon <degrees>     Home longitude (default: 77.5946)
  --speedup <N>       Simulation speed multiplier (default: 1)
  --wind <spd,dir>    Wind speed (m/s) and direction (degrees)
  --ardupilot <path>  Path to ArduPilot source (default: ~/.ardupilot)
  --vehicle <type>    Vehicle type: ArduCopter, ArduPlane, ArduRover (default: ArduCopter)
  --preset <id>       Use a build preset (sets frame, params, vehicle)
  --list-presets      List all available build presets and exit
  --no-dashboard      Disable terminal dashboard (log to stdout instead)
  -h, --help          Show this help

Examples:
  npx tsx src/index.ts                                # Single drone, Bangalore
  npx tsx src/index.ts --drones 3                     # Three drones
  npx tsx src/index.ts --preset 7in-long-range        # 7" LR build preset
  npx tsx src/index.ts --preset 10in-heavy-lifter     # Hexa heavy lifter
  npx tsx src/index.ts --list-presets                  # Show all presets
  npx tsx src/index.ts --wind 5,180                   # 5 m/s wind from south
  npx tsx src/index.ts --lat 28.6139 --lon 77.2090    # New Delhi
`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function printPresets(): void {
  const presets = listPresets();
  console.log('\nAvailable build presets:\n');
  console.log(
    '  ' +
    'ID'.padEnd(24) +
    'Name'.padEnd(24) +
    'Frame'.padEnd(8) +
    'Motors'.padEnd(20) +
    'Cells'.padEnd(6) +
    'GPS',
  );
  console.log('  ' + '-'.repeat(86));
  for (const p of presets) {
    const motorCount = p.components.find((c) => c.type === 'motor')?.count ?? '?';
    const motorStr = `${motorCount}× ${p.specs.motorSize} ${p.specs.motorKv}KV`;
    console.log(
      '  ' +
      p.id.padEnd(24) +
      p.name.padEnd(24) +
      p.sitl.frame.padEnd(8) +
      motorStr.padEnd(20) +
      `${p.specs.cells}S`.padEnd(6) +
      (p.specs.hasGps ? 'Yes' : 'No'),
    );
  }
  console.log('');
}

async function main(): Promise<void> {
  const cli = parseArgs(process.argv);

  // --- List presets --------------------------------------------------------
  if (cli.listPresets) {
    printPresets();
    process.exit(0);
  }

  // --- Resolve preset (if specified) ---------------------------------------
  let presetName: string | undefined;
  let presetExtraArgs: string[] = [];

  if (cli.preset) {
    try {
      const resolved = resolvePreset(cli.preset);
      presetName = resolved.preset.name;
      presetExtraArgs = resolved.extraArgs;
      // Preset can override vehicle type
      cli.vehicle = resolved.vehicle;
    } catch (err) {
      console.error(`\n${(err as Error).message}\n`);
      process.exit(1);
    }
  }

  // --- Dashboard (optional) -----------------------------------------------
  const dashboard = cli.noDashboard
    ? null
    : new Dashboard({
        wsPort: cli.wsPort,
        vehicle: cli.vehicle,
        speedup: cli.speedup,
        presetName,
      });

  const log = (msg: string) => {
    if (dashboard) {
      dashboard.addLog(msg);
    } else {
      const ts = new Date().toLocaleTimeString('en-IN', { hour12: false });
      console.log(`[${ts}] ${msg}`);
    }
  };

  // --- SITL Launcher ------------------------------------------------------
  const launcherConfig: Partial<SitlConfig> & Pick<SitlConfig, 'lat' | 'lon'> = {
    lat: cli.lat,
    lon: cli.lon,
    drones: cli.drones,
    speedup: cli.speedup,
    vehicle: cli.vehicle,
    wind: cli.wind,
    baseTcpPort: cli.wsPort,
    extraArgs: presetExtraArgs.length > 0 ? presetExtraArgs : undefined,
  };
  if (cli.ardupilotHome) {
    launcherConfig.ardupilotHome = cli.ardupilotHome;
  }

  const launcher = new SitlLauncher(launcherConfig);

  launcher.on('stdout', (line: string) => {
    // Only log interesting lines, filter out noisy sim output
    if (line.includes('Ready to fly') || line.includes('APM:') || line.includes('EKF')) {
      log(`SITL: ${line.trim()}`);
    }
  });

  launcher.on('stderr', (line: string) => {
    log(`SITL stderr: ${line.trim()}`);
  });

  const presetLabel = presetName ? ` [${presetName}]` : '';
  log(`Launching ${cli.vehicle} SITL (${cli.drones} drone${cli.drones > 1 ? 's' : ''})${presetLabel}...`);
  log(`Home: ${cli.lat.toFixed(4)}, ${cli.lon.toFixed(4)} | Speed: ${cli.speedup}x`);
  if (cli.wind) {
    log(`Wind: ${cli.wind.speed} m/s from ${cli.wind.direction}°`);
  }

  if (dashboard) {
    dashboard.start();
  }

  let instances;
  try {
    instances = await launcher.launch();
  } catch (err) {
    if (dashboard) dashboard.stop();
    console.error(`\nFailed to launch SITL: ${(err as Error).message}`);
    console.error('\nHave you run the setup script?');
    console.error('  cd tools/sitl && bash scripts/setup-ardupilot.sh\n');
    process.exit(1);
  }

  for (const inst of instances) {
    log(`Drone ${inst.sysId} ready on TCP port ${inst.tcpPort} (pid ${inst.pid})`);
  }

  // --- TCP→WS Bridge ------------------------------------------------------
  const bridge = new TcpWsBridge({
    wsPort: cli.wsPort,
    tcpInstances: instances.map((inst) => ({
      host: '127.0.0.1',
      port: inst.tcpPort,
      sysId: inst.sysId,
    })),
  });

  bridge.on('tcp-connected', ({ sysId, port }) => {
    log(`TCP bridge connected to 127.0.0.1:${port} (sysid=${sysId})`);
  });

  bridge.on('tcp-disconnected', ({ sysId }) => {
    log(`TCP disconnected (sysid=${sysId}), reconnecting...`);
  });

  bridge.on('ws-client-connected', ({ remoteAddress }) => {
    log(`GCS connected from ${remoteAddress}`);
    if (dashboard) dashboard.updateClientCount(bridge.wsClientCount);
  });

  bridge.on('ws-client-disconnected', ({ remoteAddress }) => {
    log(`GCS disconnected: ${remoteAddress}`);
    if (dashboard) dashboard.updateClientCount(bridge.wsClientCount);
  });

  // Peek at TCP data for dashboard drone state
  bridge.on('data', ({ sysId, data }) => {
    if (!dashboard) return;

    const hb = parseHeartbeat(data);
    if (hb) {
      dashboard.updateDroneState(hb.sysId, {
        mode: hb.mode,
        armed: hb.armed,
      });
    }

    const pos = parseGlobalPositionInt(data);
    if (pos) {
      dashboard.updateDroneState(pos.sysId, {
        lat: pos.lat,
        lon: pos.lon,
      });
    }
  });

  bridge.on('error', (err) => {
    // Suppress ECONNREFUSED during TCP reconnect (expected during SITL startup)
    if ((err as NodeJS.ErrnoException).code === 'ECONNREFUSED') return;
    log(`Bridge error: ${err.message}`);
  });

  bridge.start();
  log(`WebSocket bridge listening on ws://localhost:${cli.wsPort}`);

  // --- Signal handling (clean shutdown) -----------------------------------
  let shuttingDown = false;

  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;

    log('Shutting down...');
    bridge.shutdown();
    await launcher.shutdown();
    if (dashboard) dashboard.stop();

    console.log('\nAll SITL processes stopped. Goodbye.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
