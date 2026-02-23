/**
 * STM32 USB DFU v1.1 + DFuSe extensions via WebUSB API.
 *
 * For flight controllers that expose a native USB DFU interface
 * (e.g. STM32H743 boards without USB-UART bridge). Secondary
 * flash method — most FCs use the serial bootloader instead.
 *
 * Reference: betaflight-configurator/src/js/protocols/webusbdfu.js
 *
 * @module protocol/firmware/stm32-dfu
 */

/// <reference path="../web-usb.d.ts" />

import type {
  FirmwareFlasher,
  FlashProgressCallback,
  ParsedFirmware,
  DfuFlashLayout,
  DfuSector,
} from "./types";
import { DFU_STATE, DFU_STATE_NAME } from "./types";
import { usbDeviceManager, type UsbDeviceInfo } from "../../usb-device-manager";

// DFU class requests
const DFU_DETACH = 0x00;
const DFU_DNLOAD = 0x01;
const DFU_UPLOAD = 0x02;
const DFU_GETSTATUS = 0x03;
const DFU_CLRSTATUS = 0x04;
const DFU_GETSTATE = 0x05;
const DFU_ABORT = 0x06;

// DFuSe commands (sent via DNLOAD with wBlockNum=0)
const DFUSE_CMD_SET_ADDRESS = 0x21;
const DFUSE_CMD_ERASE = 0x41;
const DFUSE_CMD_READ_UNPROTECT = 0x92;

/** Default transfer size if functional descriptor is unavailable. */
const DEFAULT_TRANSFER_SIZE = 2048;

/** Timeout for DFU operations (ms). */
const DFU_TIMEOUT = 5000;

/** Timeout for erase operations (ms). */
const ERASE_TIMEOUT = 30000;

// ── STM32DfuFlasher ────────────────────────────────────────

export class STM32DfuFlasher implements FirmwareFlasher {
  readonly method = "dfu" as const;

  private device: USBDevice;
  private interfaceNumber = 0;
  private transferSize = DEFAULT_TRANSFER_SIZE;
  private flashLayout: DfuFlashLayout | null = null;
  private aborted = false;

  constructor(device: USBDevice) {
    this.device = device;
  }

  /** Check if WebUSB is available in this browser (including secure context). */
  static isSupported(): boolean {
    return usbDeviceManager.isSupported();
  }

  /** Open browser USB device picker for DFU devices (all supported MCUs). */
  static async requestDevice(): Promise<USBDevice> {
    return usbDeviceManager.requestDevice();
  }

  /** Get previously-permitted DFU devices without user prompt. */
  static async getKnownDevices(): Promise<UsbDeviceInfo[]> {
    return usbDeviceManager.getKnownDevices();
  }

  // ── Public Interface ───────────────────────────────────

  async flash(firmware: ParsedFirmware, onProgress: FlashProgressCallback, signal?: AbortSignal): Promise<void> {
    this.aborted = false;
    if (signal) signal.addEventListener("abort", () => this.abort(), { once: true });

    try {
      // Open and claim interface
      onProgress({ phase: "bootloader_init", percent: 8, message: "Opening USB device..." });
      await this.openAndClaim();

      // Read chip info from DFuSe descriptors
      onProgress({ phase: "chip_detect", percent: 10, message: "Reading flash layout..." });
      this.flashLayout = await this.getFlashLayout();
      this.transferSize = await this.getTransferSize();

      if (this.flashLayout) {
        onProgress({
          phase: "chip_detect",
          percent: 12,
          message: `Flash: ${this.flashLayout.name} (${(this.flashLayout.totalSize / 1024)}KB), transfer size: ${this.transferSize}`,
        });
      }

      // Clear any error state
      await this.clearStatus();

      this.checkAbort();

      // Erase pages covered by firmware
      if (this.flashLayout) {
        // Validate firmware fits in flash
        if (firmware.totalBytes > this.flashLayout.totalSize) {
          throw new Error(
            `Firmware (${firmware.totalBytes} bytes) exceeds flash size (${this.flashLayout.totalSize} bytes)`
          );
        }
        onProgress({ phase: "erasing", percent: 15, message: "Erasing flash sectors..." });
        await this.erasePages(firmware, onProgress);
      } else {
        console.warn("[DFU] Flash layout unavailable — falling back to mass erase");
        await this.massErase(onProgress);
      }
      onProgress({ phase: "erasing", percent: 25, message: "Erase complete" });

      this.checkAbort();

      // Write firmware
      await this.writeBlocks(firmware, onProgress);

      this.checkAbort();

      // Leave DFU mode — device reboots into application
      onProgress({ phase: "restarting", percent: 95, message: "Leaving DFU mode..." });
      const startAddress = firmware.blocks[0]?.address ?? 0x08000000;
      await this.leave(startAddress);

      onProgress({ phase: "done", percent: 100, message: "Flash complete!" });
    } finally {
      await this.releaseDevice();
    }
  }

  async verify(firmware: ParsedFirmware, onProgress: FlashProgressCallback, signal?: AbortSignal): Promise<void> {
    this.aborted = false;
    if (signal) signal.addEventListener("abort", () => this.abort(), { once: true });

    const totalBytes = firmware.totalBytes;
    let verifiedBytes = 0;

    try {
      await this.openAndClaim();
      if (!this.flashLayout) {
        this.flashLayout = await this.getFlashLayout();
      }
      this.transferSize = await this.getTransferSize();
      await this.clearStatus();

      for (const block of firmware.blocks) {
        // Clear state before loading address — required when transitioning from
        // dfuUPLOAD_IDLE (after reading previous block) back to dfuIDLE for DNLOAD
        await this.clearStatus();

        // Load address for reading
        await this.loadAddress(block.address);

        let offset = 0;
        let blockNum = 2; // DFuSe reads start at block 2
        while (offset < block.data.length) {
          this.checkAbort();

          const chunkSize = Math.min(this.transferSize, block.data.length - offset);
          const readData = await this.readBlock(blockNum, chunkSize);

          // Compare bytes
          for (let i = 0; i < chunkSize; i++) {
            if (readData[i] !== block.data[offset + i]) {
              throw new Error(
                `Verification failed at 0x${(block.address + offset + i).toString(16).toUpperCase()}`
              );
            }
          }

          verifiedBytes += chunkSize;
          offset += chunkSize;
          blockNum++;

          const percent = 75 + Math.round((verifiedBytes / totalBytes) * 20);
          onProgress({
            phase: "verifying",
            percent,
            message: `Verifying... ${verifiedBytes}/${totalBytes} bytes`,
            bytesWritten: verifiedBytes,
            bytesTotal: totalBytes,
            phasePercent: Math.round((verifiedBytes / totalBytes) * 100),
          });
        }
      }
    } finally {
      await this.releaseDevice();
    }
  }

  abort(): void {
    this.aborted = true;
  }

  async dispose(): Promise<void> {
    await this.releaseDevice();
  }

  // ── USB Device Management ──────────────────────────────

  private async openAndClaim(): Promise<void> {
    if (!this.device.opened) {
      await this.device.open();
    }
    if (this.device.configuration === null) {
      await this.device.selectConfiguration(1);
    }

    // Find DFU interface (class 0xFE, subclass 0x01)
    const iface = this.device.configuration?.interfaces.find((i) =>
      i.alternates.some((a) => a.interfaceClass === 0xfe && a.interfaceSubclass === 0x01)
    );
    if (!iface) {
      throw new Error("No DFU interface found on this USB device");
    }

    this.interfaceNumber = iface.interfaceNumber;
    await this.device.claimInterface(this.interfaceNumber);

    // Select alternate with Internal Flash — broad match then fallback to first DFU alternate
    const flashAlt = iface.alternates.find(
      (a) => a.interfaceClass === 0xfe && a.interfaceSubclass === 0x01 &&
        (a.interfaceName?.includes("Flash") || a.interfaceName?.includes("@Internal"))
    ) ?? iface.alternates.find(
      (a) => a.interfaceClass === 0xfe && a.interfaceSubclass === 0x01
    );
    if (flashAlt) {
      await this.device.selectAlternateInterface(this.interfaceNumber, flashAlt.alternateSetting);
    }
  }

  private async releaseDevice(): Promise<void> {
    try {
      if (this.device.opened) {
        await this.device.releaseInterface(this.interfaceNumber).catch(() => {});
        await this.device.close().catch(() => {});
      }
    } catch {
      // Ignore close errors
    }
  }

  // ── DFU Protocol Operations ────────────────────────────

  /** DFU_GETSTATUS — read 6-byte status response. */
  private async getStatus(): Promise<{ status: number; pollTimeout: number; state: number }> {
    const result = await this.device.controlTransferIn(
      { requestType: "class", recipient: "interface", request: DFU_GETSTATUS, value: 0, index: this.interfaceNumber },
      6
    );
    if (!result.data || result.data.byteLength < 6) {
      throw new Error("Invalid DFU_GETSTATUS response");
    }
    const data = result.data;
    return {
      status: data.getUint8(0),
      pollTimeout: data.getUint8(1) | (data.getUint8(2) << 8) | (data.getUint8(3) << 16),
      state: data.getUint8(4),
    };
  }

  /** DFU_CLRSTATUS + poll until dfuIDLE. */
  private async clearStatus(): Promise<void> {
    // Send CLRSTATUS
    await this.device.controlTransferOut(
      { requestType: "class", recipient: "interface", request: DFU_CLRSTATUS, value: 0, index: this.interfaceNumber }
    );

    // Poll until idle
    for (let i = 0; i < 10; i++) {
      const status = await this.getStatus();
      if (status.state === DFU_STATE.dfuIDLE) return;
      if (status.state === DFU_STATE.dfuERROR) {
        await this.device.controlTransferOut(
          { requestType: "class", recipient: "interface", request: DFU_CLRSTATUS, value: 0, index: this.interfaceNumber }
        );
      }
      await this.delay(status.pollTimeout || 100);
    }
    throw new Error("Failed to reach dfuIDLE state");
  }

  /** DFuSe: Load address pointer. */
  private async loadAddress(address: number): Promise<void> {
    const data = new Uint8Array([
      DFUSE_CMD_SET_ADDRESS,
      address & 0xff,
      (address >> 8) & 0xff,
      (address >> 16) & 0xff,
      (address >> 24) & 0xff,
    ]);

    await this.device.controlTransferOut(
      { requestType: "class", recipient: "interface", request: DFU_DNLOAD, value: 0, index: this.interfaceNumber },
      data
    );

    await this.pollUntilIdle(DFU_TIMEOUT);
  }

  /** DFuSe: Erase a flash page at address. */
  private async erasePage(address: number): Promise<void> {
    const data = new Uint8Array([
      DFUSE_CMD_ERASE,
      address & 0xff,
      (address >> 8) & 0xff,
      (address >> 16) & 0xff,
      (address >> 24) & 0xff,
    ]);

    await this.device.controlTransferOut(
      { requestType: "class", recipient: "interface", request: DFU_DNLOAD, value: 0, index: this.interfaceNumber },
      data
    );

    await this.pollUntilIdle(ERASE_TIMEOUT);
  }

  /** DFuSe: Mass erase all flash — fallback when flash layout is unavailable. */
  private async massErase(onProgress: FlashProgressCallback): Promise<void> {
    onProgress({ phase: "erasing", percent: 15, message: "Mass erasing flash (descriptor unavailable)..." });
    const data = new Uint8Array([DFUSE_CMD_ERASE]);
    await this.device.controlTransferOut(
      { requestType: "class", recipient: "interface", request: DFU_DNLOAD, value: 0, index: this.interfaceNumber },
      data,
    );
    await this.pollUntilIdle(ERASE_TIMEOUT);
  }

  /** DFU_DNLOAD — write a data block. */
  private async writeBlock(blockNum: number, data: Uint8Array): Promise<void> {
    await this.device.controlTransferOut(
      { requestType: "class", recipient: "interface", request: DFU_DNLOAD, value: blockNum, index: this.interfaceNumber },
      data
    );

    await this.pollUntilIdle(DFU_TIMEOUT);
  }

  /** DFU_UPLOAD — read a data block. */
  private async readBlock(blockNum: number, length: number): Promise<Uint8Array> {
    const result = await this.device.controlTransferIn(
      { requestType: "class", recipient: "interface", request: DFU_UPLOAD, value: blockNum, index: this.interfaceNumber },
      length
    );
    if (!result.data) {
      throw new Error("No data in DFU_UPLOAD response");
    }
    return new Uint8Array(result.data.buffer, result.data.byteOffset, result.data.byteLength);
  }

  /** Leave DFU mode — load start address + zero-length DNLOAD → device reboots. */
  private async leave(startAddress: number): Promise<void> {
    await this.loadAddress(startAddress);

    // Zero-length DNLOAD triggers manifest/reset
    try {
      await this.device.controlTransferOut(
        { requestType: "class", recipient: "interface", request: DFU_DNLOAD, value: 0, index: this.interfaceNumber }
      );
      // Try to get status — device may have already reset
      await this.getStatus().catch(() => {});
    } catch {
      // Expected — device resets
    }
  }

  /** Poll GETSTATUS until state is dfuDNLOAD_IDLE or dfuIDLE. */
  private async pollUntilIdle(timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const status = await this.getStatus();

      if (status.state === DFU_STATE.dfuDNLOAD_IDLE || status.state === DFU_STATE.dfuIDLE) {
        return;
      }

      if (status.state === DFU_STATE.dfuERROR) {
        // H743 workaround: extra CLRSTATUS if stuck in error after erase
        await this.device.controlTransferOut(
          { requestType: "class", recipient: "interface", request: DFU_CLRSTATUS, value: 0, index: this.interfaceNumber }
        );
        const retryStatus = await this.getStatus();
        if (retryStatus.state === DFU_STATE.dfuIDLE || retryStatus.state === DFU_STATE.dfuDNLOAD_IDLE) {
          return;
        }
        const stateName = DFU_STATE_NAME[status.state] ?? `unknown(${status.state})`;
        throw new Error(`DFU error state: ${stateName}, status: ${status.status}`);
      }

      // Wait the poll timeout suggested by the device (capped at 5s for safety)
      await this.delay(Math.min(Math.max(status.pollTimeout, 50), 5000));
    }

    // H743 Rev.V workaround: device stays in dfuDNBUSY indefinitely during erase.
    // Try double-CLRSTATUS recovery before giving up.
    try {
      const lastStatus = await this.getStatus();
      if (lastStatus.state === DFU_STATE.dfuDNBUSY || lastStatus.state === DFU_STATE.dfuDNLOAD_SYNC) {
        await this.device.controlTransferOut(
          { requestType: "class", recipient: "interface", request: DFU_CLRSTATUS, value: 0, index: this.interfaceNumber }
        );
        await this.getStatus();
        await this.device.controlTransferOut(
          { requestType: "class", recipient: "interface", request: DFU_CLRSTATUS, value: 0, index: this.interfaceNumber }
        );
        const recovered = await this.getStatus();
        if (recovered.state === DFU_STATE.dfuIDLE || recovered.state === DFU_STATE.dfuDNLOAD_IDLE) {
          return;
        }
      }
    } catch {
      // Recovery failed — fall through to throw
    }

    throw new Error("DFU poll timeout");
  }

  // ── DFuSe Descriptor Parsing ───────────────────────────

  /** Read a USB string descriptor by index. Returns decoded string or null on failure. */
  private async readStringDescriptor(index: number): Promise<string | null> {
    if (index === 0) return null;
    try {
      const result = await this.device.controlTransferIn(
        { requestType: "standard", recipient: "device", request: 6, value: 0x0300 | index, index: 0 },
        255,
      );
      if (!result.data || result.data.byteLength < 4) return null;
      const length = result.data.getUint8(0);
      let str = "";
      for (let i = 2; i < length && i < result.data.byteLength; i += 2) {
        str += String.fromCharCode(result.data.getUint16(i, true));
      }
      return str || null;
    } catch {
      return null;
    }
  }

  /** Read raw USB configuration descriptor. Returns DataView or null on failure. */
  private async readConfigDescriptor(): Promise<DataView | null> {
    try {
      // First read to get total length (wTotalLength at bytes 2-3)
      const header = await this.device.controlTransferIn(
        { requestType: "standard", recipient: "device", request: 6, value: 0x0200, index: 0 },
        4,
      );
      if (!header.data || header.data.byteLength < 4) return null;
      const totalLength = header.data.getUint16(2, true);

      // Read full descriptor
      const full = await this.device.controlTransferIn(
        { requestType: "standard", recipient: "device", request: 6, value: 0x0200, index: 0 },
        totalLength,
      );
      return full.data ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Extract iInterface string index for each alternate setting from raw config descriptor.
   * Walks the descriptor chain looking for interface descriptors (type 4).
   */
  private getInterfaceStringIndices(configDesc: DataView): Map<number, number> {
    const indices = new Map<number, number>();
    let offset = 0;

    while (offset + 2 <= configDesc.byteLength) {
      const bLength = configDesc.getUint8(offset);
      const bDescriptorType = configDesc.getUint8(offset + 1);
      if (bLength === 0) break;

      // Interface descriptor: type 4, length >= 9
      if (bDescriptorType === 4 && bLength >= 9 && offset + 8 < configDesc.byteLength) {
        const bInterfaceNumber = configDesc.getUint8(offset + 2);
        const bAlternateSetting = configDesc.getUint8(offset + 3);
        const iInterface = configDesc.getUint8(offset + 8);
        if (bInterfaceNumber === this.interfaceNumber && iInterface > 0) {
          indices.set(bAlternateSetting, iInterface);
        }
      }

      offset += bLength;
    }

    return indices;
  }

  /**
   * Parse flash layout from USB alternate setting interface name.
   * Format: "@Internal Flash /0x08000000/04*016Kg,01*064Kg,07*128Kg"
   *
   * 3-layer fallback:
   * 1. Try alt.interfaceName (Chrome-cached string descriptor)
   * 2. Manually read string descriptors via USB control transfers
   * 3. Return null (caller falls back to mass erase)
   */
  private async getFlashLayout(): Promise<DfuFlashLayout | null> {
    const iface = this.device.configuration?.interfaces.find(
      (i) => i.interfaceNumber === this.interfaceNumber
    );
    if (!iface) return null;

    // Collect candidate descriptor strings — try Chrome-cached names first
    const candidates: string[] = [];
    for (const alt of iface.alternates) {
      if (alt.interfaceName) candidates.push(alt.interfaceName);
    }

    // Fallback: manually read string descriptors if Chrome didn't populate them
    if (candidates.length === 0) {
      const configDesc = await this.readConfigDescriptor();
      if (configDesc) {
        const stringIndices = this.getInterfaceStringIndices(configDesc);
        for (const [, stringIndex] of stringIndices) {
          const str = await this.readStringDescriptor(stringIndex);
          if (str) candidates.push(str);
        }
      }
    }

    // Parse the first valid DFuSe descriptor string
    for (const rawName of candidates) {
      // Strip non-printable characters (F722, AT32 F437 garbage bytes)
      const name = rawName.replace(/[^\x20-\x7E]+/g, "");
      if (!name.includes("@")) continue;

      const match = name.match(/@(.+?)\/0x([0-9A-Fa-f]+)\/(.+)/);
      if (!match) continue;

      const memName = match[1].trim();
      const baseAddress = parseInt(match[2], 16);
      const sectorDesc = match[3];

      const sectors: DfuSector[] = [];
      let totalSize = 0;
      let currentAddress = baseAddress;

      // Parse sector descriptions like "04*016Kg,01*064Kg,07*128Kg"
      const parts = sectorDesc.split(",");
      for (const part of parts) {
        const sectorMatch = part.trim().match(/(\d+)\*(\d+)(.)(.)$/);
        if (!sectorMatch) continue;

        const count = parseInt(sectorMatch[1]);
        let size = parseInt(sectorMatch[2]);

        // Size multiplier
        const multiplier = sectorMatch[3];
        if (multiplier === "K" || multiplier === "k") size *= 1024;
        else if (multiplier === "M" || multiplier === "m") size *= 1024 * 1024;

        const properties = sectorMatch[4].toLowerCase();

        sectors.push({
          address: currentAddress,
          size,
          count,
          properties,
        });

        const regionSize = size * count;
        currentAddress += regionSize;
        totalSize += regionSize;
      }

      return { name: memName, baseAddress, sectors, totalSize };
    }

    return null;
  }

  /** Read wTransferSize from DFU Functional Descriptor (type 0x21). Falls back to 2048. */
  private async getTransferSize(): Promise<number> {
    const configDesc = await this.readConfigDescriptor();
    if (configDesc) {
      let offset = 0;
      while (offset + 2 <= configDesc.byteLength) {
        const bLength = configDesc.getUint8(offset);
        const bDescriptorType = configDesc.getUint8(offset + 1);
        if (bLength === 0) break;

        // DFU Functional Descriptor: 9 bytes, type 0x21
        if (bDescriptorType === 0x21 && bLength >= 7 && offset + 6 < configDesc.byteLength) {
          return configDesc.getUint16(offset + 5, true); // wTransferSize at bytes 5-6
        }
        offset += bLength;
      }
    }
    return DEFAULT_TRANSFER_SIZE;
  }

  // ── Flash Operations ───────────────────────────────────

  /** Erase all flash pages covered by firmware blocks. */
  private async erasePages(firmware: ParsedFirmware, onProgress: FlashProgressCallback): Promise<void> {
    if (!this.flashLayout) {
      throw new Error("Flash layout not available — cannot determine erase sectors");
    }

    // Collect all sector addresses that need erasing
    const sectorsToErase: number[] = [];
    for (const block of firmware.blocks) {
      const blockEnd = block.address + block.data.length;

      for (const sector of this.flashLayout.sectors) {
        for (let i = 0; i < sector.count; i++) {
          const sectorAddr = sector.address + i * sector.size;
          const sectorEnd = sectorAddr + sector.size;

          if (sectorAddr < blockEnd && sectorEnd > block.address) {
            if (!sectorsToErase.includes(sectorAddr)) {
              sectorsToErase.push(sectorAddr);
            }
          }
        }
      }
    }

    // Erase each sector
    for (let i = 0; i < sectorsToErase.length; i++) {
      this.checkAbort();
      await this.erasePage(sectorsToErase[i]);
      const percent = 15 + Math.round(((i + 1) / sectorsToErase.length) * 10);
      onProgress({
        phase: "erasing",
        percent,
        message: `Erasing sector ${i + 1}/${sectorsToErase.length} at 0x${sectorsToErase[i].toString(16)}`,
        phasePercent: Math.round(((i + 1) / sectorsToErase.length) * 100),
      });
    }
  }

  /** Write all firmware blocks via DFU_DNLOAD. */
  private async writeBlocks(firmware: ParsedFirmware, onProgress: FlashProgressCallback): Promise<void> {
    const totalBytes = firmware.totalBytes;
    let writtenBytes = 0;

    for (const block of firmware.blocks) {
      // Set address pointer
      await this.loadAddress(block.address);

      let offset = 0;
      let blockNum = 2; // DFuSe data blocks start at 2

      while (offset < block.data.length) {
        this.checkAbort();

        const chunkSize = Math.min(this.transferSize, block.data.length - offset);
        const chunk = block.data.slice(offset, offset + chunkSize);

        await this.writeBlock(blockNum, chunk);

        writtenBytes += chunkSize;
        offset += chunkSize;
        blockNum++;

        const percent = 25 + Math.round((writtenBytes / totalBytes) * 50);
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
  }

  // ── Helpers ────────────────────────────────────────────

  private checkAbort(): void {
    if (this.aborted) throw new Error("Flash aborted by user");
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
