import type { HardwareComponent, HardwareConnection } from "@/lib/types";

export const MOCK_HARDWARE_COMPONENTS: HardwareComponent[] = [
  { id: "cm4", name: "Raspberry Pi CM4", type: "compute", status: "ok", details: { cpu: "BCM2711", ram: "4GB", storage: "32GB eMMC" } },
  { id: "stm32", name: "STM32H743", type: "fc", status: "ok", details: { firmware: "ArduPilot 4.5", mcu: "Cortex-M7 480MHz" } },
  { id: "imu1", name: "ICM-42688-P", type: "sensor", status: "ok", details: { type: "IMU", axes: "6-axis" } },
  { id: "imu2", name: "ICM-20649", type: "sensor", status: "ok", details: { type: "IMU Backup", axes: "6-axis" } },
  { id: "baro", name: "BMP390", type: "sensor", status: "ok", details: { type: "Barometer", range: "300-1250 hPa" } },
  { id: "mag", name: "IST8310", type: "sensor", status: "ok", details: { type: "Magnetometer" } },
  { id: "gps1", name: "u-blox M10", type: "gps", status: "ok", details: { type: "GNSS", constellations: "GPS+GLONASS+BDS+Galileo" } },
  { id: "cam-main", name: "IMX462 Main", type: "camera", status: "ok", details: { resolution: "1080p", fov: "120°", sensor: "1/2.8\"" } },
  { id: "cam-thermal", name: "FLIR Lepton 3.5", type: "camera", status: "warning", details: { resolution: "160x120", type: "Thermal" } },
  { id: "radio-wifi", name: "RTL8812EU", type: "radio", status: "ok", details: { protocol: "WFB-ng", band: "5.8GHz", power: "29dBm" } },
  { id: "radio-4g", name: "Quectel EC25", type: "radio", status: "ok", details: { type: "4G LTE", bands: "B1/B3/B5/B8/B40/B41" } },
  { id: "esc1", name: "ESC 1", type: "esc", status: "ok", details: { current: "35A", protocol: "DShot600" } },
  { id: "esc2", name: "ESC 2", type: "esc", status: "ok", details: { current: "35A", protocol: "DShot600" } },
  { id: "esc3", name: "ESC 3", type: "esc", status: "ok", details: { current: "35A", protocol: "DShot600" } },
  { id: "esc4", name: "ESC 4", type: "esc", status: "ok", details: { current: "35A", protocol: "DShot600" } },
  { id: "motor1", name: "Motor 1 (FL)", type: "motor", status: "ok", details: { kv: "1300", size: "2806.5" } },
  { id: "motor2", name: "Motor 2 (FR)", type: "motor", status: "ok", details: { kv: "1300", size: "2806.5" } },
  { id: "motor3", name: "Motor 3 (RL)", type: "motor", status: "ok", details: { kv: "1300", size: "2806.5" } },
  { id: "motor4", name: "Motor 4 (RR)", type: "motor", status: "ok", details: { kv: "1300", size: "2806.5" } },
  { id: "battery", name: "LiPo 6S 2200mAh", type: "battery", status: "ok", details: { cells: "6S", capacity: "2200mAh", voltage: "22.2V" } },
  { id: "frame", name: "Chimera7 Pro V2", type: "frame", status: "ok", details: { size: "7\"", wheelbase: "320mm", weight: "180g" } },
];

export const MOCK_HARDWARE_CONNECTIONS: HardwareConnection[] = [
  // CM4 connections
  { id: "c1", source: "cm4", target: "stm32", protocol: "UART", label: "MAVLink 921600" },
  { id: "c2", source: "cm4", target: "cam-main", protocol: "CSI", label: "MIPI CSI-2" },
  { id: "c3", source: "cm4", target: "radio-wifi", protocol: "USB", label: "USB 2.0" },
  { id: "c4", source: "cm4", target: "radio-4g", protocol: "USB", label: "USB 2.0" },
  // FC connections
  { id: "c5", source: "stm32", target: "imu1", protocol: "SPI", label: "SPI 8MHz" },
  { id: "c6", source: "stm32", target: "imu2", protocol: "SPI", label: "SPI 8MHz" },
  { id: "c7", source: "stm32", target: "baro", protocol: "I2C", label: "I2C 400kHz" },
  { id: "c8", source: "stm32", target: "mag", protocol: "I2C", label: "I2C 400kHz" },
  { id: "c9", source: "stm32", target: "gps1", protocol: "UART", label: "UART 115200" },
  // ESC connections
  { id: "c10", source: "stm32", target: "esc1", protocol: "PWM", label: "DShot600" },
  { id: "c11", source: "stm32", target: "esc2", protocol: "PWM", label: "DShot600" },
  { id: "c12", source: "stm32", target: "esc3", protocol: "PWM", label: "DShot600" },
  { id: "c13", source: "stm32", target: "esc4", protocol: "PWM", label: "DShot600" },
  // Motor connections
  { id: "c14", source: "esc1", target: "motor1", protocol: "PWM", label: "3-phase" },
  { id: "c15", source: "esc2", target: "motor2", protocol: "PWM", label: "3-phase" },
  { id: "c16", source: "esc3", target: "motor3", protocol: "PWM", label: "3-phase" },
  { id: "c17", source: "esc4", target: "motor4", protocol: "PWM", label: "3-phase" },
  // Power
  { id: "c18", source: "battery", target: "stm32", protocol: "CAN", label: "Power Monitor" },
  // Thermal camera to CM4
  { id: "c19", source: "cm4", target: "cam-thermal", protocol: "SPI", label: "SPI VoSPI" },
];
