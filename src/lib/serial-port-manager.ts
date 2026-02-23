/**
 * Serial port manager — wraps navigator.serial for port lifecycle.
 * Provides port enumeration, labeling, and hot-plug detection.
 */

/// <reference path="./protocol/web-serial.d.ts" />

export interface PortInfo {
  port: SerialPort;
  label: string;
  vendorId?: number;
  productId?: number;
}

type PortEventHandler = (info: PortInfo) => void;

class SerialPortManagerImpl {
  private connectHandlers = new Set<PortEventHandler>();
  private disconnectHandlers = new Set<PortEventHandler>();
  private initialized = false;

  /** Check if Web Serial API is available. */
  isSupported(): boolean {
    return typeof navigator !== "undefined" && "serial" in navigator;
  }

  /** Initialize event listeners (call once on app mount). */
  init(): void {
    if (this.initialized || !this.isSupported()) return;
    this.initialized = true;

    navigator.serial.addEventListener("connect", (e: Event) => {
      const port = (e as unknown as { target: SerialPort }).target;
      if (port && "getInfo" in port) {
        const info = this.buildPortInfo(port);
        this.connectHandlers.forEach((h) => h(info));
      }
    });

    navigator.serial.addEventListener("disconnect", (e: Event) => {
      const port = (e as unknown as { target: SerialPort }).target;
      if (port && "getInfo" in port) {
        const info = this.buildPortInfo(port);
        this.disconnectHandlers.forEach((h) => h(info));
      }
    });
  }

  /** Get all previously-permitted serial ports (no user prompt). */
  async getKnownPorts(): Promise<PortInfo[]> {
    if (!this.isSupported()) return [];
    try {
      const ports = await navigator.serial.getPorts();
      return ports.map((port, i) => this.buildPortInfo(port, i));
    } catch {
      return [];
    }
  }

  /** Open browser port picker and return the selected port. */
  async requestNewPort(): Promise<PortInfo> {
    if (!this.isSupported()) {
      throw new Error("Web Serial not supported");
    }
    const port = await navigator.serial.requestPort();
    return this.buildPortInfo(port);
  }

  /** Build a human-readable label for a serial port. */
  getPortLabel(port: SerialPort): string {
    return this.buildPortInfo(port).label;
  }

  /** Subscribe to hot-plug connect events. Returns unsubscribe function. */
  onConnect(handler: PortEventHandler): () => void {
    this.connectHandlers.add(handler);
    return () => this.connectHandlers.delete(handler);
  }

  /** Subscribe to hot-plug disconnect events. Returns unsubscribe function. */
  onDisconnect(handler: PortEventHandler): () => void {
    this.disconnectHandlers.add(handler);
    return () => this.disconnectHandlers.delete(handler);
  }

  private buildPortInfo(port: SerialPort, index?: number): PortInfo {
    const info = port.getInfo();
    const vid = info.usbVendorId;
    const pid = info.usbProductId;

    let label: string;
    if (vid !== undefined && pid !== undefined) {
      const vendor = USB_DEVICES[vid];
      const productName = vendor?.products?.[pid];
      if (productName) {
        label = `${productName} (${hex(vid)}:${hex(pid)})`;
      } else if (vendor) {
        label = `${vendor.name} (${hex(vid)}:${hex(pid)})`;
      } else {
        label = `USB Serial (${hex(vid)}:${hex(pid)})`;
      }
    } else {
      label = index !== undefined ? `Serial Port ${index + 1}` : "Serial Port";
    }

    return { port, label, vendorId: vid, productId: pid };
  }
}

function hex(n: number): string {
  return n.toString(16).toUpperCase().padStart(4, "0");
}

/** USB device database — VID → vendor name + optional PID → product name. */
const USB_DEVICES: Record<number, { name: string; products?: Record<number, string> }> = {
  0x0403: { name: "FTDI", products: {
    0x6001: "FTDI FT232R",
    0x6010: "FTDI FT2232H",
    0x6015: "FTDI FT230X",
  }},
  0x0483: { name: "STMicroelectronics", products: {
    0x5740: "STM32 Flight Controller",
    0x374E: "STLink Virtual COM",
  }},
  0x10C4: { name: "Silicon Labs", products: {
    0xEA60: "Silicon Labs CP2102",
    0xEA70: "Silicon Labs CP2105",
  }},
  0x1A86: { name: "CH340/CH341", products: {
    0x7523: "CH340",
    0x5523: "CH341A",
  }},
  0x2341: { name: "Arduino" },
  0x239A: { name: "Adafruit" },
  0x1209: { name: "Open Source Hardware", products: {
    0x5740: "ArduPilot ChibiOS",
  }},
  0x2DAE: { name: "Holybro" },
  0x27AC: { name: "CubePilot" },
  0x3162: { name: "mRo" },
  0x26AC: { name: "3DR / PX4", products: {
    0x0001: "PX4 FMU v2",
    0x0011: "PX4 ChibiOS",
    0x0012: "PixRacer",
    0x0032: "Pixhawk 4",
  }},
  0x1FC9: { name: "NXP" },
  0x067B: { name: "Prolific", products: {
    0x2303: "Prolific PL2303",
  }},
  0x2E8A: { name: "Raspberry Pi" },
  0x29AC: { name: "GD32" },
  0x2E3C: { name: "AT32" },
};

/** Singleton serial port manager. */
export const serialPortManager = new SerialPortManagerImpl();
