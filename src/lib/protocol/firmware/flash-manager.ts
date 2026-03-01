/**
 * Firmware flash orchestration layer.
 *
 * Coordinates the full flash workflow: parameter backup → reboot to
 * bootloader → detect bootloader → erase → flash → verify → reboot →
 * parameter restore. Bridges the protocol layer with the low-level
 * STM32 serial and DFU flashers.
 *
 * @module protocol/firmware/flash-manager
 */

import type {
  DroneProtocol,
  Transport,
  ParameterValue,
} from "../types";
import type {
  FlashOptions,
  FlashProgress,
  FlashProgressCallback,
  ParsedFirmware,
  FirmwareFlasher,
} from "./types";
import { STM32SerialFlasher } from "./stm32-serial";
import { STM32DfuFlasher } from "./stm32-dfu";
import { PX4SerialFlasher } from "./px4-serial";

// ── Progress Phase Ranges ──────────────────────────────────
//
// Backup:          0-5%
// Reboot:          5-8%
// Bootloader init: 8-10%
// Erase:           10-25%
// Flash:           25-75%
// Verify:          75-95%
// Reboot+Restore:  95-100%

// ── FlashManager ───────────────────────────────────────────

export class FlashManager {
  private protocol: DroneProtocol | null;
  private transport: Transport | null;
  private abortController: AbortController | null = null;
  private flasher: FirmwareFlasher | null = null;
  private backedUpParams: ParameterValue[] | null = null;

  constructor(protocol: DroneProtocol | null, transport: Transport | null) {
    this.protocol = protocol;
    this.transport = transport;
  }

  /**
   * Execute the full firmware flash workflow.
   *
   * @param firmware — Parsed firmware image to flash
   * @param options — Flash configuration (method, backup, verify)
   * @param onProgress — Progress callback
   */
  async flash(
    firmware: ParsedFirmware,
    options: FlashOptions,
    onProgress: FlashProgressCallback,
  ): Promise<void> {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    try {
      // ── Step 1: Backup parameters ────────────────────
      if (options.backupParams && this.protocol?.isConnected) {
        onProgress({ phase: "backup", percent: 1, message: "Backing up parameters..." });
        this.backedUpParams = await this.backupParameters();
        onProgress({
          phase: "backup",
          percent: 5,
          message: `Backed up ${this.backedUpParams.length} parameters`,
        });
      }

      this.checkAbort(signal);

      // ── Step 2: Reboot to bootloader ─────────────────
      if (this.protocol?.isConnected) {
        onProgress({ phase: "rebooting", percent: 5, message: "Rebooting to bootloader..." });
        await this.rebootToBootloader();
        onProgress({ phase: "rebooting", percent: 8, message: "Waiting for bootloader..." });
        // Give the FC time to reboot into bootloader
        await this.delay(2000);
      }

      this.checkAbort(signal);

      // ── Step 3: Detect and connect to bootloader ─────
      onProgress({ phase: "bootloader_init", percent: 8, message: "Connecting to bootloader..." });
      this.flasher = await this.detectBootloader(options.method);

      this.checkAbort(signal);

      // ── Step 4: Flash firmware ───────────────────────
      // The flasher handles erase + write + progress internally
      await this.flasher.flash(firmware, onProgress, signal);

      this.checkAbort(signal);

      // ── Step 5: Verify (optional) ────────────────────
      if (options.verify) {
        onProgress({ phase: "verifying", percent: 75, message: "Verifying firmware..." });
        await this.flasher.verify(firmware, onProgress, signal);
      }

      // ── Step 6: Restore parameters ───────────────────
      if (this.backedUpParams && this.backedUpParams.length > 0) {
        onProgress({ phase: "restoring", percent: 96, message: "Waiting for firmware to boot..." });
        await this.delay(5000); // Wait for FC to boot new firmware

        onProgress({
          phase: "restoring",
          percent: 97,
          message: `Restoring ${this.backedUpParams.length} parameters...`,
        });
        await this.restoreParameters(this.backedUpParams, onProgress);
      }

      onProgress({ phase: "done", percent: 100, message: "Firmware update complete!" });
    } catch (err) {
      if (signal.aborted) {
        onProgress({ phase: "error", percent: 0, message: "Flash aborted by user" });
      } else {
        onProgress({
          phase: "error",
          percent: 0,
          message: err instanceof Error ? err.message : "Unknown flash error",
        });
      }
      throw err;
    } finally {
      // Clean up flasher
      if (this.flasher) {
        await this.flasher.dispose().catch(() => {});
        this.flasher = null;
      }
    }
  }

  /** Cancel an in-progress flash operation. */
  abort(): void {
    this.abortController?.abort();
    this.flasher?.abort();
  }

  // ── Workflow Steps ─────────────────────────────────────

  private async backupParameters(): Promise<ParameterValue[]> {
    if (!this.protocol) return [];
    try {
      return await this.protocol.getAllParameters();
    } catch (err) {
      console.warn("Parameter backup failed:", err);
      return [];
    }
  }

  private async rebootToBootloader(): Promise<void> {
    if (!this.protocol) return;
    try {
      await this.protocol.rebootToBootloader();
    } catch {
      // FC may disconnect immediately — that's expected
    }
  }

  private async detectBootloader(method: "serial" | "dfu" | "auto" | "px4-serial"): Promise<FirmwareFlasher> {
    if (method === "px4-serial") {
      let port: SerialPort | null = null;
      if (this.transport && "getPort" in this.transport) {
        port = (this.transport as { getPort(): SerialPort | null }).getPort();
        if (port) {
          await this.transport.disconnect();
        }
      }
      if (!port) {
        port = await PX4SerialFlasher.requestPort();
      }
      return new PX4SerialFlasher(port);
    }

    if (method === "auto") {
      // Auto: check for already-permitted DFU devices first (no picker)
      if (STM32DfuFlasher.isSupported()) {
        const knownDfu = await STM32DfuFlasher.getKnownDevices();
        if (knownDfu.length > 0) {
          return new STM32DfuFlasher(knownDfu[0].device);
        }
      }
      // No known DFU device → try serial, then DFU picker as last resort
      try {
        return await this.detectBootloader("serial");
      } catch {
        return await this.detectBootloader("dfu");
      }
    }

    if (method === "dfu") {
      if (!STM32DfuFlasher.isSupported()) {
        throw new Error("WebUSB not supported in this browser. Use Chrome or Edge.");
      }
      // Reuse already-permitted device (no picker needed)
      const known = await STM32DfuFlasher.getKnownDevices();
      if (known.length > 0) {
        return new STM32DfuFlasher(known[0].device);
      }
      // Fall back to picker
      const device = await STM32DfuFlasher.requestDevice();
      return new STM32DfuFlasher(device);
    }

    // Serial method
    // Try to get the existing port from transport, otherwise request new one
    let port: SerialPort | null = null;

    if (this.transport && "getPort" in this.transport) {
      port = (this.transport as { getPort(): SerialPort | null }).getPort();
      if (port) {
        // Release the port so the bootloader flasher can open it.
        // At this point the FC has rebooted into bootloader — MAVLink is gone.
        await this.transport.disconnect();
      }
    }

    if (!port) {
      port = await STM32SerialFlasher.requestPort();
    }

    return new STM32SerialFlasher(port);
  }

  private async restoreParameters(
    params: ParameterValue[],
    onProgress: FlashProgressCallback,
  ): Promise<void> {
    // At this point the FC has rebooted with new firmware.
    // We need a fresh MAVLink connection to restore parameters.
    // If the protocol is still connected, use it. Otherwise skip.
    if (!this.protocol?.isConnected) {
      onProgress({
        phase: "restoring",
        percent: 99,
        message: "FC not connected — reconnect and restore parameters manually from .param backup file",
      });
      return;
    }

    let restored = 0;
    let failed = 0;
    for (const param of params) {
      try {
        const result = await this.protocol.setParameter(param.name, param.value, param.type);
        if (result.success) restored++;
        else failed++;
      } catch {
        failed++;
      }
    }

    onProgress({
      phase: "restoring",
      percent: 99,
      message: `Restored ${restored} parameters${failed > 0 ? ` (${failed} failed)` : ""}`,
    });
  }

  // ── Helpers ────────────────────────────────────────────

  private checkAbort(signal: AbortSignal): void {
    if (signal.aborted) throw new Error("Flash aborted by user");
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
