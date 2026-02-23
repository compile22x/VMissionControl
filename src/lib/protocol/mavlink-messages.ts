/**
 * Typed MAVLink v2 message decoders.
 *
 * Each function takes the payload `DataView` from a parsed `MAVLinkFrame`
 * (little-endian, zero-restored) and returns a typed object. Field offsets
 * match the MAVLink common.xml message definitions.
 *
 * All multi-byte reads use little-endian (`true` as the second argument
 * to DataView getters).
 *
 * @module protocol/mavlink-messages
 */

// ── HEARTBEAT (ID 0) ───────────────────────────────────────

export interface HeartbeatMsg {
  customMode: number;
  type: number;
  autopilot: number;
  baseMode: number;
  systemStatus: number;
  mavlinkVersion: number;
}

/**
 * Decode HEARTBEAT (msg ID 0).
 *
 * | Offset | Type   | Field           |
 * |--------|--------|-----------------|
 * | 0      | uint32 | customMode      |
 * | 4      | uint8  | type            |
 * | 5      | uint8  | autopilot       |
 * | 6      | uint8  | baseMode        |
 * | 7      | uint8  | systemStatus    |
 * | 8      | uint8  | mavlinkVersion  |
 */
export function decodeHeartbeat(dv: DataView): HeartbeatMsg {
  return {
    customMode: dv.getUint32(0, true),
    type: dv.getUint8(4),
    autopilot: dv.getUint8(5),
    baseMode: dv.getUint8(6),
    systemStatus: dv.getUint8(7),
    mavlinkVersion: dv.getUint8(8),
  };
}

// ── SYS_STATUS (ID 1) ──────────────────────────────────────

export interface SysStatusMsg {
  onboardControlSensorsPresent: number;
  onboardControlSensorsEnabled: number;
  onboardControlSensorsHealth: number;
  load: number;
  voltageBattery: number;
  currentBattery: number;
  batteryRemaining: number;
  dropRateComm: number;
  errorsComm: number;
}

/**
 * Decode SYS_STATUS (msg ID 1).
 *
 * | Offset | Type   | Field                          |
 * |--------|--------|--------------------------------|
 * | 0      | uint32 | onboardControlSensorsPresent   |
 * | 4      | uint32 | onboardControlSensorsEnabled   |
 * | 8      | uint32 | onboardControlSensorsHealth    |
 * | 12     | uint16 | load                           |
 * | 14     | uint16 | voltageBattery (mV)            |
 * | 16     | int16  | currentBattery (cA, 10*mA)     |
 * | 18     | int8   | batteryRemaining (%)           |
 * | 19     | uint16 | dropRateComm                   |
 * | 21     | uint16 | errorsComm                     |
 */
export function decodeSysStatus(dv: DataView): SysStatusMsg {
  return {
    onboardControlSensorsPresent: dv.getUint32(0, true),
    onboardControlSensorsEnabled: dv.getUint32(4, true),
    onboardControlSensorsHealth: dv.getUint32(8, true),
    load: dv.getUint16(12, true),
    voltageBattery: dv.getUint16(14, true),
    currentBattery: dv.getInt16(16, true),
    batteryRemaining: dv.getInt8(18),
    dropRateComm: dv.getUint16(19, true),
    errorsComm: dv.getUint16(21, true),
  };
}

// ── ATTITUDE (ID 30) ───────────────────────────────────────

export interface AttitudeMsg {
  timeBootMs: number;
  roll: number;
  pitch: number;
  yaw: number;
  rollspeed: number;
  pitchspeed: number;
  yawspeed: number;
}

/**
 * Decode ATTITUDE (msg ID 30).
 *
 * | Offset | Type    | Field       |
 * |--------|---------|-------------|
 * | 0      | uint32  | timeBootMs  |
 * | 4      | float32 | roll (rad)  |
 * | 8      | float32 | pitch (rad) |
 * | 12     | float32 | yaw (rad)   |
 * | 16     | float32 | rollspeed   |
 * | 20     | float32 | pitchspeed  |
 * | 24     | float32 | yawspeed    |
 */
export function decodeAttitude(dv: DataView): AttitudeMsg {
  return {
    timeBootMs: dv.getUint32(0, true),
    roll: dv.getFloat32(4, true),
    pitch: dv.getFloat32(8, true),
    yaw: dv.getFloat32(12, true),
    rollspeed: dv.getFloat32(16, true),
    pitchspeed: dv.getFloat32(20, true),
    yawspeed: dv.getFloat32(24, true),
  };
}

// ── GPS_RAW_INT (ID 24) ────────────────────────────────────

export interface GpsRawIntMsg {
  timeUsec: number;
  fixType: number;
  lat: number;
  lon: number;
  alt: number;
  eph: number;
  epv: number;
  vel: number;
  cog: number;
  satellitesVisible: number;
}

/**
 * Decode GPS_RAW_INT (msg ID 24).
 *
 * | Offset | Type   | Field             |
 * |--------|--------|-------------------|
 * | 0      | uint64 | timeUsec          |
 * | 8      | int32  | lat (degE7)       |
 * | 12     | int32  | lon (degE7)       |
 * | 16     | int32  | alt (mm MSL)      |
 * | 20     | uint16 | eph (cm)          |
 * | 22     | uint16 | epv (cm)          |
 * | 24     | uint16 | vel (cm/s)        |
 * | 26     | uint16 | cog (cdeg)        |
 * | 28     | uint8  | fixType           |
 * | 29     | uint8  | satellitesVisible |
 */
export function decodeGpsRawInt(dv: DataView): GpsRawIntMsg {
  // timeUsec is uint64 — read as two uint32 and combine (safe up to 2^53)
  const low = dv.getUint32(0, true);
  const high = dv.getUint32(4, true);
  return {
    timeUsec: high * 0x100000000 + low,
    lat: dv.getInt32(8, true),
    lon: dv.getInt32(12, true),
    alt: dv.getInt32(16, true),
    eph: dv.getUint16(20, true),
    epv: dv.getUint16(22, true),
    vel: dv.getUint16(24, true),
    cog: dv.getUint16(26, true),
    fixType: dv.getUint8(28),
    satellitesVisible: dv.getUint8(29),
  };
}

// ── GLOBAL_POSITION_INT (ID 33) ────────────────────────────

export interface GlobalPositionIntMsg {
  timeBootMs: number;
  lat: number;
  lon: number;
  alt: number;
  relativeAlt: number;
  vx: number;
  vy: number;
  vz: number;
  hdg: number;
}

/**
 * Decode GLOBAL_POSITION_INT (msg ID 33).
 *
 * | Offset | Type   | Field       |
 * |--------|--------|-------------|
 * | 0      | uint32 | timeBootMs  |
 * | 4      | int32  | lat (degE7) |
 * | 8      | int32  | lon (degE7) |
 * | 12     | int32  | alt (mm)    |
 * | 16     | int32  | relativeAlt |
 * | 20     | int16  | vx (cm/s)   |
 * | 22     | int16  | vy (cm/s)   |
 * | 24     | int16  | vz (cm/s)   |
 * | 26     | uint16 | hdg (cdeg)  |
 */
export function decodeGlobalPositionInt(dv: DataView): GlobalPositionIntMsg {
  return {
    timeBootMs: dv.getUint32(0, true),
    lat: dv.getInt32(4, true),
    lon: dv.getInt32(8, true),
    alt: dv.getInt32(12, true),
    relativeAlt: dv.getInt32(16, true),
    vx: dv.getInt16(20, true),
    vy: dv.getInt16(22, true),
    vz: dv.getInt16(24, true),
    hdg: dv.getUint16(26, true),
  };
}

// ── RC_CHANNELS (ID 65) ────────────────────────────────────

export interface RcChannelsMsg {
  timeBootMs: number;
  chancount: number;
  channels: number[];
  rssi: number;
}

/**
 * Decode RC_CHANNELS (msg ID 65).
 *
 * | Offset | Type   | Field       |
 * |--------|--------|-------------|
 * | 0      | uint32 | timeBootMs  |
 * | 4      | uint8  | chancount   |
 * | 5      | uint16 | chan1_raw    |
 * | 7      | uint16 | chan2_raw    |
 * | ...    | ...    | ...         |
 * | 39     | uint16 | chan18_raw   |
 * | 41     | uint8  | rssi        |
 */
export function decodeRcChannels(dv: DataView): RcChannelsMsg {
  const chancount = dv.getUint8(4);
  const channels: number[] = [];
  for (let i = 0; i < 18; i++) {
    channels.push(dv.getUint16(5 + i * 2, true));
  }
  return {
    timeBootMs: dv.getUint32(0, true),
    chancount,
    channels,
    rssi: dv.getUint8(41),
  };
}

// ── VFR_HUD (ID 74) ────────────────────────────────────────

export interface VfrHudMsg {
  airspeed: number;
  groundspeed: number;
  heading: number;
  throttle: number;
  alt: number;
  climb: number;
}

/**
 * Decode VFR_HUD (msg ID 74).
 *
 * | Offset | Type    | Field       |
 * |--------|---------|-------------|
 * | 0      | float32 | airspeed    |
 * | 4      | float32 | groundspeed |
 * | 8      | int16   | heading     |
 * | 10     | uint16  | throttle    |
 * | 12     | float32 | alt         |
 * | 16     | float32 | climb       |
 */
export function decodeVfrHud(dv: DataView): VfrHudMsg {
  return {
    airspeed: dv.getFloat32(0, true),
    groundspeed: dv.getFloat32(4, true),
    heading: dv.getInt16(8, true),
    throttle: dv.getUint16(10, true),
    alt: dv.getFloat32(12, true),
    climb: dv.getFloat32(16, true),
  };
}

// ── COMMAND_ACK (ID 77) ────────────────────────────────────

export interface CommandAckMsg {
  command: number;
  result: number;
}

/**
 * Decode COMMAND_ACK (msg ID 77).
 *
 * | Offset | Type   | Field   |
 * |--------|--------|---------|
 * | 0      | uint16 | command |
 * | 2      | uint8  | result  |
 */
export function decodeCommandAck(dv: DataView): CommandAckMsg {
  return {
    command: dv.getUint16(0, true),
    result: dv.getUint8(2),
  };
}

// ── PARAM_VALUE (ID 22) ────────────────────────────────────

export interface ParamValueMsg {
  paramValue: number;
  paramCount: number;
  paramIndex: number;
  paramId: string;
  paramType: number;
}

/**
 * Decode PARAM_VALUE (msg ID 22).
 *
 * | Offset | Type     | Field      |
 * |--------|----------|------------|
 * | 0      | float32  | paramValue |
 * | 4      | uint16   | paramCount |
 * | 6      | uint16   | paramIndex |
 * | 8      | char[16] | paramId    |
 * | 24     | uint8    | paramType  |
 */
export function decodeParamValue(dv: DataView): ParamValueMsg {
  // Extract null-terminated param ID
  const bytes = new Uint8Array(dv.buffer, dv.byteOffset + 8, 16);
  let end = bytes.indexOf(0);
  if (end === -1) end = 16;
  const paramId = new TextDecoder().decode(bytes.subarray(0, end));

  return {
    paramValue: dv.getFloat32(0, true),
    paramCount: dv.getUint16(4, true),
    paramIndex: dv.getUint16(6, true),
    paramId,
    paramType: dv.getUint8(24),
  };
}

// ── BATTERY_STATUS (ID 147) ────────────────────────────────

export interface BatteryStatusMsg {
  id: number;
  batteryFunction: number;
  type: number;
  temperature: number;
  voltages: number[];
  currentBattery: number;
  currentConsumed: number;
  energyConsumed: number;
  batteryRemaining: number;
}

/**
 * Decode BATTERY_STATUS (msg ID 147).
 *
 * | Offset | Type        | Field            |
 * |--------|-------------|------------------|
 * | 0      | uint8       | id               |
 * | 1      | uint8       | batteryFunction  |
 * | 2      | uint8       | type             |
 * | 3      | int16       | temperature (cC) |
 * | 5      | uint16[10]  | voltages (mV)    |
 * | 25     | int16       | currentBattery   |
 * | 27     | int32       | currentConsumed  |
 * | 31     | int32       | energyConsumed   |
 * | 35     | int8        | batteryRemaining |
 */
export function decodeBatteryStatus(dv: DataView): BatteryStatusMsg {
  const voltages: number[] = [];
  for (let i = 0; i < 10; i++) {
    voltages.push(dv.getUint16(5 + i * 2, true));
  }

  return {
    id: dv.getUint8(0),
    batteryFunction: dv.getUint8(1),
    type: dv.getUint8(2),
    temperature: dv.getInt16(3, true),
    voltages,
    currentBattery: dv.getInt16(25, true),
    currentConsumed: dv.getInt32(27, true),
    energyConsumed: dv.getInt32(31, true),
    batteryRemaining: dv.getInt8(35),
  };
}

// ── STATUSTEXT (ID 253) ────────────────────────────────────

export interface StatustextMsg {
  severity: number;
  text: string;
}

/**
 * Decode STATUSTEXT (msg ID 253).
 *
 * | Offset | Type     | Field    |
 * |--------|----------|----------|
 * | 0      | uint8    | severity |
 * | 1      | char[50] | text     |
 */
export function decodeStatustext(dv: DataView): StatustextMsg {
  const bytes = new Uint8Array(dv.buffer, dv.byteOffset + 1, 50);
  let end = bytes.indexOf(0);
  if (end === -1) end = 50;
  const text = new TextDecoder().decode(bytes.subarray(0, end));

  return {
    severity: dv.getUint8(0),
    text,
  };
}

// ── MISSION_ACK (ID 47) ────────────────────────────────────

export interface MissionAckMsg {
  targetSystem: number;
  targetComponent: number;
  type: number;
}

/**
 * Decode MISSION_ACK (msg ID 47).
 *
 * | Offset | Type  | Field           |
 * |--------|-------|-----------------|
 * | 0      | uint8 | targetSystem    |
 * | 1      | uint8 | targetComponent |
 * | 2      | uint8 | type            |
 */
export function decodeMissionAck(dv: DataView): MissionAckMsg {
  return {
    targetSystem: dv.getUint8(0),
    targetComponent: dv.getUint8(1),
    type: dv.getUint8(2),
  };
}

// ── SERIAL_CONTROL (ID 126) ─────────────────────────────────

export interface SerialControlMsg {
  baudrate: number;
  timeout: number;
  device: number;
  flags: number;
  count: number;
  data: Uint8Array;
}

/**
 * Decode SERIAL_CONTROL (msg ID 126).
 *
 * | Offset | Type      | Field    |
 * |--------|-----------|----------|
 * | 0      | uint32    | baudrate |
 * | 4      | uint16    | timeout  |
 * | 6      | uint8     | device   |
 * | 7      | uint8     | flags    |
 * | 8      | uint8     | count    |
 * | 9      | uint8[70] | data     |
 */
export function decodeSerialControl(dv: DataView): SerialControlMsg {
  const count = dv.getUint8(8);
  const data = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    data[i] = dv.getUint8(9 + i);
  }
  return {
    baudrate: dv.getUint32(0, true),
    timeout: dv.getUint16(4, true),
    device: dv.getUint8(6),
    flags: dv.getUint8(7),
    count,
    data,
  };
}

// ── MISSION_REQUEST_INT (ID 51) ─────────────────────────────

export interface MissionRequestIntMsg {
  targetSystem: number;
  targetComponent: number;
  seq: number;
}

/**
 * Decode MISSION_REQUEST_INT (msg ID 51).
 *
 * | Offset | Type   | Field           |
 * |--------|--------|-----------------|
 * | 0      | uint16 | seq             |
 * | 2      | uint8  | targetSystem    |
 * | 3      | uint8  | targetComponent |
 */
export function decodeMissionRequestInt(dv: DataView): MissionRequestIntMsg {
  return {
    seq: dv.getUint16(0, true),
    targetSystem: dv.getUint8(2),
    targetComponent: dv.getUint8(3),
  };
}
