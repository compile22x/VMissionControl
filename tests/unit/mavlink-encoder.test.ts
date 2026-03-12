import { describe, it, expect } from 'vitest';
import {
  encodeHeartbeat,
  encodeSetMode,
  encodeParamSet,
  encodeManualControl,
  buildFrame,
} from '@/lib/protocol/mavlink-encoder';

describe('encodeHeartbeat', () => {
  it('produces a valid MAVLink v2 frame', () => {
    const frame = encodeHeartbeat();
    expect(frame).toBeInstanceOf(Uint8Array);
    // MAVLink v2 STX byte
    expect(frame[0]).toBe(0xfd);
    // Payload length = 9 for heartbeat
    expect(frame[1]).toBe(9);
    // Message ID low byte = 0 (heartbeat)
    expect(frame[7]).toBe(0);
    expect(frame[8]).toBe(0);
    expect(frame[9]).toBe(0);
    // Total frame: 10 header + 9 payload + 2 CRC = 21
    expect(frame.length).toBe(21);
  });

  it('uses default sysId=255 and compId=190', () => {
    const frame = encodeHeartbeat();
    expect(frame[5]).toBe(255); // sysId
    expect(frame[6]).toBe(190); // compId
  });

  it('accepts custom sysId and compId', () => {
    const frame = encodeHeartbeat(1, 1);
    expect(frame[5]).toBe(1);
    expect(frame[6]).toBe(1);
  });
});

describe('encodeSetMode', () => {
  it('produces frame with correct message ID (11)', () => {
    const frame = encodeSetMode(1, 217, 5);
    expect(frame[0]).toBe(0xfd);
    // MSG ID = 11
    expect(frame[7]).toBe(11);
    expect(frame[8]).toBe(0);
    expect(frame[9]).toBe(0);
  });

  it('encodes target system and mode values', () => {
    const frame = encodeSetMode(1, 217, 5);
    const dv = new DataView(frame.buffer, frame.byteOffset);
    // Payload starts at offset 10
    // customMode (uint32 LE) at payload offset 0
    expect(dv.getUint32(10, true)).toBe(5);
    // targetSys at payload offset 4
    expect(frame[14]).toBe(1);
    // baseMode at payload offset 5
    expect(frame[15]).toBe(217);
  });
});

describe('encodeParamSet', () => {
  it('includes param name and value in frame', () => {
    const frame = encodeParamSet(1, 1, 'ARMING_CHECK', 1.0);
    expect(frame[0]).toBe(0xfd);
    // MSG ID = 23
    expect(frame[7]).toBe(23);

    // Payload starts at offset 10
    const dv = new DataView(frame.buffer, frame.byteOffset);
    // param_value (float32 LE) at payload offset 0
    expect(dv.getFloat32(10, true)).toBeCloseTo(1.0);

    // param_id starts at payload offset 6 (frame offset 16)
    const nameBytes = frame.slice(16, 16 + 16);
    const name = new TextDecoder().decode(nameBytes).replace(/\0+$/, '');
    expect(name).toBe('ARMING_CHECK');
  });
});

describe('encodeManualControl', () => {
  it('includes axis values in frame', () => {
    const frame = encodeManualControl(1, 500, -300, 700, -100, 0);
    expect(frame[0]).toBe(0xfd);
    // MSG ID = 69
    expect(frame[7]).toBe(69);

    const dv = new DataView(frame.buffer, frame.byteOffset);
    // Payload at offset 10: x(int16), y(int16), z(int16), r(int16), buttons(uint16), target(uint8)
    expect(dv.getInt16(10, true)).toBe(500);  // x (pitch)
    expect(dv.getInt16(12, true)).toBe(-300); // y (roll)
    expect(dv.getInt16(14, true)).toBe(700);  // z (throttle)
    expect(dv.getInt16(16, true)).toBe(-100); // r (yaw)
  });
});

describe('buildFrame', () => {
  it('builds a correctly structured MAVLink v2 frame', () => {
    const payload = new Uint8Array([0x01, 0x02, 0x03]);
    const frame = buildFrame(42, payload, 255, 190, 0);
    expect(frame[0]).toBe(0xfd);       // STX
    expect(frame[1]).toBe(3);          // payload length
    expect(frame[4]).toBe(0);          // sequence
    expect(frame[5]).toBe(255);        // sysId
    expect(frame[6]).toBe(190);        // compId
    expect(frame[7]).toBe(42);         // msgId low
    // Total: 10 header + 3 payload + 2 CRC = 15
    expect(frame.length).toBe(15);
  });
});
