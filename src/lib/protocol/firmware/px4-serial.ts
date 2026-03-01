/**
 * PX4 bootloader protocol over UART via Web Serial API.
 *
 * Implements the PX4 bootloader protocol (px_uploader) for flashing
 * .px4 firmware files to PX4-based flight controllers. This is NOT
 * the STM32 ROM bootloader — it's PX4's own bootloader with a
 * different command set and response format.
 *
 * Key differences from STM32 serial bootloader:
 * - 8N1 (no parity) vs 8E1
 * - Response pattern is always [INSYNC, OK/FAILED/INVALID] (2 bytes)
 * - PROG_MULTI sends length byte + data + EOC (max 252 data bytes)
 * - CRC32 verification instead of byte-by-byte read-back
 * - Board ID validation during flash via GET_DEVICE
 *
 * Reference: PX4/Firmware/Tools/px_uploader.py
 *
 * @module protocol/firmware/px4-serial
 */

/// <reference path="../web-serial.d.ts" />

import type {
  FirmwareFlasher,
  FlashMethod,
  FlashProgressCallback,
  ParsedFirmware,
} from "./types";

// ── CRC32 Lookup Table ──────────────────────────────────────

/** Pre-computed CRC32 table (IEEE 802.3 polynomial). */
const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let crc = i;
  for (let j = 0; j < 8; j++) {
    crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  CRC32_TABLE[i] = crc;
}

/** Compute CRC32 over a Uint8Array. */
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ── PX4SerialFlasher ────────────────────────────────────────

export class PX4SerialFlasher implements FirmwareFlasher {
  readonly method: FlashMethod = "px4-serial";

  // PX4 bootloader protocol constants
  private static readonly INSYNC = 0x12;
  private static readonly EOC = 0x20;
  private static readonly OK = 0x10;
  private static readonly FAILED = 0x11;
  private static readonly INVALID = 0x13;
  private static readonly GET_SYNC = 0x21;
  private static readonly GET_DEVICE = 0x22;
  private static readonly CHIP_ERASE = 0x23;
  private static readonly PROG_MULTI = 0x27;
  private static readonly GET_CRC = 0x29;
  private static readonly REBOOT = 0x30;

  private static readonly PROG_MULTI_MAX = 252; // bytes per PROG_MULTI
  private static readonly DEFAULT_TIMEOUT = 5000;
  private static readonly ERASE_TIMEOUT = 30000;

  private port: SerialPort;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private aborted = false;
  private readBuffer: number[] = [];

  constructor(port: SerialPort) {
    this.port = port;
  }

  /**
   * Open browser serial port picker.
   * Returns a raw SerialPort for bootloader use.
   */
  static async requestPort(): Promise<SerialPort> {
    if (typeof navigator === "undefined" || !("serial" in navigator)) {
      throw new Error("Web Serial API not supported — use Chrome or Edge");
    }
    return navigator.serial.requestPort();
  }

  // ── Public Interface ───────────────────────────────────

  async flash(
    firmware: ParsedFirmware,
    onProgress: FlashProgressCallback,
    signal?: AbortSignal,
  ): Promise<void> {
    this.aborted = false;
    if (signal) signal.addEventListener("abort", () => this.abort(), { once: true });

    try {
      // Open port with PX4 bootloader settings (8N1, no parity)
      onProgress({ phase: "bootloader_init", percent: 5, message: "Opening serial port..." });
      await this.openPort();

      // Sync with bootloader
      onProgress({ phase: "bootloader_init", percent: 8, message: "Synchronizing with PX4 bootloader..." });
      await this.sync();

      this.checkAbort();

      // Get board ID and validate against firmware
      onProgress({ phase: "chip_detect", percent: 10, message: "Reading board ID..." });
      const boardId = await this.getBoardId();

      if (firmware.boardId !== undefined && boardId !== firmware.boardId) {
        throw new Error(
          `Board ID mismatch: firmware expects ${firmware.boardId}, ` +
          `connected board reports ${boardId}`
        );
      }
      onProgress({ phase: "chip_detect", percent: 12, message: `Board ID: ${boardId}` });

      this.checkAbort();

      // Erase chip
      onProgress({ phase: "erasing", percent: 15, message: "Erasing flash (this may take a while)..." });
      await this.chipErase();
      onProgress({ phase: "erasing", percent: 25, message: "Erase complete" });

      this.checkAbort();

      // Program firmware
      const allData = this.flattenFirmware(firmware);
      await this.programFirmware(allData, onProgress);

      this.checkAbort();

      // Verify CRC
      onProgress({ phase: "verifying", percent: 85, message: "Verifying CRC32..." });
      await this.verifyCrc(allData);
      onProgress({ phase: "verifying", percent: 90, message: "CRC32 verified" });

      // Reboot
      onProgress({ phase: "restarting", percent: 95, message: "Rebooting flight controller..." });
      await this.reboot();

      onProgress({ phase: "done", percent: 100, message: "Flash complete!" });
    } finally {
      await this.closePort();
    }
  }

  async verify(
    firmware: ParsedFirmware,
    onProgress: FlashProgressCallback,
    signal?: AbortSignal,
  ): Promise<void> {
    this.aborted = false;
    if (signal) signal.addEventListener("abort", () => this.abort(), { once: true });

    try {
      // Port should already be open from flash(), but open if needed
      if (!this.reader || !this.writer) {
        await this.openPort();
        await this.sync();
      }

      onProgress({ phase: "verifying", percent: 80, message: "Computing CRC32..." });
      const allData = this.flattenFirmware(firmware);
      await this.verifyCrc(allData);
      onProgress({ phase: "verifying", percent: 95, message: "CRC32 verified" });
    } finally {
      await this.closePort();
    }
  }

  abort(): void {
    this.aborted = true;
  }

  async dispose(): Promise<void> {
    await this.closePort();
  }

  // ── Port Management ────────────────────────────────────

  private async openPort(): Promise<void> {
    await this.port.open({
      baudRate: 115200,
      parity: "none",
      stopBits: 1,
      dataBits: 8,
    });
    this.readBuffer = [];
    if (this.port.readable) {
      this.reader = this.port.readable.getReader();
    }
    if (this.port.writable) {
      this.writer = this.port.writable.getWriter();
    }
  }

  private async closePort(): Promise<void> {
    try {
      if (this.reader) {
        await this.reader.cancel().catch(() => {});
        this.reader.releaseLock();
        this.reader = null;
      }
      if (this.writer) {
        await this.writer.close().catch(() => {});
        this.writer.releaseLock();
        this.writer = null;
      }
      await this.port.close().catch(() => {});
    } catch {
      // Ignore close errors
    }
  }

  // ── PX4 Bootloader Protocol ────────────────────────────

  /**
   * Synchronize with the PX4 bootloader.
   * Sends GET_SYNC + EOC, expects INSYNC + OK. Retries up to 10 times.
   */
  private async sync(): Promise<void> {
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        // Drain any stale data
        this.readBuffer = [];
        await this.sendBytes(
          new Uint8Array([PX4SerialFlasher.GET_SYNC, PX4SerialFlasher.EOC])
        );
        await this.expectInsyncOk(1000);
        return;
      } catch {
        // Retry after a short delay
        await this.delay(100);
      }
    }
    throw new Error(
      "Failed to synchronize with PX4 bootloader. Ensure the board is in bootloader mode."
    );
  }

  /**
   * GET_DEVICE — read the board ID (4 bytes, little-endian).
   */
  private async getBoardId(): Promise<number> {
    await this.sendBytes(
      new Uint8Array([PX4SerialFlasher.GET_DEVICE, PX4SerialFlasher.EOC])
    );
    const idBytes = await this.waitForBytes(4);
    await this.expectInsyncOk();
    // Board ID is 4 bytes little-endian
    return (idBytes[0]) | (idBytes[1] << 8) | (idBytes[2] << 16) | (idBytes[3] << 24);
  }

  /**
   * CHIP_ERASE — erase entire flash. Can take up to 30 seconds.
   */
  private async chipErase(): Promise<void> {
    await this.sendBytes(
      new Uint8Array([PX4SerialFlasher.CHIP_ERASE, PX4SerialFlasher.EOC])
    );
    await this.expectInsyncOk(PX4SerialFlasher.ERASE_TIMEOUT);
  }

  /**
   * Program firmware data in PROG_MULTI_MAX-byte chunks.
   */
  private async programFirmware(
    data: Uint8Array,
    onProgress: FlashProgressCallback,
  ): Promise<void> {
    const totalBytes = data.length;
    let writtenBytes = 0;

    for (let offset = 0; offset < totalBytes; offset += PX4SerialFlasher.PROG_MULTI_MAX) {
      this.checkAbort();

      const chunkSize = Math.min(PX4SerialFlasher.PROG_MULTI_MAX, totalBytes - offset);
      const chunk = data.slice(offset, offset + chunkSize);

      // PROG_MULTI: [cmd, length, data..., EOC]
      const packet = new Uint8Array(2 + chunkSize + 1);
      packet[0] = PX4SerialFlasher.PROG_MULTI;
      packet[1] = chunkSize;
      packet.set(chunk, 2);
      packet[packet.length - 1] = PX4SerialFlasher.EOC;

      await this.sendBytes(packet);
      await this.expectInsyncOk();

      writtenBytes += chunkSize;
      const percent = 25 + Math.round((writtenBytes / totalBytes) * 55);
      onProgress({
        phase: "flashing",
        percent,
        message: `Writing... ${writtenBytes}/${totalBytes} bytes`,
        bytesWritten: writtenBytes,
        bytesTotal: totalBytes,
        phasePercent: Math.round((writtenBytes / totalBytes) * 100),
      });
    }
  }

  /**
   * GET_CRC — request CRC32 from bootloader and compare with local computation.
   */
  private async verifyCrc(data: Uint8Array): Promise<void> {
    await this.sendBytes(
      new Uint8Array([PX4SerialFlasher.GET_CRC, PX4SerialFlasher.EOC])
    );
    const crcBytes = await this.waitForBytes(4);
    await this.expectInsyncOk();

    const remoteCrc =
      (crcBytes[0]) | (crcBytes[1] << 8) | (crcBytes[2] << 16) | (crcBytes[3] << 24);
    const localCrc = crc32(data);

    if ((remoteCrc >>> 0) !== (localCrc >>> 0)) {
      throw new Error(
        `CRC32 mismatch: local 0x${localCrc.toString(16).padStart(8, "0")}, ` +
        `remote 0x${(remoteCrc >>> 0).toString(16).padStart(8, "0")}`
      );
    }
  }

  /**
   * REBOOT — reboot the flight controller into the application.
   */
  private async reboot(): Promise<void> {
    try {
      await this.sendBytes(
        new Uint8Array([PX4SerialFlasher.REBOOT, PX4SerialFlasher.EOC])
      );
      // Device may reset immediately, don't wait for response
    } catch {
      // Expected — device resets after REBOOT
    }
  }

  // ── Low-level Helpers ──────────────────────────────────

  /** Send raw bytes to the serial port. */
  private async sendBytes(data: Uint8Array): Promise<void> {
    if (!this.writer) throw new Error("Serial port not open");
    await this.writer.write(data);
  }

  /** Read exact number of bytes from serial with timeout. */
  private async waitForBytes(
    count: number,
    timeoutMs = PX4SerialFlasher.DEFAULT_TIMEOUT,
  ): Promise<number[]> {
    if (!this.reader) throw new Error("Serial port not open");

    const deadline = Date.now() + timeoutMs;

    while (this.readBuffer.length < count) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        throw new Error(
          `Serial read timeout: expected ${count} bytes, got ${this.readBuffer.length}`
        );
      }

      const result = await Promise.race([
        this.reader.read(),
        new Promise<{ value: undefined; done: true }>((resolve) =>
          setTimeout(() => resolve({ value: undefined, done: true }), remaining)
        ),
      ]);

      if (result.value) {
        for (const byte of result.value) {
          this.readBuffer.push(byte);
        }
      }
      if (result.done && !result.value) {
        throw new Error("Serial read timeout");
      }
    }

    return this.readBuffer.splice(0, count);
  }

  /**
   * Expect the standard PX4 bootloader response: [INSYNC, OK].
   * Throws on FAILED, INVALID, or unexpected response.
   */
  private async expectInsyncOk(
    timeoutMs = PX4SerialFlasher.DEFAULT_TIMEOUT,
  ): Promise<void> {
    const response = await this.waitForBytes(2, timeoutMs);

    if (response[0] !== PX4SerialFlasher.INSYNC) {
      throw new Error(
        `PX4 bootloader: expected INSYNC (0x12), got 0x${response[0].toString(16)}`
      );
    }

    if (response[1] === PX4SerialFlasher.FAILED) {
      throw new Error("PX4 bootloader: operation FAILED");
    }
    if (response[1] === PX4SerialFlasher.INVALID) {
      throw new Error("PX4 bootloader: INVALID command");
    }
    if (response[1] !== PX4SerialFlasher.OK) {
      throw new Error(
        `PX4 bootloader: expected OK (0x10), got 0x${response[1].toString(16)}`
      );
    }
  }

  /** Flatten all firmware blocks into a single contiguous Uint8Array. */
  private flattenFirmware(firmware: ParsedFirmware): Uint8Array {
    if (firmware.blocks.length === 1) {
      return firmware.blocks[0].data;
    }

    // Multiple blocks: concatenate in order
    const total = firmware.blocks.reduce((sum, b) => sum + b.data.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    for (const block of firmware.blocks) {
      result.set(block.data, offset);
      offset += block.data.length;
    }
    return result;
  }

  /** Check if abort was requested. */
  private checkAbort(): void {
    if (this.aborted) {
      throw new Error("Flash aborted by user");
    }
  }

  /** Small delay helper. */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
