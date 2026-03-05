/**
 * MSP (MultiWii Serial Protocol) adapter for Altnautica Command GCS.
 *
 * Implements the `DroneProtocol` interface for Betaflight and iNav
 * flight controllers. MSP is a request/response protocol (unlike
 * MAVLink which streams), so telemetry is actively polled via
 * MspTelemetryPoller.
 *
 * Key differences from MAVLink:
 * - No streaming telemetry; requires active polling
 * - Parameters are binary structs, not named key/value pairs;
 *   the virtual-params layer maps names to struct field offsets
 * - Modes are box-based (AUX channel ranges), not direct commands
 * - CLI passthrough uses STX/ETX framing, not SERIAL_CONTROL
 * - EEPROM write is explicit (MSP_EEPROM_WRITE) unlike ArduPilot's
 *   auto-save
 *
 * @module protocol/msp-adapter
 */

import type {
  DroneProtocol, Transport, VehicleInfo, CommandResult, ParameterValue,
  FirmwareHandler, ProtocolCapabilities, UnifiedFlightMode,
  MissionItem, LogEntry, LogDownloadProgressCallback,
  AttitudeCallback, PositionCallback, BatteryCallback, GpsCallback,
  VfrCallback, RcCallback, StatusTextCallback, HeartbeatCallback,
  ParameterCallback, SerialDataCallback,
  SysStatusCallback, RadioCallback, MissionProgressCallback,
  EkfCallback, VibrationCallback, ServoOutputCallback,
  WindCallback, TerrainCallback,
  MagCalProgressCallback, MagCalReportCallback,
  AccelCalPosCallback,
  HomePositionCallback, AutopilotVersionCallback,
  PowerStatusCallback, DistanceSensorCallback, FenceStatusCallback,
  NavControllerCallback, ScaledImuCallback, ScaledPressureCallback,
  EstimatorStatusCallback, CameraTriggerCallback, LinkStateCallback,
  LocalPositionCallback, DebugCallback, GimbalAttitudeCallback,
  ObstacleDistanceCallback, CameraImageCapturedCallback,
  ExtendedSysStateCallback, FencePointCallback, SystemTimeCallback,
  RawImuCallback, RcChannelsRawCallback, RcChannelsOverrideCallback,
  MissionItemCallback, AltitudeCallback, WindCovCallback,
  AisVesselCallback, GimbalManagerInfoCallback, GimbalManagerStatusCallback,
} from './types'
import { MspParser } from './msp/msp-parser'
import { MspSerialQueue } from './msp/msp-serial-queue'
import { MspTelemetryPoller } from './msp/msp-telemetry-poller'
import { encodeMsp } from './msp/msp-codec'
import { MSP } from './msp/msp-constants'
import { resolveActiveMode, buildBoxMap, parseModeRanges, findModeRange } from './msp/msp-mode-map'
import type { ModeRange } from './msp/msp-mode-map'
import { betaflightHandler } from './firmware/betaflight'
import { inavHandler } from './firmware/inav'

// ── Unsupported result constant ─────────────────────────────

const NOT_SUPPORTED: CommandResult = {
  success: false,
  resultCode: -1,
  message: 'Not supported by MSP firmware',
}

const NOT_CONNECTED: CommandResult = {
  success: false,
  resultCode: -1,
  message: 'Not connected',
}

// ── Helper: read little-endian values from Uint8Array ───────

function u8(buf: Uint8Array, offset: number): number {
  return buf[offset]
}

function u16(buf: Uint8Array, offset: number): number {
  return buf[offset] | (buf[offset + 1] << 8)
}

function u32(buf: Uint8Array, offset: number): number {
  return (buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) | (buf[offset + 3] << 24)) >>> 0
}

function i16(buf: Uint8Array, offset: number): number {
  const val = u16(buf, offset)
  return val >= 0x8000 ? val - 0x10000 : val
}

function i32(buf: Uint8Array, offset: number): number {
  return buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) | (buf[offset + 3] << 24)
}

// ── Helper: write little-endian values into Uint8Array ──────

function writeU16(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff
  buf[offset + 1] = (value >> 8) & 0xff
}

// ── MSP Adapter ─────────────────────────────────────────────

export class MSPAdapter implements DroneProtocol {
  readonly protocolName = 'msp'

  private parser: MspParser = new MspParser()
  private queue: MspSerialQueue | null = null
  private poller: MspTelemetryPoller | null = null
  private transport: Transport | null = null
  private firmwareHandler: FirmwareHandler | null = null
  private vehicleInfo: VehicleInfo | null = null
  private _connected = false
  private inCliMode = false

  // Box mapping (built at connect time from MSP_BOXNAMES + MSP_BOXIDS)
  private boxNames: string[] = []
  private boxIds: number[] = []
  private boxMap: Map<string, number> = new Map()
  private modeRanges: ModeRange[] = []

  // Parameter cache (virtual param system)
  // Maps MSP read command -> last response payload
  private paramCache: Map<number, Uint8Array> = new Map()
  private paramNameCache: string[] = []

  // Callback arrays (same pattern as MAVLinkAdapter)
  private attitudeCallbacks: AttitudeCallback[] = []
  private positionCallbacks: PositionCallback[] = []
  private batteryCallbacks: BatteryCallback[] = []
  private gpsCallbacks: GpsCallback[] = []
  private vfrCallbacks: VfrCallback[] = []
  private rcCallbacks: RcCallback[] = []
  private statusTextCallbacks: StatusTextCallback[] = []
  private heartbeatCallbacks: HeartbeatCallback[] = []
  private parameterCallbacks: ParameterCallback[] = []
  private serialDataCallbacks: SerialDataCallback[] = []
  private sysStatusCallbacks: SysStatusCallback[] = []
  private radioCallbacks: RadioCallback[] = []
  private missionProgressCallbacks: MissionProgressCallback[] = []
  private ekfCallbacks: EkfCallback[] = []
  private vibrationCallbacks: VibrationCallback[] = []
  private servoOutputCallbacks: ServoOutputCallback[] = []
  private windCallbacks: WindCallback[] = []
  private terrainCallbacks: TerrainCallback[] = []
  private magCalProgressCallbacks: MagCalProgressCallback[] = []
  private magCalReportCallbacks: MagCalReportCallback[] = []
  private accelCalPosCallbacks: AccelCalPosCallback[] = []
  private homePositionCallbacks: HomePositionCallback[] = []
  private autopilotVersionCallbacks: AutopilotVersionCallback[] = []
  private powerStatusCallbacks: PowerStatusCallback[] = []
  private distanceSensorCallbacks: DistanceSensorCallback[] = []
  private fenceStatusCallbacks: FenceStatusCallback[] = []
  private navControllerCallbacks: NavControllerCallback[] = []
  private scaledImuCallbacks: ScaledImuCallback[] = []
  private scaledPressureCallbacks: ScaledPressureCallback[] = []
  private estimatorStatusCallbacks: EstimatorStatusCallback[] = []
  private cameraTriggerCallbacks: CameraTriggerCallback[] = []
  private linkLostCallbacks: LinkStateCallback[] = []
  private linkRestoredCallbacks: LinkStateCallback[] = []
  private localPositionCallbacks: LocalPositionCallback[] = []
  private debugCallbacks: DebugCallback[] = []
  private gimbalAttitudeCallbacks: GimbalAttitudeCallback[] = []
  private obstacleDistanceCallbacks: ObstacleDistanceCallback[] = []
  private cameraImageCallbacks: CameraImageCapturedCallback[] = []
  private extendedSysStateCallbacks: ExtendedSysStateCallback[] = []
  private fencePointCallbacks: FencePointCallback[] = []
  private systemTimeCallbacks: SystemTimeCallback[] = []
  private rawImuCallbacks: RawImuCallback[] = []
  private rcChannelsRawCallbacks: RcChannelsRawCallback[] = []
  private rcChannelsOverrideCallbacks: RcChannelsOverrideCallback[] = []
  private missionItemCallbacks: MissionItemCallback[] = []
  private altitudeCallbacks: AltitudeCallback[] = []
  private windCovCallbacks: WindCovCallback[] = []
  private aisVesselCallbacks: AisVesselCallback[] = []
  private gimbalManagerInfoCallbacks: GimbalManagerInfoCallback[] = []
  private gimbalManagerStatusCallbacks: GimbalManagerStatusCallback[] = []

  // Transport event handlers (for cleanup)
  private dataHandler: ((data: Uint8Array) => void) | null = null
  private closeHandler: (() => void) | null = null

  get isConnected(): boolean { return this._connected }

  // ── Connection ─────────────────────────────────────────────

  async connect(transport: Transport): Promise<VehicleInfo> {
    this.transport = transport

    // Wire transport data to parser
    this.dataHandler = (data: Uint8Array) => this.parser.feed(data)
    this.closeHandler = () => this.handleDisconnect()
    transport.on('data', this.dataHandler)
    transport.on('close', this.closeHandler as (data: void) => void)

    // Create serial queue
    this.queue = new MspSerialQueue(
      transport.send.bind(transport),
      this.parser,
      1000, // timeout
      2,    // retries
    )

    // Step 1: MSP_API_VERSION(1) -> protocol version
    const apiVersionFrame = await this.queue.send(MSP.MSP_API_VERSION)
    const apiPayload = apiVersionFrame.payload
    const _mspProtocol = u8(apiPayload, 0)
    const apiVersionMajor = u8(apiPayload, 1)
    const apiVersionMinor = u8(apiPayload, 2)

    // Step 2: MSP_FC_VARIANT(2) -> "BTFL" or "INAV"
    const variantFrame = await this.queue.send(MSP.MSP_FC_VARIANT)
    const variantStr = String.fromCharCode(...variantFrame.payload)

    // Step 3: MSP_FC_VERSION(3) -> major.minor.patch
    const versionFrame = await this.queue.send(MSP.MSP_FC_VERSION)
    const vPayload = versionFrame.payload
    const fwMajor = u8(vPayload, 0)
    const fwMinor = u8(vPayload, 1)
    const fwPatch = u8(vPayload, 2)
    const firmwareVersionString = `${variantStr} ${fwMajor}.${fwMinor}.${fwPatch} (MSP API ${apiVersionMajor}.${apiVersionMinor})`

    // Step 4: MSP_BOARD_INFO(4) -> board identifier
    const boardFrame = await this.queue.send(MSP.MSP_BOARD_INFO)
    const _boardId = String.fromCharCode(...boardFrame.payload.subarray(0, 4))

    // Step 5: MSP_BOXNAMES(116) -> semicolon-separated mode names
    const boxNamesFrame = await this.queue.send(MSP.MSP_BOXNAMES)
    const boxNamesStr = String.fromCharCode(...boxNamesFrame.payload)
    this.boxNames = boxNamesStr.split(';').filter(n => n.length > 0)

    // Step 6: MSP_BOXIDS(119) -> array of permanent box IDs
    const boxIdsFrame = await this.queue.send(MSP.MSP_BOXIDS)
    this.boxIds = Array.from(boxIdsFrame.payload)

    // Build box map
    this.boxMap = buildBoxMap(this.boxNames, this.boxIds)

    // Step 7: MSP_MODE_RANGES(34) -> AUX channel ranges for each box
    try {
      const modeRangesFrame = await this.queue.send(MSP.MSP_MODE_RANGES)
      this.modeRanges = parseModeRanges(modeRangesFrame.payload)
    } catch {
      this.modeRanges = []
    }

    // Determine firmware handler
    const isBetaflight = variantStr.trim() === 'BTFL'
    const isInav = variantStr.trim() === 'INAV'
    this.firmwareHandler = isInav ? inavHandler : betaflightHandler

    // Build vehicle info
    const info: VehicleInfo = {
      firmwareType: isBetaflight ? 'betaflight' : isInav ? 'inav' : 'unknown',
      vehicleClass: 'copter',
      firmwareVersionString,
      systemId: 0,
      componentId: 0,
      autopilotType: 0,
      vehicleType: 0,
    }
    this.vehicleInfo = info

    // Create telemetry poller and start polling
    this.poller = new MspTelemetryPoller(
      this.queue,
      (command, payload) => this.dispatchTelemetry(command, payload),
    )
    this.poller.start()

    this._connected = true
    return info
  }

  async disconnect(): Promise<void> {
    this.handleDisconnect()
    if (this.transport?.isConnected) {
      await this.transport.disconnect()
    }
  }

  private handleDisconnect(): void {
    if (!this._connected && !this.poller) return

    this._connected = false

    if (this.poller) {
      this.poller.stop()
      this.poller = null
    }

    if (this.queue) {
      this.queue.destroy()
      this.queue = null
    }

    this.parser.reset()
    this.paramCache.clear()
    this.paramNameCache = []
    this.inCliMode = false

    if (this.transport && this.dataHandler) {
      this.transport.off('data', this.dataHandler)
      this.transport.off('close', this.closeHandler as (data: void) => void)
    }
    this.transport = null
  }

  // ── Telemetry Dispatch ────────────────────────────────────

  private dispatchTelemetry(command: number, payload: Uint8Array): void {
    const ts = Date.now()

    switch (command) {
      // MSP_ATTITUDE(108): roll, pitch, yaw in decidegrees
      case MSP.MSP_ATTITUDE: {
        if (payload.length < 6) break
        const roll = i16(payload, 0) / 10   // decidegrees -> degrees
        const pitch = i16(payload, 2) / 10
        const yaw = i16(payload, 4)          // yaw is in degrees (0-360)
        for (const cb of this.attitudeCallbacks) {
          cb({ roll, pitch, yaw, rollSpeed: 0, pitchSpeed: 0, yawSpeed: 0, timestamp: ts })
        }
        break
      }

      // MSP_ANALOG(110): legacy battery telemetry
      case MSP.MSP_ANALOG: {
        if (payload.length < 7) break
        const voltage = u8(payload, 0) / 10  // decivolts
        const mah = u16(payload, 1)
        const rssi = u16(payload, 3)          // 0-1023
        const amps = i16(payload, 5) / 100    // centiamps
        for (const cb of this.batteryCallbacks) {
          cb({ voltage, current: amps, remaining: -1, consumed: mah, timestamp: ts })
        }
        // Also emit RC data with RSSI from analog
        for (const cb of this.rcCallbacks) {
          cb({ channels: [], rssi: Math.round(rssi / 1023 * 255), timestamp: ts })
        }
        break
      }

      // MSP_BATTERY_STATE(130): extended battery telemetry
      case MSP.MSP_BATTERY_STATE: {
        if (payload.length < 9) break
        const cellCount = u8(payload, 0)
        const capacity = u16(payload, 1)     // mAh
        const volts = u8(payload, 3) / 10    // legacy voltage (decivolts)
        const mahDrawn = u16(payload, 4)
        const amps2 = u16(payload, 6) / 100  // centiamps
        const batteryState = u8(payload, 8)  // 0=OK, 1=WARNING, 2=CRITICAL, 3=NOT_PRESENT

        // BF 4.1+ has 16-bit voltage at offset 9 (in centivolts)
        const voltage2 = payload.length >= 11 ? u16(payload, 9) / 100 : volts

        // Estimate remaining from cell count and voltage (rough)
        const perCell = cellCount > 0 ? voltage2 / cellCount : voltage2
        const remaining = cellCount > 0
          ? Math.max(0, Math.min(100, Math.round((perCell - 3.3) / (4.2 - 3.3) * 100)))
          : -1

        void batteryState
        void capacity

        for (const cb of this.batteryCallbacks) {
          cb({ voltage: voltage2, current: amps2, remaining, consumed: mahDrawn, timestamp: ts })
        }
        break
      }

      // MSP_STATUS_EX(150): flight status + mode flags
      case MSP.MSP_STATUS_EX: {
        if (payload.length < 15) break
        const cycleTime = u16(payload, 0)
        const i2cErrors = u16(payload, 2)
        const sensorFlags = u16(payload, 4)
        const modeFlags = u32(payload, 6)
        const _configProfile = u8(payload, 10)
        const cpuLoad = u16(payload, 11)

        void cycleTime
        void i2cErrors

        const { mode, armed } = resolveActiveMode(modeFlags, this.boxIds)

        if (this.vehicleInfo) {
          for (const cb of this.heartbeatCallbacks) {
            cb({ mode, armed, systemStatus: armed ? 4 : 3, vehicleInfo: this.vehicleInfo })
          }
        }

        for (const cb of this.sysStatusCallbacks) {
          cb({
            timestamp: ts,
            cpuLoad: cpuLoad / 10, // BF reports in 0.1% units
            sensorsPresent: sensorFlags,
            sensorsEnabled: sensorFlags,
            sensorsHealthy: sensorFlags,
            voltageMv: 0,
            currentCa: 0,
            batteryRemaining: -1,
            dropRateComm: 0,
            errorsComm: i2cErrors,
          })
        }
        break
      }

      // MSP_RC(105): RC channel values
      case MSP.MSP_RC: {
        const channelCount = Math.floor(payload.length / 2)
        const channels: number[] = []
        for (let i = 0; i < channelCount; i++) {
          channels.push(u16(payload, i * 2))
        }
        for (const cb of this.rcCallbacks) {
          cb({ channels, rssi: 0, timestamp: ts })
        }
        break
      }

      // MSP_MOTOR(104): motor outputs
      case MSP.MSP_MOTOR: {
        const motorCount = Math.floor(payload.length / 2)
        const motors: number[] = []
        for (let i = 0; i < motorCount; i++) {
          motors.push(u16(payload, i * 2))
        }
        for (const cb of this.servoOutputCallbacks) {
          cb({ timestamp: ts, port: 0, servos: motors })
        }
        break
      }

      // MSP_RAW_IMU(102): accelerometer + gyro + magnetometer
      case MSP.MSP_RAW_IMU: {
        if (payload.length < 18) break
        const xacc = i16(payload, 0)
        const yacc = i16(payload, 2)
        const zacc = i16(payload, 4)
        const xgyro = i16(payload, 6)
        const ygyro = i16(payload, 8)
        const zgyro = i16(payload, 10)
        const xmag = i16(payload, 12)
        const ymag = i16(payload, 14)
        const zmag = i16(payload, 16)
        for (const cb of this.rawImuCallbacks) {
          cb({ timestamp: ts, xacc, yacc, zacc, xgyro, ygyro, zgyro, xmag, ymag, zmag })
        }
        break
      }

      // MSP_ALTITUDE(109): estimated altitude
      case MSP.MSP_ALTITUDE: {
        if (payload.length < 6) break
        const altCm = i32(payload, 0)  // cm
        const varioCmS = i16(payload, 4) // cm/s
        const altM = altCm / 100
        const climbRate = varioCmS / 100

        for (const cb of this.altitudeCallbacks) {
          cb({
            timestamp: ts,
            altitudeMonotonic: altM,
            altitudeAmsl: 0,
            altitudeLocal: altM,
            altitudeRelative: altM,
            altitudeTerrain: 0,
            bottomClearance: 0,
          })
        }

        // Also feed VFR-like data
        for (const cb of this.vfrCallbacks) {
          cb({
            timestamp: ts,
            airspeed: 0,
            groundspeed: 0,
            heading: 0,
            throttle: 0,
            alt: altM,
            climb: climbRate,
          })
        }
        break
      }

      // MSP_RAW_GPS(106): GPS data
      case MSP.MSP_RAW_GPS: {
        if (payload.length < 16) break
        const fixType = u8(payload, 0)
        const numSat = u8(payload, 1)
        const lat = i32(payload, 2) / 1e7     // degrees
        const lon = i32(payload, 6) / 1e7
        const altGps = i16(payload, 10)         // meters
        const speed = u16(payload, 12)          // cm/s
        const groundCourse = u16(payload, 14)   // decidegrees

        for (const cb of this.gpsCallbacks) {
          cb({
            timestamp: ts,
            fixType,
            satellites: numSat,
            hdop: 0,
            lat,
            lon,
            alt: altGps,
          })
        }

        for (const cb of this.positionCallbacks) {
          cb({
            timestamp: ts,
            lat,
            lon,
            alt: altGps,
            relativeAlt: altGps,
            heading: groundCourse / 10,
            groundSpeed: speed / 100,
            airSpeed: 0,
            climbRate: 0,
          })
        }
        break
      }
    }
  }

  // ── Commands ──────────────────────────────────────────────

  async arm(): Promise<CommandResult> {
    if (!this.queue) return NOT_CONNECTED

    // Find the ARM box mode range
    const armBoxId = 0
    const armRange = findModeRange(this.modeRanges, armBoxId)

    if (!armRange) {
      // No ARM mode range configured; try MSP_SET_ARMING_DISABLED
      // Send ARMING_DISABLE with disable=0
      try {
        const payload = new Uint8Array(1)
        payload[0] = 0 // disable arming disable = enable arming
        await this.queue.send(MSP.MSP_ARMING_DISABLE, payload)
        return { success: true, resultCode: 0, message: 'Arming enabled via MSP' }
      } catch (err) {
        return { success: false, resultCode: -1, message: `Arm failed: ${err instanceof Error ? err.message : String(err)}` }
      }
    }

    // Set the AUX channel to the midpoint of the ARM range
    return this.setAuxChannel(armRange.auxChannel, Math.round((armRange.rangeStart + armRange.rangeEnd) / 2))
  }

  async disarm(): Promise<CommandResult> {
    if (!this.queue) return NOT_CONNECTED

    const armRange = findModeRange(this.modeRanges, 0)
    if (!armRange) {
      try {
        const payload = new Uint8Array(1)
        payload[0] = 1 // enable arming disable = disarm
        await this.queue.send(MSP.MSP_ARMING_DISABLE, payload)
        return { success: true, resultCode: 0, message: 'Disarmed via MSP' }
      } catch (err) {
        return { success: false, resultCode: -1, message: `Disarm failed: ${err instanceof Error ? err.message : String(err)}` }
      }
    }

    // Set AUX channel below the ARM range
    return this.setAuxChannel(armRange.auxChannel, 1000)
  }

  async setFlightMode(_mode: UnifiedFlightMode): Promise<CommandResult> {
    // Betaflight modes are activated by AUX channel positions, not direct commands.
    // A proper implementation would need to find the mode range for the requested
    // mode and set the appropriate AUX channel.
    return {
      success: false,
      resultCode: -1,
      message: 'Use AUX mode ranges to activate modes. Direct mode switching is not supported in MSP.',
    }
  }

  sendManualControl(
    roll: number,
    pitch: number,
    throttle: number,
    yaw: number,
    _buttons: number,
  ): void {
    if (!this.queue) return

    // Map from -1000..1000 to 1000..2000 PWM range
    // Channels: 0=roll, 1=pitch, 2=throttle, 3=yaw (standard AETR order)
    const payload = new Uint8Array(16) // 8 channels * 2 bytes
    writeU16(payload, 0, Math.round(roll / 2 + 1500))     // roll
    writeU16(payload, 2, Math.round(pitch / 2 + 1500))    // pitch
    writeU16(payload, 4, Math.round(throttle / 2 + 1500)) // throttle
    writeU16(payload, 6, Math.round(yaw / 2 + 1500))      // yaw
    // Channels 5-8 at midpoint (1500)
    writeU16(payload, 8, 1500)
    writeU16(payload, 10, 1500)
    writeU16(payload, 12, 1500)
    writeU16(payload, 14, 1500)

    this.queue.sendNoReply(MSP.MSP_SET_RAW_RC, payload)
  }

  async motorTest(motor: number, throttle: number, _duration: number): Promise<CommandResult> {
    if (!this.queue) return NOT_CONNECTED

    try {
      // MSP_SET_MOTOR: set all motors to 1000 (idle), then target motor to throttle
      const motorCount = 8 // max motors
      const payload = new Uint8Array(motorCount * 2)
      for (let i = 0; i < motorCount; i++) {
        const value = i === motor ? Math.round(1000 + (throttle / 100) * 1000) : 1000
        writeU16(payload, i * 2, value)
      }
      await this.queue.send(MSP.MSP_SET_MOTOR, payload)
      return { success: true, resultCode: 0, message: `Motor ${motor} set to ${throttle}%` }
    } catch (err) {
      return { success: false, resultCode: -1, message: `Motor test failed: ${err instanceof Error ? err.message : String(err)}` }
    }
  }

  async reboot(): Promise<CommandResult> {
    if (!this.queue) return NOT_CONNECTED
    try {
      const payload = new Uint8Array(1)
      payload[0] = 0 // type 0 = firmware reboot
      await this.queue.send(MSP.MSP_SET_REBOOT, payload)
      return { success: true, resultCode: 0, message: 'Rebooting firmware' }
    } catch (err) {
      return { success: false, resultCode: -1, message: `Reboot failed: ${err instanceof Error ? err.message : String(err)}` }
    }
  }

  async rebootToBootloader(): Promise<CommandResult> {
    if (!this.queue) return NOT_CONNECTED
    try {
      const payload = new Uint8Array(1)
      payload[0] = 1 // type 1 = bootloader
      await this.queue.send(MSP.MSP_SET_REBOOT, payload)
      return { success: true, resultCode: 0, message: 'Rebooting to bootloader' }
    } catch (err) {
      return { success: false, resultCode: -1, message: `Bootloader reboot failed: ${err instanceof Error ? err.message : String(err)}` }
    }
  }

  async startCalibration(
    type: 'accel' | 'gyro' | 'compass' | 'level' | 'airspeed' | 'baro' | 'rc' | 'esc' | 'compassmot',
  ): Promise<CommandResult> {
    if (!this.queue) return NOT_CONNECTED

    switch (type) {
      case 'accel':
      case 'level': {
        try {
          await this.queue.send(MSP.MSP_ACC_CALIBRATION)
          return { success: true, resultCode: 0, message: 'Accelerometer calibration started' }
        } catch (err) {
          return { success: false, resultCode: -1, message: `Accel cal failed: ${err instanceof Error ? err.message : String(err)}` }
        }
      }
      case 'compass': {
        try {
          await this.queue.send(MSP.MSP_MAG_CALIBRATION)
          return { success: true, resultCode: 0, message: 'Magnetometer calibration started' }
        } catch (err) {
          return { success: false, resultCode: -1, message: `Mag cal failed: ${err instanceof Error ? err.message : String(err)}` }
        }
      }
      default:
        return { success: false, resultCode: -1, message: `Calibration type '${type}' not supported by MSP` }
    }
  }

  async commitParamsToFlash(): Promise<CommandResult> {
    // CRITICAL: Betaflight does NOT auto-save like ArduPilot.
    // MSP_EEPROM_WRITE must be called explicitly.
    if (!this.queue) return NOT_CONNECTED
    try {
      await this.queue.send(MSP.MSP_EEPROM_WRITE)
      return { success: true, resultCode: 0, message: 'EEPROM saved' }
    } catch (err) {
      return { success: false, resultCode: -1, message: `EEPROM write failed: ${err instanceof Error ? err.message : String(err)}` }
    }
  }

  async killSwitch(): Promise<CommandResult> {
    if (!this.queue) return NOT_CONNECTED
    // Set throttle to minimum (885 = MOTOR_STOP threshold in BF)
    const payload = new Uint8Array(16)
    writeU16(payload, 0, 1500)  // roll
    writeU16(payload, 2, 1500)  // pitch
    writeU16(payload, 4, 885)   // throttle at MOTOR_STOP
    writeU16(payload, 6, 1500)  // yaw
    writeU16(payload, 8, 1000)  // AUX1 low (disarm)
    writeU16(payload, 10, 1000)
    writeU16(payload, 12, 1000)
    writeU16(payload, 14, 1000)
    this.queue.sendNoReply(MSP.MSP_SET_RAW_RC, payload)
    return { success: true, resultCode: 0, message: 'Kill switch activated' }
  }

  async doPreArmCheck(): Promise<CommandResult> {
    // MSP doesn't have a pre-arm check command. We can read status flags.
    if (!this.queue) return NOT_CONNECTED
    try {
      const frame = await this.queue.send(MSP.MSP_STATUS_EX)
      const payload = frame.payload
      if (payload.length < 15) {
        return { success: false, resultCode: -1, message: 'Invalid status response' }
      }
      // Check arming disable flags (at offset 13, 2 bytes in BF 4.x)
      const armingDisableFlags = payload.length >= 17 ? u32(payload, 13) : u16(payload, 13)
      if (armingDisableFlags === 0) {
        return { success: true, resultCode: 0, message: 'Pre-arm checks passed' }
      }
      return { success: false, resultCode: -1, message: `Arming disabled: flags=0x${armingDisableFlags.toString(16)}` }
    } catch (err) {
      return { success: false, resultCode: -1, message: `Pre-arm check failed: ${err instanceof Error ? err.message : String(err)}` }
    }
  }

  // ── Unsupported Commands ──────────────────────────────────

  async returnToLaunch(): Promise<CommandResult> { return NOT_SUPPORTED }
  async land(): Promise<CommandResult> { return NOT_SUPPORTED }
  async takeoff(_altitude: number): Promise<CommandResult> { return NOT_SUPPORTED }
  async guidedGoto(_lat: number, _lon: number, _alt: number): Promise<CommandResult> { return NOT_SUPPORTED }
  async pauseMission(): Promise<CommandResult> { return NOT_SUPPORTED }
  async resumeMission(): Promise<CommandResult> { return NOT_SUPPORTED }
  async clearMission(): Promise<CommandResult> { return NOT_SUPPORTED }
  async setHome(_useCurrent: boolean): Promise<CommandResult> { return NOT_SUPPORTED }
  async changeSpeed(_speedType: number, _speed: number): Promise<CommandResult> { return NOT_SUPPORTED }
  async setYaw(_angle: number, _speed: number, _direction: number, _relative: boolean): Promise<CommandResult> { return NOT_SUPPORTED }
  async setGeoFenceEnabled(_enabled: boolean): Promise<CommandResult> { return NOT_SUPPORTED }
  async setServo(_servoNumber: number, _pwm: number): Promise<CommandResult> { return NOT_SUPPORTED }
  async cameraTrigger(): Promise<CommandResult> { return NOT_SUPPORTED }
  async setGimbalAngle(_pitch: number, _roll: number, _yaw: number): Promise<CommandResult> { return NOT_SUPPORTED }
  async uploadMission(_items: MissionItem[]): Promise<CommandResult> { return NOT_SUPPORTED }
  async downloadMission(): Promise<MissionItem[]> { return [] }
  async setCurrentMissionItem(_seq: number): Promise<CommandResult> { return NOT_SUPPORTED }
  async resetParametersToDefault(): Promise<CommandResult> { return NOT_SUPPORTED }

  // ── Log Operations (unsupported) ──────────────────────────

  async getLogList(): Promise<LogEntry[]> { return [] }
  async downloadLog(_logId: number, _onProgress?: LogDownloadProgressCallback): Promise<Uint8Array> {
    return new Uint8Array(0)
  }
  async eraseAllLogs(): Promise<CommandResult> { return NOT_SUPPORTED }
  cancelLogDownload(): void { /* no-op */ }

  // ── Parameters (Virtual Param System) ─────────────────────

  async getAllParameters(): Promise<ParameterValue[]> {
    if (!this.queue) return []

    // MSP doesn't have named parameters. We read all config MSP commands
    // and create virtual parameter entries from the binary payloads.
    // For now, return a basic set from the most common config commands.
    const configCommands = [
      MSP.MSP_PID,              // 112 - PID values
      MSP.MSP_RC_TUNING,        // 111 - RC rates/expo
      MSP.MSP_BATTERY_CONFIG,   // 32  - battery config
      MSP.MSP_MOTOR_CONFIG,     // 131 - motor config
      MSP.MSP_FAILSAFE_CONFIG,  // 75  - failsafe
      MSP.MSP_ARMING_CONFIG,    // 61  - arming config
      MSP.MSP_ADVANCED_CONFIG,  // 90  - advanced config
      MSP.MSP_FILTER_CONFIG,    // 92  - filter config
      MSP.MSP_PID_ADVANCED,     // 94  - PID advanced
      MSP.MSP_FEATURE_CONFIG,   // 36  - feature flags
      MSP.MSP_RX_CONFIG,        // 44  - receiver config
    ]

    for (const cmd of configCommands) {
      try {
        const frame = await this.queue.send(cmd)
        this.paramCache.set(cmd, frame.payload)
      } catch {
        // Timeout on this command; skip
      }
    }

    const results = this.buildVirtualParams()
    this.paramNameCache = results.map(p => p.name)

    // Notify parameter callbacks
    for (const param of results) {
      for (const cb of this.parameterCallbacks) {
        cb(param)
      }
    }

    return results
  }

  async getParameter(name: string): Promise<ParameterValue> {
    if (!this.queue) throw new Error('Not connected')

    const def = this.findVirtualParam(name)
    if (!def) throw new Error(`Unknown parameter: ${name}`)

    // Check cache first
    let payload = this.paramCache.get(def.readCmd)
    if (!payload) {
      const frame = await this.queue.send(def.readCmd)
      payload = frame.payload
      this.paramCache.set(def.readCmd, payload)
    }

    const value = def.decode(payload)
    return {
      name,
      value,
      type: 9, // MAV_PARAM_TYPE_REAL32 (convention for virtual params)
      index: 0,
      count: this.paramNameCache.length || 1,
    }
  }

  async setParameter(name: string, value: number, _type?: number): Promise<CommandResult> {
    if (!this.queue) return NOT_CONNECTED

    const def = this.findVirtualParam(name)
    if (!def) {
      return { success: false, resultCode: -1, message: `Unknown parameter: ${name}` }
    }

    // Read current payload to preserve other fields
    let existing = this.paramCache.get(def.readCmd)
    if (!existing) {
      try {
        const frame = await this.queue.send(def.readCmd)
        existing = frame.payload
        this.paramCache.set(def.readCmd, existing)
      } catch (err) {
        return { success: false, resultCode: -1, message: `Read failed: ${err instanceof Error ? err.message : String(err)}` }
      }
    }

    // Patch new value into the payload
    const newPayload = def.encode(value, existing)

    // Send write command
    try {
      await this.queue.send(def.writeCmd, newPayload)
      // Update cache with written payload
      this.paramCache.set(def.readCmd, newPayload)
      return { success: true, resultCode: 0, message: 'OK' }
    } catch (err) {
      return { success: false, resultCode: -1, message: `Write failed: ${err instanceof Error ? err.message : String(err)}` }
    }
  }

  getCachedParameterNames(): string[] {
    return this.paramNameCache
  }

  // ── Serial Passthrough (CLI) ──────────────────────────────

  sendSerialData(text: string): void {
    if (!this.transport) return

    // If not in CLI mode, send '#\n' first to enter CLI
    if (!this.inCliMode) {
      const enterCli = new TextEncoder().encode('#\n')
      this.transport.send(enterCli)
      this.inCliMode = true
    }

    // Send text directly via transport (NOT through MSP frame)
    const data = new TextEncoder().encode(text)
    this.transport.send(data)
  }

  // ── Telemetry Subscription Methods ────────────────────────
  // Same pattern as MAVLinkAdapter: push callback, return unsub function.

  onAttitude(cb: AttitudeCallback): () => void {
    this.attitudeCallbacks.push(cb)
    return () => { this.attitudeCallbacks = this.attitudeCallbacks.filter(c => c !== cb) }
  }
  onPosition(cb: PositionCallback): () => void {
    this.positionCallbacks.push(cb)
    return () => { this.positionCallbacks = this.positionCallbacks.filter(c => c !== cb) }
  }
  onBattery(cb: BatteryCallback): () => void {
    this.batteryCallbacks.push(cb)
    return () => { this.batteryCallbacks = this.batteryCallbacks.filter(c => c !== cb) }
  }
  onGps(cb: GpsCallback): () => void {
    this.gpsCallbacks.push(cb)
    return () => { this.gpsCallbacks = this.gpsCallbacks.filter(c => c !== cb) }
  }
  onVfr(cb: VfrCallback): () => void {
    this.vfrCallbacks.push(cb)
    return () => { this.vfrCallbacks = this.vfrCallbacks.filter(c => c !== cb) }
  }
  onRc(cb: RcCallback): () => void {
    this.rcCallbacks.push(cb)
    return () => { this.rcCallbacks = this.rcCallbacks.filter(c => c !== cb) }
  }
  onStatusText(cb: StatusTextCallback): () => void {
    this.statusTextCallbacks.push(cb)
    return () => { this.statusTextCallbacks = this.statusTextCallbacks.filter(c => c !== cb) }
  }
  onHeartbeat(cb: HeartbeatCallback): () => void {
    this.heartbeatCallbacks.push(cb)
    return () => { this.heartbeatCallbacks = this.heartbeatCallbacks.filter(c => c !== cb) }
  }
  onParameter(cb: ParameterCallback): () => void {
    this.parameterCallbacks.push(cb)
    return () => { this.parameterCallbacks = this.parameterCallbacks.filter(c => c !== cb) }
  }
  onSerialData(cb: SerialDataCallback): () => void {
    this.serialDataCallbacks.push(cb)
    // Wire parser CLI output to serial data callback
    this.parser.onCliData((text) => {
      const data = new TextEncoder().encode(text)
      cb({ device: 0, data })
    })
    return () => { this.serialDataCallbacks = this.serialDataCallbacks.filter(c => c !== cb) }
  }
  onSysStatus(cb: SysStatusCallback): () => void {
    this.sysStatusCallbacks.push(cb)
    return () => { this.sysStatusCallbacks = this.sysStatusCallbacks.filter(c => c !== cb) }
  }
  onRadio(cb: RadioCallback): () => void {
    this.radioCallbacks.push(cb)
    return () => { this.radioCallbacks = this.radioCallbacks.filter(c => c !== cb) }
  }
  onMissionProgress(cb: MissionProgressCallback): () => void {
    this.missionProgressCallbacks.push(cb)
    return () => { this.missionProgressCallbacks = this.missionProgressCallbacks.filter(c => c !== cb) }
  }
  onEkf(cb: EkfCallback): () => void {
    this.ekfCallbacks.push(cb)
    return () => { this.ekfCallbacks = this.ekfCallbacks.filter(c => c !== cb) }
  }
  onVibration(cb: VibrationCallback): () => void {
    this.vibrationCallbacks.push(cb)
    return () => { this.vibrationCallbacks = this.vibrationCallbacks.filter(c => c !== cb) }
  }
  onServoOutput(cb: ServoOutputCallback): () => void {
    this.servoOutputCallbacks.push(cb)
    return () => { this.servoOutputCallbacks = this.servoOutputCallbacks.filter(c => c !== cb) }
  }
  onWind(cb: WindCallback): () => void {
    this.windCallbacks.push(cb)
    return () => { this.windCallbacks = this.windCallbacks.filter(c => c !== cb) }
  }
  onTerrain(cb: TerrainCallback): () => void {
    this.terrainCallbacks.push(cb)
    return () => { this.terrainCallbacks = this.terrainCallbacks.filter(c => c !== cb) }
  }
  onMagCalProgress(cb: MagCalProgressCallback): () => void {
    this.magCalProgressCallbacks.push(cb)
    return () => { this.magCalProgressCallbacks = this.magCalProgressCallbacks.filter(c => c !== cb) }
  }
  onMagCalReport(cb: MagCalReportCallback): () => void {
    this.magCalReportCallbacks.push(cb)
    return () => { this.magCalReportCallbacks = this.magCalReportCallbacks.filter(c => c !== cb) }
  }
  onAccelCalPos(cb: AccelCalPosCallback): () => void {
    this.accelCalPosCallbacks.push(cb)
    return () => { this.accelCalPosCallbacks = this.accelCalPosCallbacks.filter(c => c !== cb) }
  }
  onHomePosition(cb: HomePositionCallback): () => void {
    this.homePositionCallbacks.push(cb)
    return () => { this.homePositionCallbacks = this.homePositionCallbacks.filter(c => c !== cb) }
  }
  onAutopilotVersion(cb: AutopilotVersionCallback): () => void {
    this.autopilotVersionCallbacks.push(cb)
    return () => { this.autopilotVersionCallbacks = this.autopilotVersionCallbacks.filter(c => c !== cb) }
  }
  onPowerStatus(cb: PowerStatusCallback): () => void {
    this.powerStatusCallbacks.push(cb)
    return () => { this.powerStatusCallbacks = this.powerStatusCallbacks.filter(c => c !== cb) }
  }
  onDistanceSensor(cb: DistanceSensorCallback): () => void {
    this.distanceSensorCallbacks.push(cb)
    return () => { this.distanceSensorCallbacks = this.distanceSensorCallbacks.filter(c => c !== cb) }
  }
  onFenceStatus(cb: FenceStatusCallback): () => void {
    this.fenceStatusCallbacks.push(cb)
    return () => { this.fenceStatusCallbacks = this.fenceStatusCallbacks.filter(c => c !== cb) }
  }
  onNavController(cb: NavControllerCallback): () => void {
    this.navControllerCallbacks.push(cb)
    return () => { this.navControllerCallbacks = this.navControllerCallbacks.filter(c => c !== cb) }
  }
  onScaledImu(cb: ScaledImuCallback): () => void {
    this.scaledImuCallbacks.push(cb)
    return () => { this.scaledImuCallbacks = this.scaledImuCallbacks.filter(c => c !== cb) }
  }
  onScaledPressure(cb: ScaledPressureCallback): () => void {
    this.scaledPressureCallbacks.push(cb)
    return () => { this.scaledPressureCallbacks = this.scaledPressureCallbacks.filter(c => c !== cb) }
  }
  onEstimatorStatus(cb: EstimatorStatusCallback): () => void {
    this.estimatorStatusCallbacks.push(cb)
    return () => { this.estimatorStatusCallbacks = this.estimatorStatusCallbacks.filter(c => c !== cb) }
  }
  onCameraTrigger(cb: CameraTriggerCallback): () => void {
    this.cameraTriggerCallbacks.push(cb)
    return () => { this.cameraTriggerCallbacks = this.cameraTriggerCallbacks.filter(c => c !== cb) }
  }
  onLinkLost(cb: LinkStateCallback): () => void {
    this.linkLostCallbacks.push(cb)
    return () => { this.linkLostCallbacks = this.linkLostCallbacks.filter(c => c !== cb) }
  }
  onLinkRestored(cb: LinkStateCallback): () => void {
    this.linkRestoredCallbacks.push(cb)
    return () => { this.linkRestoredCallbacks = this.linkRestoredCallbacks.filter(c => c !== cb) }
  }
  onLocalPosition(cb: LocalPositionCallback): () => void {
    this.localPositionCallbacks.push(cb)
    return () => { this.localPositionCallbacks = this.localPositionCallbacks.filter(c => c !== cb) }
  }
  onDebug(cb: DebugCallback): () => void {
    this.debugCallbacks.push(cb)
    return () => { this.debugCallbacks = this.debugCallbacks.filter(c => c !== cb) }
  }
  onGimbalAttitude(cb: GimbalAttitudeCallback): () => void {
    this.gimbalAttitudeCallbacks.push(cb)
    return () => { this.gimbalAttitudeCallbacks = this.gimbalAttitudeCallbacks.filter(c => c !== cb) }
  }
  onObstacleDistance(cb: ObstacleDistanceCallback): () => void {
    this.obstacleDistanceCallbacks.push(cb)
    return () => { this.obstacleDistanceCallbacks = this.obstacleDistanceCallbacks.filter(c => c !== cb) }
  }
  onCameraImageCaptured(cb: CameraImageCapturedCallback): () => void {
    this.cameraImageCallbacks.push(cb)
    return () => { this.cameraImageCallbacks = this.cameraImageCallbacks.filter(c => c !== cb) }
  }
  onExtendedSysState(cb: ExtendedSysStateCallback): () => void {
    this.extendedSysStateCallbacks.push(cb)
    return () => { this.extendedSysStateCallbacks = this.extendedSysStateCallbacks.filter(c => c !== cb) }
  }
  onFencePoint(cb: FencePointCallback): () => void {
    this.fencePointCallbacks.push(cb)
    return () => { this.fencePointCallbacks = this.fencePointCallbacks.filter(c => c !== cb) }
  }
  onSystemTime(cb: SystemTimeCallback): () => void {
    this.systemTimeCallbacks.push(cb)
    return () => { this.systemTimeCallbacks = this.systemTimeCallbacks.filter(c => c !== cb) }
  }
  onRawImu(cb: RawImuCallback): () => void {
    this.rawImuCallbacks.push(cb)
    return () => { this.rawImuCallbacks = this.rawImuCallbacks.filter(c => c !== cb) }
  }
  onRcChannelsRaw(cb: RcChannelsRawCallback): () => void {
    this.rcChannelsRawCallbacks.push(cb)
    return () => { this.rcChannelsRawCallbacks = this.rcChannelsRawCallbacks.filter(c => c !== cb) }
  }
  onRcChannelsOverride(cb: RcChannelsOverrideCallback): () => void {
    this.rcChannelsOverrideCallbacks.push(cb)
    return () => { this.rcChannelsOverrideCallbacks = this.rcChannelsOverrideCallbacks.filter(c => c !== cb) }
  }
  onMissionItem(cb: MissionItemCallback): () => void {
    this.missionItemCallbacks.push(cb)
    return () => { this.missionItemCallbacks = this.missionItemCallbacks.filter(c => c !== cb) }
  }
  onAltitude(cb: AltitudeCallback): () => void {
    this.altitudeCallbacks.push(cb)
    return () => { this.altitudeCallbacks = this.altitudeCallbacks.filter(c => c !== cb) }
  }
  onWindCov(cb: WindCovCallback): () => void {
    this.windCovCallbacks.push(cb)
    return () => { this.windCovCallbacks = this.windCovCallbacks.filter(c => c !== cb) }
  }
  onAisVessel(cb: AisVesselCallback): () => void {
    this.aisVesselCallbacks.push(cb)
    return () => { this.aisVesselCallbacks = this.aisVesselCallbacks.filter(c => c !== cb) }
  }
  onGimbalManagerInfo(cb: GimbalManagerInfoCallback): () => void {
    this.gimbalManagerInfoCallbacks.push(cb)
    return () => { this.gimbalManagerInfoCallbacks = this.gimbalManagerInfoCallbacks.filter(c => c !== cb) }
  }
  onGimbalManagerStatus(cb: GimbalManagerStatusCallback): () => void {
    this.gimbalManagerStatusCallbacks.push(cb)
    return () => { this.gimbalManagerStatusCallbacks = this.gimbalManagerStatusCallbacks.filter(c => c !== cb) }
  }

  // ── Info ──────────────────────────────────────────────────

  getVehicleInfo(): VehicleInfo | null { return this.vehicleInfo }

  getCapabilities(): ProtocolCapabilities {
    return this.firmwareHandler?.getCapabilities() ?? {
      supportsArming: false, supportsFlightModes: false, supportsMissionUpload: false,
      supportsMissionDownload: false, supportsManualControl: false, supportsParameters: false,
      supportsCalibration: false, supportsSerialPassthrough: false, supportsMotorTest: false,
      supportsGeoFence: false, supportsRally: false, supportsLogDownload: false,
      supportsOsd: false, supportsPidTuning: false, supportsPorts: false,
      supportsFailsafe: false, supportsPowerConfig: false, supportsReceiver: false,
      supportsFirmwareFlash: false, supportsCliShell: false, supportsMavlinkInspector: false,
      supportsGimbal: false, supportsCamera: false, supportsLed: false,
      supportsBattery2: false, supportsRangefinder: false, supportsOpticalFlow: false,
      supportsObstacleAvoidance: false, supportsDebugValues: false,
      supportsAuxModes: false, supportsVtx: false, supportsBlackbox: false,
      supportsBetaflightConfig: false, supportsGpsConfig: false,
      supportsRateProfiles: false, supportsAdjustments: false,
      manualControlHz: 50, parameterCount: 0,
    }
  }

  getFirmwareHandler(): FirmwareHandler | null { return this.firmwareHandler }

  // ── Internal Helpers ──────────────────────────────────────

  /**
   * Set an AUX channel to a specific PWM value via MSP_SET_RAW_RC.
   * AUX1 = channel 4 (index 4 in RC array), AUX2 = channel 5, etc.
   */
  private async setAuxChannel(auxIndex: number, pwmValue: number): Promise<CommandResult> {
    if (!this.queue) return NOT_CONNECTED

    // Build RC payload with current stick positions at midpoint and target AUX channel
    const channelCount = 8
    const payload = new Uint8Array(channelCount * 2)

    // Sticks at midpoint / idle
    writeU16(payload, 0, 1500) // roll
    writeU16(payload, 2, 1500) // pitch
    writeU16(payload, 4, 1000) // throttle (low)
    writeU16(payload, 6, 1500) // yaw

    // AUX channels at 1000 (inactive) by default
    for (let i = 4; i < channelCount; i++) {
      writeU16(payload, i * 2, 1000)
    }

    // Set the target AUX channel
    const channelIndex = auxIndex + 4 // AUX1=4, AUX2=5, ...
    if (channelIndex < channelCount) {
      writeU16(payload, channelIndex * 2, pwmValue)
    }

    this.queue.sendNoReply(MSP.MSP_SET_RAW_RC, payload)
    return { success: true, resultCode: 0, message: `AUX${auxIndex + 1} set to ${pwmValue}` }
  }

  // ── Virtual Parameter System ──────────────────────────────

  /**
   * Virtual parameter definition.
   * Maps a human-readable param name to read/write MSP commands
   * and byte offsets within the binary payload.
   */
  private static readonly VIRTUAL_PARAMS: VirtualParamDef[] = [
    // PID values (MSP_PID = 112, MSP_SET_PID = 202)
    // Payload: 3 bytes per axis * 3 axes = 9 bytes minimum
    // Order: Roll P,I,D, Pitch P,I,D, Yaw P,I,D
    { name: 'PID_ROLL_P', readCmd: MSP.MSP_PID, writeCmd: MSP.MSP_SET_PID, offset: 0, size: 1 },
    { name: 'PID_ROLL_I', readCmd: MSP.MSP_PID, writeCmd: MSP.MSP_SET_PID, offset: 1, size: 1 },
    { name: 'PID_ROLL_D', readCmd: MSP.MSP_PID, writeCmd: MSP.MSP_SET_PID, offset: 2, size: 1 },
    { name: 'PID_PITCH_P', readCmd: MSP.MSP_PID, writeCmd: MSP.MSP_SET_PID, offset: 3, size: 1 },
    { name: 'PID_PITCH_I', readCmd: MSP.MSP_PID, writeCmd: MSP.MSP_SET_PID, offset: 4, size: 1 },
    { name: 'PID_PITCH_D', readCmd: MSP.MSP_PID, writeCmd: MSP.MSP_SET_PID, offset: 5, size: 1 },
    { name: 'PID_YAW_P', readCmd: MSP.MSP_PID, writeCmd: MSP.MSP_SET_PID, offset: 6, size: 1 },
    { name: 'PID_YAW_I', readCmd: MSP.MSP_PID, writeCmd: MSP.MSP_SET_PID, offset: 7, size: 1 },
    { name: 'PID_YAW_D', readCmd: MSP.MSP_PID, writeCmd: MSP.MSP_SET_PID, offset: 8, size: 1 },

    // RC tuning (MSP_RC_TUNING = 111, MSP_SET_RC_TUNING = 204)
    { name: 'RC_RATE', readCmd: MSP.MSP_RC_TUNING, writeCmd: MSP.MSP_SET_RC_TUNING, offset: 0, size: 1 },
    { name: 'RC_EXPO', readCmd: MSP.MSP_RC_TUNING, writeCmd: MSP.MSP_SET_RC_TUNING, offset: 1, size: 1 },
    { name: 'ROLL_RATE', readCmd: MSP.MSP_RC_TUNING, writeCmd: MSP.MSP_SET_RC_TUNING, offset: 2, size: 1 },
    { name: 'PITCH_RATE', readCmd: MSP.MSP_RC_TUNING, writeCmd: MSP.MSP_SET_RC_TUNING, offset: 3, size: 1 },
    { name: 'YAW_RATE', readCmd: MSP.MSP_RC_TUNING, writeCmd: MSP.MSP_SET_RC_TUNING, offset: 4, size: 1 },
    { name: 'TPA_RATE', readCmd: MSP.MSP_RC_TUNING, writeCmd: MSP.MSP_SET_RC_TUNING, offset: 5, size: 1 },
    { name: 'TPA_BREAKPOINT', readCmd: MSP.MSP_RC_TUNING, writeCmd: MSP.MSP_SET_RC_TUNING, offset: 6, size: 2 },

    // Battery config (MSP_BATTERY_CONFIG = 32, MSP_SET_BATTERY_CONFIG = 33)
    { name: 'VBAT_MINCELLVOLTAGE', readCmd: MSP.MSP_BATTERY_CONFIG, writeCmd: MSP.MSP_SET_BATTERY_CONFIG, offset: 0, size: 1 },
    { name: 'VBAT_MAXCELLVOLTAGE', readCmd: MSP.MSP_BATTERY_CONFIG, writeCmd: MSP.MSP_SET_BATTERY_CONFIG, offset: 1, size: 1 },
    { name: 'VBAT_WARNINGCELLVOLTAGE', readCmd: MSP.MSP_BATTERY_CONFIG, writeCmd: MSP.MSP_SET_BATTERY_CONFIG, offset: 2, size: 1 },
    { name: 'BATTERY_CAPACITY', readCmd: MSP.MSP_BATTERY_CONFIG, writeCmd: MSP.MSP_SET_BATTERY_CONFIG, offset: 3, size: 2 },

    // Motor config (MSP_MOTOR_CONFIG = 131, MSP_SET_MOTOR_CONFIG = 222)
    { name: 'MINTHROTTLE', readCmd: MSP.MSP_MOTOR_CONFIG, writeCmd: MSP.MSP_SET_MOTOR_CONFIG, offset: 0, size: 2 },
    { name: 'MAXTHROTTLE', readCmd: MSP.MSP_MOTOR_CONFIG, writeCmd: MSP.MSP_SET_MOTOR_CONFIG, offset: 2, size: 2 },
    { name: 'MINCOMMAND', readCmd: MSP.MSP_MOTOR_CONFIG, writeCmd: MSP.MSP_SET_MOTOR_CONFIG, offset: 4, size: 2 },

    // Failsafe (MSP_FAILSAFE_CONFIG = 75, MSP_SET_FAILSAFE_CONFIG = 76)
    { name: 'FAILSAFE_DELAY', readCmd: MSP.MSP_FAILSAFE_CONFIG, writeCmd: MSP.MSP_SET_FAILSAFE_CONFIG, offset: 0, size: 1 },
    { name: 'FAILSAFE_OFF_DELAY', readCmd: MSP.MSP_FAILSAFE_CONFIG, writeCmd: MSP.MSP_SET_FAILSAFE_CONFIG, offset: 1, size: 1 },
    { name: 'FAILSAFE_THROTTLE', readCmd: MSP.MSP_FAILSAFE_CONFIG, writeCmd: MSP.MSP_SET_FAILSAFE_CONFIG, offset: 2, size: 2 },
    { name: 'FAILSAFE_PROCEDURE', readCmd: MSP.MSP_FAILSAFE_CONFIG, writeCmd: MSP.MSP_SET_FAILSAFE_CONFIG, offset: 4, size: 1 },

    // Arming config (MSP_ARMING_CONFIG = 61, MSP_SET_ARMING_CONFIG = 62)
    { name: 'AUTO_DISARM_DELAY', readCmd: MSP.MSP_ARMING_CONFIG, writeCmd: MSP.MSP_SET_ARMING_CONFIG, offset: 0, size: 1 },
    { name: 'DISARM_KILL_SWITCH', readCmd: MSP.MSP_ARMING_CONFIG, writeCmd: MSP.MSP_SET_ARMING_CONFIG, offset: 1, size: 1 },

    // Feature flags (MSP_FEATURE_CONFIG = 36, MSP_SET_FEATURE_CONFIG = 37)
    { name: 'FEATURE_FLAGS', readCmd: MSP.MSP_FEATURE_CONFIG, writeCmd: MSP.MSP_SET_FEATURE_CONFIG, offset: 0, size: 4 },
  ]

  private findVirtualParam(name: string): ResolvedVirtualParam | undefined {
    const def = MSPAdapter.VIRTUAL_PARAMS.find(p => p.name === name)
    if (!def) return undefined

    return {
      ...def,
      decode: (payload: Uint8Array): number => {
        if (def.size === 1) return u8(payload, def.offset)
        if (def.size === 2) return u16(payload, def.offset)
        if (def.size === 4) return u32(payload, def.offset)
        return u8(payload, def.offset)
      },
      encode: (value: number, existing: Uint8Array): Uint8Array => {
        const copy = new Uint8Array(existing)
        if (def.size === 1) {
          copy[def.offset] = value & 0xff
        } else if (def.size === 2) {
          writeU16(copy, def.offset, value)
        } else if (def.size === 4) {
          copy[def.offset] = value & 0xff
          copy[def.offset + 1] = (value >> 8) & 0xff
          copy[def.offset + 2] = (value >> 16) & 0xff
          copy[def.offset + 3] = (value >> 24) & 0xff
        }
        return copy
      },
    }
  }

  private buildVirtualParams(): ParameterValue[] {
    const results: ParameterValue[] = []
    const total = MSPAdapter.VIRTUAL_PARAMS.length

    for (let i = 0; i < total; i++) {
      const def = MSPAdapter.VIRTUAL_PARAMS[i]
      const payload = this.paramCache.get(def.readCmd)
      if (!payload || def.offset >= payload.length) continue

      let value: number
      if (def.size === 1) {
        value = u8(payload, def.offset)
      } else if (def.size === 2) {
        value = u16(payload, def.offset)
      } else if (def.size === 4) {
        value = u32(payload, def.offset)
      } else {
        value = u8(payload, def.offset)
      }

      results.push({ name: def.name, value, type: 9, index: i, count: total })
    }

    return results
  }
}

// ── Virtual Param Types ─────────────────────────────────────

interface VirtualParamDef {
  name: string
  readCmd: number
  writeCmd: number
  offset: number
  size: 1 | 2 | 4
}

interface ResolvedVirtualParam extends VirtualParamDef {
  decode: (payload: Uint8Array) => number
  encode: (value: number, existing: Uint8Array) => Uint8Array
}
