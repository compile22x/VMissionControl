/**
 * Board profiles with timer group definitions for output protocol conflict detection.
 *
 * On STM32-based flight controllers, PWM/DShot outputs are driven by hardware timers.
 * All outputs sharing a timer group MUST use the same protocol (all PWM or all DShot).
 * Mixing protocols within a group causes ArduPilot to disable the minority outputs,
 * triggering "SERVOx_FUNCTION on disabled channel" PreArm failures.
 *
 * Board IDs sourced from ArduPilot AP_HAL_ChibiOS/hwdef/ board configs.
 *
 * @license GPL-3.0-only
 */

// ── Types ────────────────────────────────────────────────────

export interface BoardProfile {
  name: string
  vendor: string
  /** AP_FW_BOARD_ID values from AUTOPILOT_VERSION.board_version */
  boardIds: number[]
  outputCount: number
  /** Timer groups — each sub-array lists output numbers (1-based) sharing a timer */
  timerGroups: number[][]
  /** Notes for specific outputs (e.g. solder pads, LED pads) */
  outputNotes: Record<number, string>
  /** Per-group protocol support */
  protocols: ('PWM' | 'DShot' | 'Both')[]
}

// ── Motor function IDs (from servo-functions.ts) ─────────────

/** Motor function IDs: Motor1-Motor8 (33-40), Motor9-Motor12 (82-85) */
export const MOTOR_FUNCTION_IDS = new Set([33, 34, 35, 36, 37, 38, 39, 40, 82, 83, 84, 85])

/** MOT_PWM_TYPE values — 0 = Normal PWM, 4+ = DShot variants */
export const MOT_PWM_TYPE = {
  NORMAL: 0,
  ONESHOT: 1,
  ONESHOT125: 2,
  BRUSHED: 3,
  DSHOT150: 4,
  DSHOT300: 5,
  DSHOT600: 6,
  DSHOT1200: 7,
} as const

/** Returns true if the MOT_PWM_TYPE value indicates DShot protocol */
export function isDShotType(motPwmType: number): boolean {
  return motPwmType >= MOT_PWM_TYPE.DSHOT150
}

// ── Board Profiles ───────────────────────────────────────────

export const BOARD_PROFILES: BoardProfile[] = [
  {
    name: 'SpeedyBee F405 Wing',
    vendor: 'SpeedyBee',
    boardIds: [1032], // AP_HW_SPEEDYBEEF405WING
    outputCount: 12,
    timerGroups: [
      [1, 2],       // TIM4 — Group 1
      [3, 4],       // TIM3 — Group 2
      [5, 6, 7],    // TIM8 — Group 3
      [8, 9, 10],   // TIM1 — Group 4
      [11, 12],     // TIM2 — Group 5
    ],
    outputNotes: {
      9: 'Solder pad (S9)',
      10: 'Solder pad (S10)',
      11: 'Solder pad (S11)',
      12: 'Solder pad (S12) — default serial LED',
    },
    protocols: ['Both', 'Both', 'Both', 'Both', 'Both'],
  },
  {
    name: 'SpeedyBee F405 V3',
    vendor: 'SpeedyBee',
    boardIds: [1031], // AP_HW_SPEEDYBEEF405V3
    outputCount: 9,
    timerGroups: [
      [1, 2],       // TIM3
      [3, 4],       // TIM8
      [5, 6],       // TIM4
      [7, 8],       // TIM1
      [9],          // TIM2 — LED pad
    ],
    outputNotes: {
      9: 'LED pad — serial LED default',
    },
    protocols: ['Both', 'Both', 'Both', 'Both', 'PWM'],
  },
  {
    name: 'SpeedyBee F405 V4',
    vendor: 'SpeedyBee',
    boardIds: [1043], // AP_HW_SPEEDYBEEF405V4
    outputCount: 10,
    timerGroups: [
      [1, 2],       // TIM3
      [3, 4],       // TIM8
      [5, 6],       // TIM4
      [7, 8],       // TIM1
      [9, 10],      // TIM2
    ],
    outputNotes: {
      9: 'Solder pad',
      10: 'LED pad — serial LED default',
    },
    protocols: ['Both', 'Both', 'Both', 'Both', 'Both'],
  },
  {
    name: 'Matek H743 Wing V2',
    vendor: 'Matek',
    boardIds: [1013], // AP_HW_MATEKH743
    outputCount: 12,
    timerGroups: [
      [1, 2],       // TIM3
      [3, 4],       // TIM5
      [5, 6],       // TIM4
      [7, 8],       // TIM8
      [9, 10],      // TIM1
      [11, 12],     // TIM15
    ],
    outputNotes: {
      11: 'S11 — solder pad',
      12: 'S12 — LED pad',
    },
    protocols: ['Both', 'Both', 'Both', 'Both', 'Both', 'PWM'],
  },
  {
    name: 'Pixhawk 4',
    vendor: 'Holybro',
    boardIds: [50], // PX4_FMU_V5
    outputCount: 16,
    timerGroups: [
      [1, 2, 3, 4],     // MAIN 1-4 (FMU TIM1)
      [5, 6, 7, 8],     // MAIN 5-8 (FMU TIM4)
      [9, 10, 11, 12],  // AUX 1-4 (IO TIM — independent)
      [13, 14, 15, 16], // AUX 5-8
    ],
    outputNotes: {
      9: 'AUX 1',
      10: 'AUX 2',
      11: 'AUX 3',
      12: 'AUX 4',
      13: 'AUX 5',
      14: 'AUX 6',
      15: 'AUX 7',
      16: 'AUX 8',
    },
    protocols: ['Both', 'Both', 'Both', 'Both'],
  },
  {
    name: 'Pixhawk 6C',
    vendor: 'Holybro',
    boardIds: [56], // PX4_FMU_V6C
    outputCount: 16,
    timerGroups: [
      [1, 2, 3, 4],     // MAIN 1-4
      [5, 6, 7, 8],     // MAIN 5-8
      [9, 10, 11, 12],  // AUX 1-4
      [13, 14, 15, 16], // AUX 5-8
    ],
    outputNotes: {
      9: 'AUX 1',
      10: 'AUX 2',
      11: 'AUX 3',
      12: 'AUX 4',
      13: 'AUX 5',
      14: 'AUX 6',
      15: 'AUX 7',
      16: 'AUX 8',
    },
    protocols: ['Both', 'Both', 'Both', 'Both'],
  },
  {
    name: 'Pixhawk 6X',
    vendor: 'Holybro',
    boardIds: [57], // PX4_FMU_V6X
    outputCount: 16,
    timerGroups: [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
      [9, 10, 11, 12],
      [13, 14, 15, 16],
    ],
    outputNotes: {
      9: 'AUX 1',
      10: 'AUX 2',
      11: 'AUX 3',
      12: 'AUX 4',
      13: 'AUX 5',
      14: 'AUX 6',
      15: 'AUX 7',
      16: 'AUX 8',
    },
    protocols: ['Both', 'Both', 'Both', 'Both'],
  },
  {
    name: 'Generic F405',
    vendor: 'Generic',
    boardIds: [], // Fallback — matched by exclusion
    outputCount: 8,
    timerGroups: [
      [1, 2],
      [3, 4],
      [5, 6],
      [7, 8],
    ],
    outputNotes: {},
    protocols: ['Both', 'Both', 'Both', 'Both'],
  },
]

/** Fallback profile when no board is detected */
export const UNKNOWN_BOARD: BoardProfile = {
  name: 'Unknown Board',
  vendor: 'Unknown',
  boardIds: [],
  outputCount: 16,
  timerGroups: [], // No timer group info — can't detect conflicts
  outputNotes: {},
  protocols: [],
}

// ── Detection & Lookup ───────────────────────────────────────

/**
 * Find a board profile by AP_FW_BOARD_ID from AUTOPILOT_VERSION message.
 * Returns UNKNOWN_BOARD if no match found.
 */
export function detectBoardProfile(boardVersion: number): BoardProfile {
  const match = BOARD_PROFILES.find((b) => b.boardIds.includes(boardVersion))
  return match ?? UNKNOWN_BOARD
}

/**
 * Get the board profile list for manual selection UI.
 */
export function getBoardProfileList(): { name: string; vendor: string }[] {
  return BOARD_PROFILES.map((b) => ({ name: b.name, vendor: b.vendor }))
}

/**
 * Find a board profile by name (for manual selection).
 */
export function getBoardProfileByName(name: string): BoardProfile {
  return BOARD_PROFILES.find((b) => b.name === name) ?? UNKNOWN_BOARD
}

// ── Conflict Detection ───────────────────────────────────────

export interface TimerGroupConflict {
  /** Timer group index (0-based) */
  groupIndex: number
  /** Output numbers in this group (1-based) */
  outputs: number[]
  /** Outputs running DShot (motor functions with MOT_PWM_TYPE >= 4) */
  dshotOutputs: number[]
  /** Outputs running PWM (non-motor, non-disabled, non-GPIO functions) */
  pwmOutputs: number[]
  /** Outputs that are disabled due to the conflict */
  disabledOutputs: number[]
}

/**
 * Detect timer group protocol conflicts.
 *
 * A conflict exists when a timer group contains both DShot motor outputs
 * and PWM servo outputs. ArduPilot disables the minority protocol outputs.
 *
 * @param board - Board profile with timer group layout
 * @param functions - Map of output number (1-based) to SERVOx_FUNCTION value
 * @param motPwmType - Value of MOT_PWM_TYPE parameter (0=PWM, 4+=DShot)
 */
export function detectTimerGroupConflicts(
  board: BoardProfile,
  functions: Map<number, number>,
  motPwmType: number,
): TimerGroupConflict[] {
  if (board.timerGroups.length === 0) return []

  const useDShot = isDShotType(motPwmType)
  const conflicts: TimerGroupConflict[] = []

  for (let gi = 0; gi < board.timerGroups.length; gi++) {
    const group = board.timerGroups[gi]
    const dshotOutputs: number[] = []
    const pwmOutputs: number[] = []

    for (const output of group) {
      const fn = functions.get(output) ?? 0
      if (fn === 0 || fn === -1) continue // Disabled or GPIO — no conflict contribution

      if (MOTOR_FUNCTION_IDS.has(fn) && useDShot) {
        dshotOutputs.push(output)
      } else if (fn > 0) {
        pwmOutputs.push(output)
      }
    }

    // Conflict: group has BOTH DShot and PWM outputs
    if (dshotOutputs.length > 0 && pwmOutputs.length > 0) {
      // ArduPilot disables the PWM outputs when DShot is the dominant protocol
      conflicts.push({
        groupIndex: gi,
        outputs: group,
        dshotOutputs,
        pwmOutputs,
        disabledOutputs: pwmOutputs, // PWM outputs get disabled in a DShot group
      })
    }
  }

  return conflicts
}

/**
 * Get the protocol type for a specific output.
 */
export function getOutputProtocol(
  fn: number,
  motPwmType: number,
): 'DShot' | 'PWM' | 'Disabled' | 'GPIO' {
  if (fn === -1) return 'GPIO'
  if (fn === 0) return 'Disabled'
  if (MOTOR_FUNCTION_IDS.has(fn) && isDShotType(motPwmType)) return 'DShot'
  return 'PWM'
}

/**
 * Find which timer group an output belongs to.
 * Returns -1 if output is not in any group.
 */
export function getTimerGroupForOutput(board: BoardProfile, output: number): number {
  return board.timerGroups.findIndex((group) => group.includes(output))
}
