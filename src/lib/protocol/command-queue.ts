/**
 * COMMAND_LONG + COMMAND_ACK tracking queue.
 * Sends MAVLink COMMAND_LONG messages and resolves promises when ACKs arrive.
 */

import type { CommandResult } from "./types";
import { encodeCommandLong } from "./mavlink-encoder";

// MAVLink COMMAND_ACK result codes
export const MAV_RESULT = {
  ACCEPTED: 0,
  TEMPORARILY_REJECTED: 1,
  DENIED: 2,
  UNSUPPORTED: 3,
  FAILED: 4,
  IN_PROGRESS: 5,
  CANCELLED: 6,
} as const;

const RESULT_MESSAGES: Record<number, string> = {
  [MAV_RESULT.ACCEPTED]: "Command accepted",
  [MAV_RESULT.TEMPORARILY_REJECTED]: "Command temporarily rejected",
  [MAV_RESULT.DENIED]: "Command denied",
  [MAV_RESULT.UNSUPPORTED]: "Command unsupported",
  [MAV_RESULT.FAILED]: "Command failed",
  [MAV_RESULT.IN_PROGRESS]: "Command in progress",
  [MAV_RESULT.CANCELLED]: "Command cancelled",
};

interface PendingCommand {
  command: number;
  resolve: (result: CommandResult) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class CommandQueue {
  private pending: Map<number, PendingCommand> = new Map();
  private timeout: number;

  constructor(timeoutMs: number = 3000) {
    this.timeout = timeoutMs;
  }

  /**
   * Send a COMMAND_LONG and wait for the corresponding COMMAND_ACK.
   *
   * @param command — MAV_CMD command ID
   * @param params — 7 float parameters for COMMAND_LONG
   * @param sendFn — transport.send function to transmit the encoded frame
   * @param targetSys — target system ID
   * @param targetComp — target component ID
   * @param sysId — sender system ID
   * @param compId — sender component ID
   * @returns Promise that resolves when ACK is received or times out
   */
  sendCommand(
    command: number,
    params: [number, number, number, number, number, number, number],
    sendFn: (data: Uint8Array) => void,
    targetSys: number,
    targetComp: number,
    sysId: number,
    compId: number
  ): Promise<CommandResult> {
    // If there's already a pending command with the same ID, reject the old one
    const existing = this.pending.get(command);
    if (existing) {
      clearTimeout(existing.timer);
      existing.resolve({
        success: false,
        resultCode: -1,
        message: "Superseded by new command",
      });
      this.pending.delete(command);
    }

    return new Promise<CommandResult>((resolve) => {
      // Set up timeout
      const timer = setTimeout(() => {
        this.pending.delete(command);
        resolve({
          success: false,
          resultCode: -1,
          message: `Command ${command} timed out after ${this.timeout}ms`,
        });
      }, this.timeout);

      // Track the pending command
      this.pending.set(command, { command, resolve, timer });

      // Encode and send
      const frame = encodeCommandLong(
        targetSys,
        targetComp,
        command,
        params[0], params[1], params[2], params[3],
        params[4], params[5], params[6],
        sysId,
        compId
      );
      sendFn(frame);
    });
  }

  /**
   * Handle an incoming COMMAND_ACK message.
   * Call this when the MAVLink parser decodes a COMMAND_ACK (msg ID 77).
   *
   * @param command — the command ID being acknowledged
   * @param result — MAV_RESULT code
   */
  handleAck(command: number, result: number): void {
    const entry = this.pending.get(command);
    if (!entry) return;

    clearTimeout(entry.timer);
    this.pending.delete(command);

    entry.resolve({
      success: result === MAV_RESULT.ACCEPTED,
      resultCode: result,
      message: RESULT_MESSAGES[result] ?? `Unknown result code: ${result}`,
    });
  }

  /** Clear all pending commands (call on disconnect). */
  clear(): void {
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.resolve({
        success: false,
        resultCode: -1,
        message: "Connection closed",
      });
    }
    this.pending.clear();
  }

  get pendingCount(): number {
    return this.pending.size;
  }
}
