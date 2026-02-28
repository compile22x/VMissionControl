# Altnautica Command

**Open-source web-based Ground Control Station for autonomous drones**

![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-green.svg) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg) ![Next.js 16](https://img.shields.io/badge/Next.js-16-black.svg) ![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg) [![Discord](https://img.shields.io/badge/Discord-Join-5865F2.svg?logo=discord&logoColor=white)](https://discord.gg/uxbvuD4d5q)

<p align="center">
  <img src="public/screenshots/dashboard.png" alt="Fleet Dashboard" width="100%">
</p>

## Quick Start

```bash
git clone https://github.com/altnautica/ADOSMissionControl.git
cd ADOSMissionControl
npm install
npm run demo
```

Open [http://localhost:4000](http://localhost:4000) — 5 simulated drones with live telemetry, mission planning, and full FC configuration. No hardware needed.

## CLI

Command includes an interactive CLI for all development workflows:

```bash
npm run cli              # Interactive menu
npm run cli dev          # Dev server (port 4000)
npm run cli demo         # Demo mode — 5 simulated drones
npm run cli sitl         # Launch ArduPilot SITL + WebSocket bridge
npm run cli deploy       # Lint → build → start
npm run cli setup        # First-time setup wizard
npm run cli config       # Configure .env.local interactively
npm run cli sitl-setup   # Clone & build ArduPilot for SITL
npm run cli info         # Check system prerequisites
```

Run `npm run cli` with no arguments for an interactive menu:

```
   _   _ _                   _   _
  /_\ | | |_ _ _  __ _ _  _| |_(_)__ __ _
 / _ \| |  _| ' \/ _` | || |  _| / _/ _` |
/_/ \_\_|\__|_||_\__,_|\_,_|\__|_\__\__,_|

  C O M M A N D
  Ground Control Station

◆  What would you like to do?
│  ○ Start dev server (port 4000)
│  ○ Start demo mode (5 simulated drones)
│  ○ Launch SITL simulator (ArduPilot + WebSocket bridge)
│  ────────────────────────────────
│  ○ Build & deploy (lint → build → start)
│  ────────────────────────────────
│  ○ First-time setup (install deps, configure env)
│  ○ Configure environment (.env.local)
│  ○ Setup ArduPilot SITL (clone + build)
│  ○ System info (check prerequisites)
└
```

---

## What Is This?

Altnautica Command is a web GCS that runs in any browser — no installation, no desktop app. Connect to a flight controller over WebSocket or USB (WebSerial), configure it, plan missions, and fly. Works on tablets, laptops, and ground stations.

It replaces desktop-only tools like QGroundControl and Mission Planner with a modern web stack: React 19, TypeScript strict, real-time Zustand stores with ring-buffered telemetry, and a custom binary MAVLink v2 parser.

**[Live App](https://command.altnautica.com)** · **[Website](https://altnautica.com/command)** · **[Discord](https://discord.gg/uxbvuD4d5q)**

---

## Screenshots

<table>
  <tr>
    <td><img src="public/screenshots/mission-planner.png" alt="Mission Planner" width="100%"></td>
    <td><img src="public/screenshots/flight-control.png" alt="Flight Control" width="100%"></td>
  </tr>
  <tr>
    <td><img src="public/screenshots/3d-simulation.png" alt="3D Simulation" width="100%"></td>
    <td><img src="public/screenshots/configure.png" alt="FC Configuration" width="100%"></td>
  </tr>
  <tr>
    <td><img src="public/screenshots/parameters.png" alt="FC Parameters" width="100%"></td>
    <td></td>
  </tr>
</table>

---

## Features

### Flight Controller Configuration

- **25 configuration panels** — calibration, receiver, outputs, PID tuning, failsafe, power, ports, OSD, firmware, and more
- **Board auto-detection** — 9 profiles (SpeedyBee F405 Wing/V3/V4, Matek H743, Pixhawk 4/6C/6X) with STM32 timer group maps
- **Full parameter system** — search, edit, and write all FC parameters with real-time validation
- **Timer group conflict detection** — visual diagram of STM32 hardware timers, color-coded by protocol (DShot vs PWM)
- **Sensor calibration wizards** — accelerometer 6-position, compass, gyro, baro, RC calibration with live feedback

### Mission Planning

- Waypoint editor with drag-and-drop on an interactive map
- Altitude profile visualization with per-waypoint AGL control
- Geofence editor — inclusion and exclusion zones
- Plan library — save, load, duplicate, and organize missions (IndexedDB)
- Import/export `.waypoints` and `.plan` file formats

### Live Telemetry

- Real-time dashboard with attitude, position, velocity, and battery indicators
- EKF status, GPS fix quality, vibration levels, RSSI, sensor health monitoring
- Telemetry freshness tracking — indicators go stale when data stops arriving
- Flight history with CSV export
- Ring-buffered stores — bounded memory for arbitrarily long sessions

### Protocol Support

- **MAVLink v2** binary parser with CRC validation and 46 message decoders
- **ArduPilot** — full support (all panels, calibration, missions, dataflash logs)
- **PX4** — partial (adapter designed, implementation in progress)
- **Betaflight / iNav** — planned (MSP interface stubs)
- Multi-firmware `DroneProtocol` abstraction — components never call MAVLink directly

### Demo Mode

- 5 simulated drones with realistic telemetry — GPS tracks, battery drain, altitude profiles
- Full mock MAVLink — all 25 FC panels work against simulated FC responses
- Zero setup: `npm run demo` or pass `?demo=true` in the URL

---

## Connecting to Hardware

### WebSocket

Connect to any MAVLink-over-WebSocket endpoint — mavlink-router on a companion computer, or the SITL bridge for simulation.

```bash
# ArduPilot SITL via the companion bridge tool
npm run cli sitl
# Then in Command: connect to ws://localhost:5762
```

See [`tools/sitl/`](tools/sitl/) for full SITL setup (requires ArduPilot built from source).

### WebSerial (Direct USB)

Connect your FC via USB, open Command in Chrome 89+, click connect → WebSerial → pick the port. No drivers, no intermediate software.

---

## Environment Variables

All optional. Command works standalone with zero config.

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_DEMO_MODE` | `false` | 5 simulated drones with full mock MAVLink |
| `NEXT_PUBLIC_CONVEX_URL` | — | Convex backend for cloud fleet management |
| `NEXT_PUBLIC_CESIUM_ION_TOKEN` | — | Cesium Ion token for 3D simulation terrain |

Use `npm run cli config` to set these interactively, or create `.env.local` manually.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19, Tailwind v4 |
| State | Zustand 5 (ring-buffered telemetry) |
| Maps | Leaflet + react-leaflet |
| 3D | Cesium |
| Charts | Recharts |
| Protocol | Custom MAVLink v2 binary parser/encoder |
| Transport | WebSocket + WebSerial |
| Storage | IndexedDB (offline plan library) |
| Backend | Convex (optional, for cloud fleet ops) |
| Language | TypeScript (strict) |

---

## Firmware Support

| Firmware | Status | Notes |
|----------|--------|-------|
| ArduPilot | **Full** | 46 decoders, 17 commands, all panels, calibration, missions, logs |
| PX4 | Partial | Adapter designed, implementation in progress |
| Betaflight | Planned | MSP interface stub |
| iNav | Planned | MSP interface stub |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide.

```bash
# Fork → clone → branch → code → test → PR
npm run demo   # Test against simulated drones
npm run lint   # Must pass before PR
```

Areas where help is especially useful: PX4 adapter, Betaflight/iNav MSP, new board profiles, UDP transport, unit tests.

---

## License

[GPL-3.0-only](LICENSE) — Copyright 2026 Altnautica.

Free to use, modify, and distribute. Derivative works must also be GPL-3.0 — same philosophy as ArduPilot.

---

## Links

- **Live app:** [command.altnautica.com](https://command.altnautica.com)
- **Website:** [altnautica.com/command](https://altnautica.com/command)
- **Discord:** [discord.gg/uxbvuD4d5q](https://discord.gg/uxbvuD4d5q)
- **Issues:** [github.com/altnautica/ADOSMissionControl/issues](https://github.com/altnautica/ADOSMissionControl/issues)
- **SITL tool:** [`tools/sitl/`](tools/sitl/)
