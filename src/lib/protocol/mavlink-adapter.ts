/**
 * MAVLink v2 protocol adapter for Altnautica Command GCS.
 *
 * Central class that implements the `DroneProtocol` interface, tying together
 * the parser, encoder, message decoders, command queue, and firmware handler.
 * Connects to a flight controller via any Transport, parses incoming MAVLink
 * frames, dispatches telemetry to subscribers, and exposes a high-level
 * command API (arm, disarm, mode, mission, params, calibration, etc.).
 *
 * @module protocol/mavlink-adapter
 */

import type {
  DroneProtocol, Transport, VehicleInfo, CommandResult, ParameterValue,
  MissionItem, FirmwareHandler, ProtocolCapabilities, UnifiedFlightMode,
  AttitudeCallback, PositionCallback, BatteryCallback, GpsCallback,
  VfrCallback, RcCallback, StatusTextCallback, HeartbeatCallback,
  ParameterCallback, SerialDataCallback,
} from './types'
import { MAVLinkParser, type MAVLinkFrame } from './mavlink-parser'
import {
  encodeHeartbeat, encodeManualControl,
  encodeSetMode, encodeParamRequestList, encodeParamSet,
  encodeMissionCount, encodeMissionItemInt, encodeSerialControl,
} from './mavlink-encoder'
import {
  decodeHeartbeat, decodeAttitude, decodeGlobalPositionInt,
  decodeBatteryStatus, decodeGpsRawInt, decodeVfrHud,
  decodeRcChannels, decodeCommandAck, decodeParamValue,
  decodeStatustext, decodeMissionAck, decodeMissionRequestInt,
  decodeSerialControl,
} from './mavlink-messages'
import { CommandQueue } from './command-queue'
import { createFirmwareHandler } from './firmware-ardupilot'

export class MAVLinkAdapter implements DroneProtocol {
  readonly protocolName = 'mavlink'

  private parser = new MAVLinkParser()
  private commandQueue = new CommandQueue(3000)
  private transport: Transport | null = null
  private firmwareHandler: FirmwareHandler | null = null
  private vehicleInfo: VehicleInfo | null = null

  private targetSysId = 1
  private targetCompId = 1
  private sysId = 255      // GCS system ID
  private compId = 190      // GCS component ID (MAV_COMP_ID_MISSIONPLANNER)

  private _connected = false
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null
  private dataHandler: ((data: Uint8Array) => void) | null = null
  private closeHandler: (() => void) | null = null

  // Callback subscriber arrays
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

  // Parameter download state
  private parameterDownload: {
    params: Map<number, ParameterValue>
    total: number
    resolve: (params: ParameterValue[]) => void
    reject: (err: Error) => void
    timer: ReturnType<typeof setTimeout>
  } | null = null

  // Mission upload state
  private missionUpload: {
    items: MissionItem[]
    resolve: (result: CommandResult) => void
    reject: (err: Error) => void
    timer: ReturnType<typeof setTimeout>
  } | null = null

  get isConnected(): boolean { return this._connected }

  // ── Connection ─────────────────────────────────────────

  async connect(transport: Transport): Promise<VehicleInfo> {
    this.transport = transport

    // Subscribe to transport data → feed to parser
    this.dataHandler = (data: Uint8Array) => this.parser.feed(data)
    this.closeHandler = () => this.handleDisconnect()
    transport.on('data', this.dataHandler)
    transport.on('close', this.closeHandler as (data: void) => void)

    // Subscribe to parsed frames (permanent handler)
    this.parser.onFrame((frame) => this.handleFrame(frame))

    // Wait for first HEARTBEAT with a 10-second timeout
    const vehicleInfo = await new Promise<VehicleInfo>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('No heartbeat received within 10 seconds')), 10000)

      // Temporary heartbeat listener — resolves once and unsubs
      const unsub = this.parser.onFrame((frame) => {
        if (frame.msgId === 0) { // HEARTBEAT
          const hb = decodeHeartbeat(frame.payload)
          if (hb.type === 6) return // Ignore GCS heartbeats

          clearTimeout(timeout)
          unsub()

          this.targetSysId = frame.systemId
          this.targetCompId = frame.componentId
          this.firmwareHandler = createFirmwareHandler(hb.autopilot, hb.type)

          const info: VehicleInfo = {
            firmwareType: this.firmwareHandler.firmwareType,
            vehicleClass: this.firmwareHandler.vehicleClass,
            firmwareVersionString: this.firmwareHandler.getFirmwareVersion(),
            systemId: frame.systemId,
            componentId: frame.componentId,
            autopilotType: hb.autopilot,
            vehicleType: hb.type,
          }
          this.vehicleInfo = info
          resolve(info)
        }
      })
    })

    this._connected = true

    // Start GCS heartbeat at 1 Hz
    this.heartbeatInterval = setInterval(() => {
      if (this.transport?.isConnected) {
        this.transport.send(encodeHeartbeat(this.sysId, this.compId))
      }
    }, 1000)
    // Send first heartbeat immediately
    this.transport.send(encodeHeartbeat(this.sysId, this.compId))

    return vehicleInfo
  }

  async disconnect(): Promise<void> {
    this.handleDisconnect()
    if (this.transport?.isConnected) {
      await this.transport.disconnect()
    }
  }

  private handleDisconnect(): void {
    this._connected = false
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
    this.commandQueue.clear()
    this.parser.reset()
    if (this.transport && this.dataHandler) {
      this.transport.off('data', this.dataHandler)
      this.transport.off('close', this.closeHandler as (data: void) => void)
    }
    this.transport = null
  }

  // ── Frame Routing ──────────────────────────────────────

  private handleFrame(frame: MAVLinkFrame): void {
    switch (frame.msgId) {
      case 0:   this.handleHeartbeat(frame); break
      case 30:  this.handleAttitude(frame); break
      case 33:  this.handleGlobalPosition(frame); break
      case 147: this.handleBattery(frame); break
      case 24:  this.handleGpsRaw(frame); break
      case 74:  this.handleVfrHud(frame); break
      case 65:  this.handleRcChannels(frame); break
      case 77:  this.handleCommandAck(frame); break
      case 22:  this.handleParamValue(frame); break
      case 253: this.handleStatusText(frame); break
      case 47:  this.handleMissionAck(frame); break
      case 51:  this.handleMissionRequest(frame); break
      case 126: this.handleSerialControl(frame); break
    }
  }

  // ── Message Handlers ───────────────────────────────────

  private handleHeartbeat(frame: MAVLinkFrame): void {
    const hb = decodeHeartbeat(frame.payload)
    if (hb.type === 6) return // Ignore GCS heartbeats

    const armed = (hb.baseMode & 0x80) !== 0 // MAV_MODE_FLAG_SAFETY_ARMED
    const mode = this.firmwareHandler?.decodeFlightMode(hb.customMode) ?? 'UNKNOWN'

    for (const cb of this.heartbeatCallbacks) {
      cb({
        armed,
        mode,
        systemStatus: hb.systemStatus,
        vehicleInfo: this.vehicleInfo!,
      })
    }
  }

  private handleAttitude(frame: MAVLinkFrame): void {
    const data = decodeAttitude(frame.payload)
    const RAD_TO_DEG = 180 / Math.PI
    for (const cb of this.attitudeCallbacks) {
      cb({
        timestamp: Date.now(),
        roll: data.roll * RAD_TO_DEG,
        pitch: data.pitch * RAD_TO_DEG,
        yaw: data.yaw * RAD_TO_DEG,
        rollSpeed: data.rollspeed,
        pitchSpeed: data.pitchspeed,
        yawSpeed: data.yawspeed,
      })
    }
  }

  private handleGlobalPosition(frame: MAVLinkFrame): void {
    const data = decodeGlobalPositionInt(frame.payload)
    for (const cb of this.positionCallbacks) {
      cb({
        timestamp: Date.now(),
        lat: data.lat / 1e7,
        lon: data.lon / 1e7,
        alt: data.alt / 1000,           // mm → m
        relativeAlt: data.relativeAlt / 1000,
        heading: data.hdg / 100,         // cdeg → deg
        groundSpeed: Math.sqrt(data.vx * data.vx + data.vy * data.vy) / 100, // cm/s → m/s
        airSpeed: 0, // Not in this message — comes from VFR_HUD
        climbRate: -data.vz / 100,       // cm/s → m/s (NED, so negate)
      })
    }
  }

  private handleBattery(frame: MAVLinkFrame): void {
    const data = decodeBatteryStatus(frame.payload)
    // Sum valid cell voltages (0xFFFF = cell not used)
    const totalVoltage = data.voltages
      .filter(v => v !== 0xFFFF)
      .reduce((sum, v) => sum + v, 0) / 1000 // mV → V

    for (const cb of this.batteryCallbacks) {
      cb({
        timestamp: Date.now(),
        voltage: totalVoltage,
        current: data.currentBattery / 100,      // cA → A
        remaining: data.batteryRemaining,          // already %
        consumed: data.currentConsumed,            // mAh
      })
    }
  }

  private handleGpsRaw(frame: MAVLinkFrame): void {
    const data = decodeGpsRawInt(frame.payload)
    for (const cb of this.gpsCallbacks) {
      cb({
        timestamp: Date.now(),
        fixType: data.fixType,
        satellites: data.satellitesVisible,
        hdop: data.eph / 100,        // cm → m
        lat: data.lat / 1e7,
        lon: data.lon / 1e7,
        alt: data.alt / 1000,        // mm → m
      })
    }
  }

  private handleVfrHud(frame: MAVLinkFrame): void {
    const data = decodeVfrHud(frame.payload)
    for (const cb of this.vfrCallbacks) {
      cb({
        timestamp: Date.now(),
        airspeed: data.airspeed,
        groundspeed: data.groundspeed,
        heading: data.heading,
        throttle: data.throttle,
        alt: data.alt,
        climb: data.climb,
      })
    }
  }

  private handleRcChannels(frame: MAVLinkFrame): void {
    const data = decodeRcChannels(frame.payload)
    for (const cb of this.rcCallbacks) {
      cb({
        timestamp: Date.now(),
        channels: data.channels.slice(0, data.chancount),
        rssi: data.rssi,
      })
    }
  }

  private handleCommandAck(frame: MAVLinkFrame): void {
    const ack = decodeCommandAck(frame.payload)
    this.commandQueue.handleAck(ack.command, ack.result)
  }

  private handleParamValue(frame: MAVLinkFrame): void {
    const pv = decodeParamValue(frame.payload)
    const param: ParameterValue = {
      name: pv.paramId,
      value: pv.paramValue,
      type: pv.paramType,
      index: pv.paramIndex,
      count: pv.paramCount,
    }

    // Notify subscribers
    for (const cb of this.parameterCallbacks) cb(param)

    // If downloading all params, accumulate
    if (this.parameterDownload) {
      this.parameterDownload.total = pv.paramCount
      this.parameterDownload.params.set(pv.paramIndex, param)

      if (this.parameterDownload.params.size >= pv.paramCount) {
        clearTimeout(this.parameterDownload.timer)
        const params = Array.from(this.parameterDownload.params.values())
          .sort((a, b) => a.index - b.index)
        this.parameterDownload.resolve(params)
        this.parameterDownload = null
      }
    }
  }

  private handleStatusText(frame: MAVLinkFrame): void {
    const st = decodeStatustext(frame.payload)
    for (const cb of this.statusTextCallbacks) cb(st)
  }

  private handleMissionAck(frame: MAVLinkFrame): void {
    const ack = decodeMissionAck(frame.payload)
    if (this.missionUpload) {
      clearTimeout(this.missionUpload.timer)
      this.missionUpload.resolve({
        success: ack.type === 0, // MAV_MISSION_ACCEPTED
        resultCode: ack.type,
        message: ack.type === 0 ? 'Mission accepted' : `Mission rejected: type ${ack.type}`,
      })
      this.missionUpload = null
    }
  }

  private handleMissionRequest(frame: MAVLinkFrame): void {
    const req = decodeMissionRequestInt(frame.payload)
    if (this.missionUpload && req.seq < this.missionUpload.items.length) {
      const item = this.missionUpload.items[req.seq]
      const encoded = encodeMissionItemInt(
        this.targetSysId, this.targetCompId,
        item.seq, item.frame, item.command, item.current, item.autocontinue,
        item.param1, item.param2, item.param3, item.param4,
        item.x, item.y, item.z,
        this.sysId, this.compId,
      )
      this.transport?.send(encoded)
    }
  }

  private handleSerialControl(frame: MAVLinkFrame): void {
    const sc = decodeSerialControl(frame.payload)
    for (const cb of this.serialDataCallbacks) {
      cb({ device: sc.device, data: sc.data })
    }
  }

  // ── Commands ───────────────────────────────────────────

  async arm(): Promise<CommandResult> {
    return this.sendCommandLong(400, [1, 0, 0, 0, 0, 0, 0]) // MAV_CMD_COMPONENT_ARM_DISARM
  }

  async disarm(): Promise<CommandResult> {
    return this.sendCommandLong(400, [0, 0, 0, 0, 0, 0, 0])
  }

  async setFlightMode(mode: UnifiedFlightMode): Promise<CommandResult> {
    if (!this.firmwareHandler) {
      return { success: false, resultCode: -1, message: 'No firmware handler' }
    }
    const { baseMode, customMode } = this.firmwareHandler.encodeFlightMode(mode)
    const frame = encodeSetMode(this.targetSysId, baseMode, customMode, this.sysId, this.compId)
    this.transport?.send(frame)
    // SET_MODE doesn't get a COMMAND_ACK — confirm via next HEARTBEAT
    return { success: true, resultCode: 0, message: 'Mode change sent' }
  }

  async returnToLaunch(): Promise<CommandResult> {
    return this.sendCommandLong(20, [0, 0, 0, 0, 0, 0, 0]) // MAV_CMD_NAV_RETURN_TO_LAUNCH
  }

  async land(): Promise<CommandResult> {
    return this.sendCommandLong(21, [0, 0, 0, 0, 0, 0, 0]) // MAV_CMD_NAV_LAND
  }

  async takeoff(altitude: number): Promise<CommandResult> {
    return this.sendCommandLong(22, [0, 0, 0, 0, 0, 0, altitude]) // MAV_CMD_NAV_TAKEOFF
  }

  sendManualControl(roll: number, pitch: number, throttle: number, yaw: number, buttons: number): void {
    if (!this.transport?.isConnected) return
    // Convert -1..1 to -1000..1000 for axes, 0..1 to 0..1000 for throttle
    const x = Math.round(pitch * 1000)
    const y = Math.round(roll * 1000)
    const z = Math.round(throttle * 1000)
    const r = Math.round(yaw * 1000)
    this.transport.send(encodeManualControl(this.targetSysId, x, y, z, r, buttons, this.sysId, this.compId))
  }

  // ── Parameters ─────────────────────────────────────────

  async getAllParameters(): Promise<ParameterValue[]> {
    if (!this.transport?.isConnected) throw new Error('Not connected')

    return new Promise<ParameterValue[]>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.parameterDownload) {
          // Resolve with what we have so far
          const params = Array.from(this.parameterDownload.params.values())
            .sort((a, b) => a.index - b.index)
          this.parameterDownload = null
          resolve(params)
        } else {
          reject(new Error('Parameter download timed out'))
        }
      }, 30000) // 30 second timeout for all params

      this.parameterDownload = {
        params: new Map(),
        total: 0,
        resolve,
        reject,
        timer,
      }

      this.transport!.send(encodeParamRequestList(this.targetSysId, this.targetCompId, this.sysId, this.compId))
    })
  }

  async getParameter(_name: string): Promise<ParameterValue> {
    // TODO: Implement PARAM_REQUEST_READ for single parameter fetch
    throw new Error('getParameter not yet implemented — use getAllParameters')
  }

  async setParameter(name: string, value: number, type = 9): Promise<CommandResult> {
    if (!this.transport?.isConnected) return { success: false, resultCode: -1, message: 'Not connected' }

    return new Promise<CommandResult>((resolve) => {
      const timer = setTimeout(() => {
        resolve({ success: false, resultCode: -1, message: `Param set timed out: ${name}` })
      }, 3000)

      // Listen for PARAM_VALUE echo as confirmation
      const unsub = this.onParameter((param) => {
        if (param.name === name) {
          clearTimeout(timer)
          unsub()
          resolve({
            success: Math.abs(param.value - value) < 0.001,
            resultCode: 0,
            message: `Parameter ${name} = ${param.value}`,
          })
        }
      })

      this.transport!.send(encodeParamSet(this.targetSysId, this.targetCompId, name, value, type, this.sysId, this.compId))
    })
  }

  // ── Mission ────────────────────────────────────────────

  async uploadMission(items: MissionItem[]): Promise<CommandResult> {
    if (!this.transport?.isConnected) return { success: false, resultCode: -1, message: 'Not connected' }

    return new Promise<CommandResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.missionUpload = null
        resolve({ success: false, resultCode: -1, message: 'Mission upload timed out' })
      }, 15000)

      this.missionUpload = { items, resolve, reject, timer }

      // Send MISSION_COUNT to initiate upload handshake
      this.transport!.send(encodeMissionCount(this.targetSysId, this.targetCompId, items.length, this.sysId, this.compId))
    })
  }

  async downloadMission(): Promise<MissionItem[]> {
    // TODO: Implement mission download protocol (MISSION_REQUEST_LIST → MISSION_COUNT → MISSION_REQUEST_INT loop)
    throw new Error('Mission download not yet implemented')
  }

  async setCurrentMissionItem(seq: number): Promise<CommandResult> {
    return this.sendCommandLong(224, [seq, 0, 0, 0, 0, 0, 0]) // MAV_CMD_DO_SET_MISSION_CURRENT
  }

  // ── Calibration ────────────────────────────────────────

  async startCalibration(type: 'accel' | 'gyro' | 'compass' | 'level' | 'airspeed'): Promise<CommandResult> {
    // MAV_CMD_PREFLIGHT_CALIBRATION = 241
    const params: [number, number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0, 0]
    switch (type) {
      case 'gyro':     params[0] = 1; break
      case 'compass':  params[1] = 1; break
      case 'accel':    params[4] = 1; break
      case 'level':    params[4] = 2; break
      case 'airspeed': params[4] = 4; break
    }
    return this.sendCommandLong(241, params)
  }

  // ── Motor Test ─────────────────────────────────────────

  async motorTest(motor: number, throttle: number, duration: number): Promise<CommandResult> {
    return this.sendCommandLong(209, [motor, 0, throttle, duration, 0, 0, 0]) // MAV_CMD_DO_MOTOR_TEST
  }

  // ── Reboot ─────────────────────────────────────────────

  async rebootToBootloader(): Promise<CommandResult> {
    return this.sendCommandLong(246, [3, 0, 0, 0, 0, 0, 0]) // MAV_CMD_PREFLIGHT_REBOOT_SHUTDOWN, param1=3=bootloader
  }

  async reboot(): Promise<CommandResult> {
    return this.sendCommandLong(246, [1, 0, 0, 0, 0, 0, 0]) // param1=1=normal reboot
  }

  // ── Serial Passthrough ───────────────────────────────

  sendSerialData(text: string): void {
    if (!this.transport?.isConnected) return
    const encoder = new TextEncoder()
    const bytes = encoder.encode(text + '\n')
    // device=10 (SERIAL_CONTROL_DEV_SHELL), flags=6 (RESPOND|EXCLUSIVE), timeout=500ms, baudrate=0
    this.transport.send(encodeSerialControl(10, 6, 500, 0, bytes, this.sysId, this.compId))
  }

  // ── Telemetry Subscriptions ────────────────────────────

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
    return () => { this.serialDataCallbacks = this.serialDataCallbacks.filter(c => c !== cb) }
  }

  // ── Info ────────────────────────────────────────────────

  getVehicleInfo(): VehicleInfo | null { return this.vehicleInfo }

  getCapabilities(): ProtocolCapabilities {
    return this.firmwareHandler?.getCapabilities() ?? {
      supportsArming: false, supportsFlightModes: false, supportsMissionUpload: false,
      supportsMissionDownload: false, supportsManualControl: false, supportsParameters: false,
      supportsCalibration: false, supportsSerialPassthrough: false, supportsMotorTest: false,
      supportsGeoFence: false, supportsRally: false, supportsLogDownload: false,
    }
  }

  getFirmwareHandler(): FirmwareHandler | null { return this.firmwareHandler }

  // ── Helpers ────────────────────────────────────────────

  private sendCommandLong(command: number, params: [number, number, number, number, number, number, number]): Promise<CommandResult> {
    if (!this.transport?.isConnected) {
      return Promise.resolve({ success: false, resultCode: -1, message: 'Not connected' })
    }
    return this.commandQueue.sendCommand(
      command, params,
      (data) => this.transport!.send(data),
      this.targetSysId, this.targetCompId,
      this.sysId, this.compId,
    )
  }
}
