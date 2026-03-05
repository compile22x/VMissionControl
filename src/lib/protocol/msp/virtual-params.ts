/**
 * Virtual parameter registry for MSP protocol.
 *
 * Maps MSP binary config data to named "virtual parameters" so the existing
 * `usePanelParams` hook works unchanged for Betaflight/iNav panels.
 *
 * Each virtual param knows:
 * - Which MSP command to read/write
 * - How to extract its value from the read response payload
 * - How to patch its value into a write payload (for sending back)
 *
 * Pure data + pure functions. No side effects.
 *
 * @module protocol/msp/virtual-params
 */

// ── MSP Command IDs (inline literals matching msp-constants.ts) ──

// Read commands
const MSP_BATTERY_CONFIG = 32;
const MSP_FEATURE_CONFIG = 36;
const MSP_ARMING_CONFIG = 61;
const MSP_FAILSAFE_CONFIG = 75;
const MSP_BLACKBOX_CONFIG = 80;
const MSP_VTX_CONFIG = 88;
const MSP_ADVANCED_CONFIG = 90;
const MSP_FILTER_CONFIG = 92;
const MSP_RC_TUNING = 111;
const MSP_PID = 112;
const MSP_MOTOR_CONFIG = 131;
const MSP_GPS_CONFIG = 132;
const MSP_GPS_RESCUE = 135;
const MSP_BEEPER_CONFIG = 184;

// Write commands
const MSP_SET_BATTERY_CONFIG = 33;
const MSP_SET_FEATURE_CONFIG = 37;
const MSP_SET_ARMING_CONFIG = 62;
const MSP_SET_FAILSAFE_CONFIG = 76;
const MSP_SET_BLACKBOX_CONFIG = 81;
const MSP_SET_VTX_CONFIG = 89;
const MSP_SET_ADVANCED_CONFIG = 91;
const MSP_SET_FILTER_CONFIG = 93;
const MSP_SET_PID = 202;
const MSP_SET_RC_TUNING = 204;
const MSP_SET_MOTOR_CONFIG = 222;
const MSP_SET_GPS_CONFIG = 223;
const MSP_SET_GPS_RESCUE = 225;
const MSP_SET_BEEPER_CONFIG = 185;

// ── Types ────────────────────────────────────────────────────

export interface VirtualParamDef {
  /** MSP command to read this param's value */
  readCmd: number;
  /** MSP command to write this param's value */
  writeCmd: number;
  /** Extract this param's value from the read response payload */
  decode: (payload: Uint8Array) => number;
  /** Patch this param's value into a write payload. Returns new payload. */
  encode: (value: number, existingPayload: Uint8Array) => Uint8Array;
  /** Data type for UI hints */
  type: 'uint8' | 'uint16' | 'int16' | 'uint32' | 'float';
  min?: number;
  max?: number;
  description?: string;
}

// ── Payload read/write helpers ───────────────────────────────

function getU8(payload: Uint8Array, offset: number): number {
  return payload[offset] ?? 0;
}

function getU16(payload: Uint8Array, offset: number): number {
  return (payload[offset] ?? 0) | ((payload[offset + 1] ?? 0) << 8);
}

function getS16(payload: Uint8Array, offset: number): number {
  const val = getU16(payload, offset);
  return val > 0x7fff ? val - 0x10000 : val;
}

function getU32(payload: Uint8Array, offset: number): number {
  return (
    ((payload[offset] ?? 0) |
      ((payload[offset + 1] ?? 0) << 8) |
      ((payload[offset + 2] ?? 0) << 16) |
      ((payload[offset + 3] ?? 0) << 24)) >>>
    0
  );
}

function setU8(payload: Uint8Array, offset: number, val: number): Uint8Array {
  const out = new Uint8Array(payload);
  out[offset] = val & 0xff;
  return out;
}

function setU16(payload: Uint8Array, offset: number, val: number): Uint8Array {
  const out = new Uint8Array(payload);
  out[offset] = val & 0xff;
  out[offset + 1] = (val >> 8) & 0xff;
  return out;
}

function setU32(payload: Uint8Array, offset: number, val: number): Uint8Array {
  const out = new Uint8Array(payload);
  const v = val >>> 0;
  out[offset] = v & 0xff;
  out[offset + 1] = (v >> 8) & 0xff;
  out[offset + 2] = (v >> 16) & 0xff;
  out[offset + 3] = (v >> 24) & 0xff;
  return out;
}

// ── Helper factories ─────────────────────────────────────────

function u8Param(
  readCmd: number,
  writeCmd: number,
  readOffset: number,
  writeOffset: number,
  description?: string,
  min?: number,
  max?: number,
): VirtualParamDef {
  return {
    readCmd,
    writeCmd,
    decode: (p) => getU8(p, readOffset),
    encode: (v, p) => setU8(p, writeOffset, v),
    type: 'uint8',
    min,
    max,
    description,
  };
}

function u16Param(
  readCmd: number,
  writeCmd: number,
  readOffset: number,
  writeOffset: number,
  description?: string,
  min?: number,
  max?: number,
): VirtualParamDef {
  return {
    readCmd,
    writeCmd,
    decode: (p) => getU16(p, readOffset),
    encode: (v, p) => setU16(p, writeOffset, v),
    type: 'uint16',
    min,
    max,
    description,
  };
}

function u32Param(
  readCmd: number,
  writeCmd: number,
  readOffset: number,
  writeOffset: number,
  description?: string,
): VirtualParamDef {
  return {
    readCmd,
    writeCmd,
    decode: (p) => getU32(p, readOffset),
    encode: (v, p) => setU32(p, writeOffset, v),
    type: 'uint32',
    description,
  };
}

// ── Build the registry ───────────────────────────────────────

const entries: Array<[string, VirtualParamDef]> = [];

// ── PID params (MSP_PID=112, MSP_SET_PID=202) ──
// Payload: 3 bytes per axis. Axes: ROLL=0, PITCH=1, YAW=2, ALT=3, POS=4, POSR=5, NAVR=6, LEVEL=7, MAG=8, VEL=9
// Axis n: P at n*3, I at n*3+1, D at n*3+2

const PID_AXES = ['ROLL', 'PITCH', 'YAW', 'ALT', 'POS', 'POSR', 'NAVR', 'LEVEL', 'MAG', 'VEL'] as const;
for (let ax = 0; ax < PID_AXES.length; ax++) {
  const name = PID_AXES[ax];
  entries.push([`BF_PID_${name}_P`, u8Param(MSP_PID, MSP_SET_PID, ax * 3, ax * 3, `${name} P gain`, 0, 255)]);
  entries.push([`BF_PID_${name}_I`, u8Param(MSP_PID, MSP_SET_PID, ax * 3 + 1, ax * 3 + 1, `${name} I gain`, 0, 255)]);
  entries.push([`BF_PID_${name}_D`, u8Param(MSP_PID, MSP_SET_PID, ax * 3 + 2, ax * 3 + 2, `${name} D gain`, 0, 255)]);
}

// ── RC Tuning (MSP_RC_TUNING=111, MSP_SET_RC_TUNING=204) ──
// Read offsets match decodeMspRcTuning; write offsets match encodeMspSetRcTuning.
// Values stored as U8 (÷100 for display), we store raw bytes.
entries.push([
  'BF_RC_RATE',
  u8Param(MSP_RC_TUNING, MSP_SET_RC_TUNING, 0, 0, 'RC Rate', 0, 255),
]);
entries.push([
  'BF_RC_EXPO',
  u8Param(MSP_RC_TUNING, MSP_SET_RC_TUNING, 1, 1, 'RC Expo', 0, 255),
]);
entries.push([
  'BF_ROLL_RATE',
  u8Param(MSP_RC_TUNING, MSP_SET_RC_TUNING, 2, 2, 'Roll Rate', 0, 255),
]);
entries.push([
  'BF_PITCH_RATE',
  u8Param(MSP_RC_TUNING, MSP_SET_RC_TUNING, 3, 3, 'Pitch Rate', 0, 255),
]);
entries.push([
  'BF_YAW_RATE',
  u8Param(MSP_RC_TUNING, MSP_SET_RC_TUNING, 4, 4, 'Yaw Rate', 0, 255),
]);
entries.push([
  'BF_THROTTLE_MID',
  u8Param(MSP_RC_TUNING, MSP_SET_RC_TUNING, 6, 6, 'Throttle Mid', 0, 255),
]);
entries.push([
  'BF_THROTTLE_EXPO',
  u8Param(MSP_RC_TUNING, MSP_SET_RC_TUNING, 7, 7, 'Throttle Expo', 0, 255),
]);
entries.push([
  'BF_RC_YAW_EXPO',
  u8Param(MSP_RC_TUNING, MSP_SET_RC_TUNING, 10, 10, 'RC Yaw Expo', 0, 255),
]);
entries.push([
  'BF_RC_YAW_RATE',
  u8Param(MSP_RC_TUNING, MSP_SET_RC_TUNING, 11, 11, 'RC Yaw Rate', 0, 255),
]);
entries.push([
  'BF_RC_PITCH_RATE',
  u8Param(MSP_RC_TUNING, MSP_SET_RC_TUNING, 12, 12, 'RC Pitch Rate', 0, 255),
]);
entries.push([
  'BF_RC_PITCH_EXPO',
  u8Param(MSP_RC_TUNING, MSP_SET_RC_TUNING, 13, 13, 'RC Pitch Expo', 0, 255),
]);
entries.push([
  'BF_THROTTLE_LIMIT_TYPE',
  u8Param(MSP_RC_TUNING, MSP_SET_RC_TUNING, 14, 14, 'Throttle Limit Type', 0, 2),
]);
entries.push([
  'BF_THROTTLE_LIMIT_PERCENT',
  u8Param(MSP_RC_TUNING, MSP_SET_RC_TUNING, 15, 15, 'Throttle Limit Percent', 25, 100),
]);
entries.push([
  'BF_ROLL_RATE_LIMIT',
  u16Param(MSP_RC_TUNING, MSP_SET_RC_TUNING, 16, 16, 'Roll Rate Limit', 200, 1998),
]);
entries.push([
  'BF_PITCH_RATE_LIMIT',
  u16Param(MSP_RC_TUNING, MSP_SET_RC_TUNING, 18, 18, 'Pitch Rate Limit', 200, 1998),
]);
entries.push([
  'BF_YAW_RATE_LIMIT',
  u16Param(MSP_RC_TUNING, MSP_SET_RC_TUNING, 20, 20, 'Yaw Rate Limit', 200, 1998),
]);
entries.push([
  'BF_RATES_TYPE',
  u8Param(MSP_RC_TUNING, MSP_SET_RC_TUNING, 22, 22, 'Rates Type', 0, 5),
]);

// ── Motor Config (MSP_MOTOR_CONFIG=131, MSP_SET_MOTOR_CONFIG=222) ──
entries.push([
  'BF_MOTOR_MIN_THROTTLE',
  u16Param(MSP_MOTOR_CONFIG, MSP_SET_MOTOR_CONFIG, 0, 0, 'Motor Min Throttle', 1000, 2000),
]);
entries.push([
  'BF_MOTOR_MAX_THROTTLE',
  u16Param(MSP_MOTOR_CONFIG, MSP_SET_MOTOR_CONFIG, 2, 2, 'Motor Max Throttle', 1000, 2000),
]);
entries.push([
  'BF_MOTOR_MIN_COMMAND',
  u16Param(MSP_MOTOR_CONFIG, MSP_SET_MOTOR_CONFIG, 4, 4, 'Motor Min Command', 0, 2000),
]);
entries.push([
  'BF_MOTOR_POLES',
  // Read offset 7, write offset 6 (write payload is shorter — no motorCount)
  u8Param(MSP_MOTOR_CONFIG, MSP_SET_MOTOR_CONFIG, 7, 6, 'Motor Poles', 2, 36),
]);
entries.push([
  'BF_MOTOR_USE_DSHOT_TELEMETRY',
  u8Param(MSP_MOTOR_CONFIG, MSP_SET_MOTOR_CONFIG, 8, 7, 'DShot Telemetry', 0, 1),
]);

// ── Battery Config (MSP_BATTERY_CONFIG=32, MSP_SET_BATTERY_CONFIG=33) ──
// Read: legacy U8s at 0-2, then U16 capacity at 3, U8 voltSrc at 5, U8 currSrc at 6, then U16÷100 at 7,9,11
// Write: same layout
entries.push([
  'BF_BATT_MIN_CELL',
  {
    readCmd: MSP_BATTERY_CONFIG,
    writeCmd: MSP_SET_BATTERY_CONFIG,
    decode: (p) => getU16(p, 7), // U16÷100 (raw value, consumer divides)
    encode: (v, p) => {
      let out = setU8(p, 0, Math.round(v / 10)); // legacy U8 (÷10 stored)
      out = setU16(out, 7, v); // U16 (÷100 stored)
      return out;
    },
    type: 'uint16',
    min: 100,
    max: 500,
    description: 'Min cell voltage (×100)',
  },
]);
entries.push([
  'BF_BATT_MAX_CELL',
  {
    readCmd: MSP_BATTERY_CONFIG,
    writeCmd: MSP_SET_BATTERY_CONFIG,
    decode: (p) => getU16(p, 9),
    encode: (v, p) => {
      let out = setU8(p, 1, Math.round(v / 10));
      out = setU16(out, 9, v);
      return out;
    },
    type: 'uint16',
    min: 100,
    max: 500,
    description: 'Max cell voltage (×100)',
  },
]);
entries.push([
  'BF_BATT_WARNING_CELL',
  {
    readCmd: MSP_BATTERY_CONFIG,
    writeCmd: MSP_SET_BATTERY_CONFIG,
    decode: (p) => getU16(p, 11),
    encode: (v, p) => {
      let out = setU8(p, 2, Math.round(v / 10));
      out = setU16(out, 11, v);
      return out;
    },
    type: 'uint16',
    min: 100,
    max: 500,
    description: 'Warning cell voltage (×100)',
  },
]);
entries.push([
  'BF_BATT_CAPACITY',
  u16Param(MSP_BATTERY_CONFIG, MSP_SET_BATTERY_CONFIG, 3, 3, 'Battery Capacity (mAh)', 0, 20000),
]);
entries.push([
  'BF_BATT_VOLTAGE_METER_SOURCE',
  u8Param(MSP_BATTERY_CONFIG, MSP_SET_BATTERY_CONFIG, 5, 5, 'Voltage Meter Source', 0, 3),
]);
entries.push([
  'BF_BATT_CURRENT_METER_SOURCE',
  u8Param(MSP_BATTERY_CONFIG, MSP_SET_BATTERY_CONFIG, 6, 6, 'Current Meter Source', 0, 3),
]);

// ── Feature Config (MSP_FEATURE_CONFIG=36, MSP_SET_FEATURE_CONFIG=37) ──
entries.push([
  'BF_FEATURE_MASK',
  u32Param(MSP_FEATURE_CONFIG, MSP_SET_FEATURE_CONFIG, 0, 0, 'Feature bitmask'),
]);

// ── Filter Config (MSP_FILTER_CONFIG=92, MSP_SET_FILTER_CONFIG=93) ──
// Read offsets from decodeMspFilterConfig, write offsets from encodeMspSetFilterConfig
// Note: gyroLowpassHz legacy byte at 0, real U16 at 20 (read) / 20 (write)
entries.push([
  'BF_GYRO_LPF_HZ',
  u16Param(MSP_FILTER_CONFIG, MSP_SET_FILTER_CONFIG, 20, 20, 'Gyro Lowpass Hz', 0, 4000),
]);
entries.push([
  'BF_DTERM_LPF_HZ',
  u16Param(MSP_FILTER_CONFIG, MSP_SET_FILTER_CONFIG, 1, 1, 'D-term Lowpass Hz', 0, 4000),
]);
entries.push([
  'BF_YAW_LPF_HZ',
  u16Param(MSP_FILTER_CONFIG, MSP_SET_FILTER_CONFIG, 3, 3, 'Yaw Lowpass Hz', 0, 500),
]);
entries.push([
  'BF_GYRO_NOTCH_HZ',
  u16Param(MSP_FILTER_CONFIG, MSP_SET_FILTER_CONFIG, 5, 5, 'Gyro Notch Hz', 0, 4000),
]);
entries.push([
  'BF_GYRO_NOTCH_CUTOFF',
  u16Param(MSP_FILTER_CONFIG, MSP_SET_FILTER_CONFIG, 7, 7, 'Gyro Notch Cutoff', 0, 4000),
]);
entries.push([
  'BF_DTERM_NOTCH_HZ',
  u16Param(MSP_FILTER_CONFIG, MSP_SET_FILTER_CONFIG, 9, 9, 'D-term Notch Hz', 0, 4000),
]);
entries.push([
  'BF_DTERM_NOTCH_CUTOFF',
  u16Param(MSP_FILTER_CONFIG, MSP_SET_FILTER_CONFIG, 11, 11, 'D-term Notch Cutoff', 0, 4000),
]);
entries.push([
  'BF_GYRO_NOTCH2_HZ',
  u16Param(MSP_FILTER_CONFIG, MSP_SET_FILTER_CONFIG, 13, 13, 'Gyro Notch 2 Hz', 0, 4000),
]);
entries.push([
  'BF_GYRO_NOTCH2_CUTOFF',
  u16Param(MSP_FILTER_CONFIG, MSP_SET_FILTER_CONFIG, 15, 15, 'Gyro Notch 2 Cutoff', 0, 4000),
]);
entries.push([
  'BF_DTERM_LPF_TYPE',
  u8Param(MSP_FILTER_CONFIG, MSP_SET_FILTER_CONFIG, 17, 17, 'D-term Lowpass Type', 0, 2),
]);
entries.push([
  'BF_GYRO_HARDWARE_LPF',
  u8Param(MSP_FILTER_CONFIG, MSP_SET_FILTER_CONFIG, 18, 18, 'Gyro Hardware LPF', 0, 2),
]);
entries.push([
  'BF_GYRO_LPF2_HZ',
  u16Param(MSP_FILTER_CONFIG, MSP_SET_FILTER_CONFIG, 22, 22, 'Gyro Lowpass 2 Hz', 0, 4000),
]);
entries.push([
  'BF_GYRO_LPF_TYPE',
  u8Param(MSP_FILTER_CONFIG, MSP_SET_FILTER_CONFIG, 24, 24, 'Gyro Lowpass Type', 0, 2),
]);
entries.push([
  'BF_GYRO_LPF2_TYPE',
  u8Param(MSP_FILTER_CONFIG, MSP_SET_FILTER_CONFIG, 25, 25, 'Gyro Lowpass 2 Type', 0, 2),
]);
entries.push([
  'BF_DTERM_LPF2_HZ',
  u16Param(MSP_FILTER_CONFIG, MSP_SET_FILTER_CONFIG, 26, 26, 'D-term Lowpass 2 Hz', 0, 4000),
]);
entries.push([
  'BF_DTERM_LPF2_TYPE',
  u8Param(MSP_FILTER_CONFIG, MSP_SET_FILTER_CONFIG, 28, 28, 'D-term Lowpass 2 Type', 0, 2),
]);
entries.push([
  'BF_GYRO_LPF_DYN_MIN_HZ',
  u16Param(MSP_FILTER_CONFIG, MSP_SET_FILTER_CONFIG, 29, 29, 'Gyro Dyn LPF Min Hz', 0, 1000),
]);
entries.push([
  'BF_GYRO_LPF_DYN_MAX_HZ',
  u16Param(MSP_FILTER_CONFIG, MSP_SET_FILTER_CONFIG, 31, 31, 'Gyro Dyn LPF Max Hz', 0, 1000),
]);
entries.push([
  'BF_DTERM_LPF_DYN_MIN_HZ',
  u16Param(MSP_FILTER_CONFIG, MSP_SET_FILTER_CONFIG, 33, 33, 'D-term Dyn LPF Min Hz', 0, 1000),
]);
entries.push([
  'BF_DTERM_LPF_DYN_MAX_HZ',
  u16Param(MSP_FILTER_CONFIG, MSP_SET_FILTER_CONFIG, 35, 35, 'D-term Dyn LPF Max Hz', 0, 1000),
]);
entries.push([
  'BF_DYN_NOTCH_Q',
  u16Param(MSP_FILTER_CONFIG, MSP_SET_FILTER_CONFIG, 39, 39, 'Dynamic Notch Q', 0, 1000),
]);
entries.push([
  'BF_DYN_NOTCH_MIN_HZ',
  u16Param(MSP_FILTER_CONFIG, MSP_SET_FILTER_CONFIG, 41, 41, 'Dynamic Notch Min Hz', 0, 1000),
]);
entries.push([
  'BF_RPM_NOTCH_HARMONICS',
  u8Param(MSP_FILTER_CONFIG, MSP_SET_FILTER_CONFIG, 43, 43, 'RPM Notch Harmonics', 0, 3),
]);
entries.push([
  'BF_RPM_NOTCH_MIN_HZ',
  u8Param(MSP_FILTER_CONFIG, MSP_SET_FILTER_CONFIG, 44, 44, 'RPM Notch Min Hz', 0, 255),
]);
entries.push([
  'BF_DYN_NOTCH_MAX_HZ',
  u16Param(MSP_FILTER_CONFIG, MSP_SET_FILTER_CONFIG, 45, 45, 'Dynamic Notch Max Hz', 0, 1000),
]);
entries.push([
  'BF_DYN_NOTCH_COUNT',
  u8Param(MSP_FILTER_CONFIG, MSP_SET_FILTER_CONFIG, 48, 48, 'Dynamic Notch Count', 0, 5),
]);

// ── Failsafe Config (MSP_FAILSAFE_CONFIG=75, MSP_SET_FAILSAFE_CONFIG=76) ──
entries.push([
  'BF_FS_DELAY',
  u8Param(MSP_FAILSAFE_CONFIG, MSP_SET_FAILSAFE_CONFIG, 0, 0, 'Failsafe Delay (0.1s)', 0, 200),
]);
entries.push([
  'BF_FS_OFF_DELAY',
  u8Param(MSP_FAILSAFE_CONFIG, MSP_SET_FAILSAFE_CONFIG, 1, 1, 'Failsafe Off Delay (0.1s)', 0, 200),
]);
entries.push([
  'BF_FS_THROTTLE',
  u16Param(MSP_FAILSAFE_CONFIG, MSP_SET_FAILSAFE_CONFIG, 2, 2, 'Failsafe Throttle', 1000, 2000),
]);
entries.push([
  'BF_FS_SWITCH_MODE',
  u8Param(MSP_FAILSAFE_CONFIG, MSP_SET_FAILSAFE_CONFIG, 4, 4, 'Failsafe Switch Mode', 0, 2),
]);
entries.push([
  'BF_FS_THROTTLE_LOW_DELAY',
  u16Param(MSP_FAILSAFE_CONFIG, MSP_SET_FAILSAFE_CONFIG, 5, 5, 'Throttle Low Delay (0.1s)', 0, 300),
]);
entries.push([
  'BF_FS_PROCEDURE',
  u8Param(MSP_FAILSAFE_CONFIG, MSP_SET_FAILSAFE_CONFIG, 7, 7, 'Failsafe Procedure', 0, 2),
]);

// ── Arming Config (MSP_ARMING_CONFIG=61, MSP_SET_ARMING_CONFIG=62) ──
entries.push([
  'BF_AUTO_DISARM_DELAY',
  u8Param(MSP_ARMING_CONFIG, MSP_SET_ARMING_CONFIG, 0, 0, 'Auto Disarm Delay (s)', 0, 60),
]);
entries.push([
  'BF_SMALL_ANGLE',
  // Read: offset 2 (skip deprecated kill_switch at 1). Write: offset 2.
  u8Param(MSP_ARMING_CONFIG, MSP_SET_ARMING_CONFIG, 2, 2, 'Small Angle (degrees)', 0, 180),
]);

// ── Advanced Config (MSP_ADVANCED_CONFIG=90, MSP_SET_ADVANCED_CONFIG=91) ──
entries.push([
  'BF_GYRO_SYNC_DENOM',
  u8Param(MSP_ADVANCED_CONFIG, MSP_SET_ADVANCED_CONFIG, 0, 0, 'Gyro Sync Denominator', 1, 32),
]);
entries.push([
  'BF_PID_PROCESS_DENOM',
  u8Param(MSP_ADVANCED_CONFIG, MSP_SET_ADVANCED_CONFIG, 1, 1, 'PID Process Denominator', 1, 16),
]);
entries.push([
  'BF_MOTOR_PWM_PROTOCOL',
  u8Param(MSP_ADVANCED_CONFIG, MSP_SET_ADVANCED_CONFIG, 3, 3, 'Motor PWM Protocol', 0, 9),
]);
entries.push([
  'BF_MOTOR_PWM_RATE',
  u16Param(MSP_ADVANCED_CONFIG, MSP_SET_ADVANCED_CONFIG, 4, 4, 'Motor PWM Rate', 200, 32000),
]);
entries.push([
  'BF_MOTOR_IDLE_PCT',
  // Read: U16 at offset 6 (stored ×100). Write: U16 at offset 6.
  // decode/encode handle the raw ×100 value; consumer divides by 100 for display.
  u16Param(MSP_ADVANCED_CONFIG, MSP_SET_ADVANCED_CONFIG, 6, 6, 'Motor Idle (×100)', 0, 3000),
]);
entries.push([
  'BF_MOTOR_PWM_INVERSION',
  u8Param(MSP_ADVANCED_CONFIG, MSP_SET_ADVANCED_CONFIG, 9, 9, 'Motor PWM Inversion', 0, 1),
]);
entries.push([
  'BF_GYRO_TO_USE',
  u8Param(MSP_ADVANCED_CONFIG, MSP_SET_ADVANCED_CONFIG, 10, 10, 'Gyro to Use', 0, 2),
]);
entries.push([
  'BF_DEBUG_MODE',
  u8Param(MSP_ADVANCED_CONFIG, MSP_SET_ADVANCED_CONFIG, 18, 18, 'Debug Mode', 0, 255),
]);

// ── GPS Config (MSP_GPS_CONFIG=132, MSP_SET_GPS_CONFIG=223) ──
entries.push([
  'BF_GPS_PROVIDER',
  u8Param(MSP_GPS_CONFIG, MSP_SET_GPS_CONFIG, 0, 0, 'GPS Provider', 0, 3),
]);
entries.push([
  'BF_GPS_SBAS_MODE',
  u8Param(MSP_GPS_CONFIG, MSP_SET_GPS_CONFIG, 1, 1, 'GPS SBAS Mode', 0, 4),
]);
entries.push([
  'BF_GPS_AUTO_CONFIG',
  u8Param(MSP_GPS_CONFIG, MSP_SET_GPS_CONFIG, 2, 2, 'GPS Auto Config', 0, 1),
]);
entries.push([
  'BF_GPS_AUTO_BAUD',
  u8Param(MSP_GPS_CONFIG, MSP_SET_GPS_CONFIG, 3, 3, 'GPS Auto Baud', 0, 1),
]);
entries.push([
  'BF_GPS_HOME_POINT_ONCE',
  u8Param(MSP_GPS_CONFIG, MSP_SET_GPS_CONFIG, 4, 4, 'GPS Home Point Once', 0, 1),
]);
entries.push([
  'BF_GPS_USE_GALILEO',
  u8Param(MSP_GPS_CONFIG, MSP_SET_GPS_CONFIG, 5, 5, 'GPS Use Galileo', 0, 1),
]);

// ── GPS Rescue (MSP_GPS_RESCUE=135, MSP_SET_GPS_RESCUE=225) ──
entries.push([
  'BF_GPS_RESCUE_ANGLE',
  u16Param(MSP_GPS_RESCUE, MSP_SET_GPS_RESCUE, 0, 0, 'GPS Rescue Angle', 0, 200),
]);
entries.push([
  'BF_GPS_RESCUE_INITIAL_ALT',
  u16Param(MSP_GPS_RESCUE, MSP_SET_GPS_RESCUE, 2, 2, 'GPS Rescue Initial Altitude (m)', 20, 100),
]);
entries.push([
  'BF_GPS_RESCUE_DESCENT_DIST',
  u16Param(MSP_GPS_RESCUE, MSP_SET_GPS_RESCUE, 4, 4, 'GPS Rescue Descent Distance (m)', 30, 500),
]);
entries.push([
  'BF_GPS_RESCUE_GROUND_SPEED',
  u16Param(MSP_GPS_RESCUE, MSP_SET_GPS_RESCUE, 6, 6, 'GPS Rescue Ground Speed (cm/s)', 0, 2000),
]);
entries.push([
  'BF_GPS_RESCUE_THROTTLE_MIN',
  u16Param(MSP_GPS_RESCUE, MSP_SET_GPS_RESCUE, 8, 8, 'GPS Rescue Throttle Min', 1000, 2000),
]);
entries.push([
  'BF_GPS_RESCUE_THROTTLE_MAX',
  u16Param(MSP_GPS_RESCUE, MSP_SET_GPS_RESCUE, 10, 10, 'GPS Rescue Throttle Max', 1000, 2000),
]);
entries.push([
  'BF_GPS_RESCUE_THROTTLE_HOVER',
  u16Param(MSP_GPS_RESCUE, MSP_SET_GPS_RESCUE, 12, 12, 'GPS Rescue Throttle Hover', 1000, 2000),
]);
entries.push([
  'BF_GPS_RESCUE_SANITY_CHECKS',
  u8Param(MSP_GPS_RESCUE, MSP_SET_GPS_RESCUE, 14, 14, 'GPS Rescue Sanity Checks', 0, 2),
]);
entries.push([
  'BF_GPS_RESCUE_MIN_SATS',
  u8Param(MSP_GPS_RESCUE, MSP_SET_GPS_RESCUE, 15, 15, 'GPS Rescue Min Satellites', 0, 50),
]);
entries.push([
  'BF_GPS_RESCUE_ASCEND_RATE',
  u16Param(MSP_GPS_RESCUE, MSP_SET_GPS_RESCUE, 16, 16, 'GPS Rescue Ascend Rate', 100, 2500),
]);
entries.push([
  'BF_GPS_RESCUE_DESCEND_RATE',
  u16Param(MSP_GPS_RESCUE, MSP_SET_GPS_RESCUE, 18, 18, 'GPS Rescue Descend Rate', 100, 500),
]);
entries.push([
  'BF_GPS_RESCUE_ALLOW_ARMING_NO_FIX',
  u8Param(MSP_GPS_RESCUE, MSP_SET_GPS_RESCUE, 20, 20, 'GPS Rescue Allow Arming Without Fix', 0, 1),
]);
entries.push([
  'BF_GPS_RESCUE_ALTITUDE_MODE',
  u8Param(MSP_GPS_RESCUE, MSP_SET_GPS_RESCUE, 21, 21, 'GPS Rescue Altitude Mode', 0, 2),
]);

// ── Blackbox Config (MSP_BLACKBOX_CONFIG=80, MSP_SET_BLACKBOX_CONFIG=81) ──
// Read: U8 supported (bit 0), U8 device, U8 rateNum, U8 rateDenom, U16 pDenom, U8 sampleRate
// Write: U8 device, U8 rateNum, U8 rateDenom, U16 pDenom, U8 sampleRate
entries.push([
  'BF_BLACKBOX_DEVICE',
  u8Param(MSP_BLACKBOX_CONFIG, MSP_SET_BLACKBOX_CONFIG, 1, 0, 'Blackbox Device', 0, 3),
]);
entries.push([
  'BF_BLACKBOX_RATE_NUM',
  u8Param(MSP_BLACKBOX_CONFIG, MSP_SET_BLACKBOX_CONFIG, 2, 1, 'Blackbox Rate Numerator', 1, 255),
]);
entries.push([
  'BF_BLACKBOX_RATE_DENOM',
  u8Param(MSP_BLACKBOX_CONFIG, MSP_SET_BLACKBOX_CONFIG, 3, 2, 'Blackbox Rate Denominator', 1, 255),
]);
entries.push([
  'BF_BLACKBOX_P_DENOM',
  u16Param(MSP_BLACKBOX_CONFIG, MSP_SET_BLACKBOX_CONFIG, 4, 3, 'Blackbox P Denom', 0, 65535),
]);
entries.push([
  'BF_BLACKBOX_SAMPLE_RATE',
  u8Param(MSP_BLACKBOX_CONFIG, MSP_SET_BLACKBOX_CONFIG, 6, 5, 'Blackbox Sample Rate', 0, 255),
]);

// ── VTX Config (MSP_VTX_CONFIG=88, MSP_SET_VTX_CONFIG=89) ──
// Read offsets from decodeMspVtxConfig. Write offsets from encodeMspSetVtxConfig.
entries.push([
  'BF_VTX_TYPE',
  u8Param(MSP_VTX_CONFIG, MSP_SET_VTX_CONFIG, 0, 0, 'VTX Type', 0, 4),
]);
entries.push([
  'BF_VTX_BAND',
  // Read: offset 1. Write: offset 7.
  {
    readCmd: MSP_VTX_CONFIG,
    writeCmd: MSP_SET_VTX_CONFIG,
    decode: (p) => getU8(p, 1),
    encode: (v, p) => setU8(p, 7, v),
    type: 'uint8' as const,
    min: 0,
    max: 5,
    description: 'VTX Band',
  },
]);
entries.push([
  'BF_VTX_CHANNEL',
  {
    readCmd: MSP_VTX_CONFIG,
    writeCmd: MSP_SET_VTX_CONFIG,
    decode: (p) => getU8(p, 2),
    encode: (v, p) => setU8(p, 8, v),
    type: 'uint8' as const,
    min: 0,
    max: 8,
    description: 'VTX Channel',
  },
]);
entries.push([
  'BF_VTX_POWER',
  {
    readCmd: MSP_VTX_CONFIG,
    writeCmd: MSP_SET_VTX_CONFIG,
    decode: (p) => getU8(p, 3),
    encode: (v, p) => setU8(p, 2, v),
    type: 'uint8' as const,
    min: 0,
    max: 5,
    description: 'VTX Power Level',
  },
]);
entries.push([
  'BF_VTX_PIT_MODE',
  {
    readCmd: MSP_VTX_CONFIG,
    writeCmd: MSP_SET_VTX_CONFIG,
    decode: (p) => getU8(p, 4),
    encode: (v, p) => setU8(p, 3, v),
    type: 'uint8' as const,
    min: 0,
    max: 1,
    description: 'VTX Pit Mode',
  },
]);
entries.push([
  'BF_VTX_FREQUENCY',
  {
    readCmd: MSP_VTX_CONFIG,
    writeCmd: MSP_SET_VTX_CONFIG,
    decode: (p) => getU16(p, 5),
    encode: (v, p) => {
      let out = setU16(p, 0, v); // first frequency field
      out = setU16(out, 9, v); // second frequency field
      return out;
    },
    type: 'uint16' as const,
    min: 0,
    max: 5999,
    description: 'VTX Frequency (MHz)',
  },
]);
entries.push([
  'BF_VTX_LOW_POWER_DISARM',
  {
    readCmd: MSP_VTX_CONFIG,
    writeCmd: MSP_SET_VTX_CONFIG,
    decode: (p) => getU8(p, 8),
    encode: (v, p) => setU8(p, 4, v),
    type: 'uint8' as const,
    min: 0,
    max: 2,
    description: 'VTX Low Power Disarm',
  },
]);

// ── Beeper Config (MSP_BEEPER_CONFIG=184, MSP_SET_BEEPER_CONFIG=185) ──
entries.push([
  'BF_BEEPER_DISABLED_MASK',
  u32Param(MSP_BEEPER_CONFIG, MSP_SET_BEEPER_CONFIG, 0, 0, 'Beeper Disabled Mask'),
]);
entries.push([
  'BF_BEEPER_DSHOT_TONE',
  u8Param(MSP_BEEPER_CONFIG, MSP_SET_BEEPER_CONFIG, 4, 4, 'DShot Beacon Tone', 0, 5),
]);
entries.push([
  'BF_BEEPER_DSHOT_CONDITIONS_MASK',
  u32Param(MSP_BEEPER_CONFIG, MSP_SET_BEEPER_CONFIG, 5, 5, 'DShot Beacon Conditions Mask'),
]);

// ── Build the Map ────────────────────────────────────────────

/** Registry of all virtual parameters */
export const VIRTUAL_PARAMS: ReadonlyMap<string, VirtualParamDef> = new Map(entries);

// ── Query helpers ────────────────────────────────────────────

/**
 * Get all param names grouped by their readCmd.
 * Used for batching MSP reads (one MSP command can satisfy many virtual params).
 */
export function getParamsByReadCmd(): Map<number, string[]> {
  const result = new Map<number, string[]>();
  for (const [name, def] of entries) {
    const list = result.get(def.readCmd);
    if (list) {
      list.push(name);
    } else {
      result.set(def.readCmd, [name]);
    }
  }
  return result;
}

/**
 * Get all unique read commands needed to satisfy a list of param names.
 */
export function getReadCmdsForParams(paramNames: string[]): number[] {
  const cmds = new Set<number>();
  for (const name of paramNames) {
    const def = VIRTUAL_PARAMS.get(name);
    if (def) {
      cmds.add(def.readCmd);
    }
  }
  return Array.from(cmds);
}
