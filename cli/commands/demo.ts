// cli/commands/demo.ts — Start demo mode with simulated drones
// SPDX-License-Identifier: GPL-3.0-only

import { type Command } from 'commander';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { checkNodeVersion, checkDepsInstalled } from '../lib/checks.js';
import { spawnForwarded } from '../lib/process.js';
import { PROJECT_ROOT } from '../lib/paths.js';

interface DemoOptions {
  port?: number;
  drones?: number;
}

export async function demoCommand(opts: DemoOptions): Promise<void> {
  const port = opts.port ?? 4000;

  // Check Node version
  const nodeCheck = checkNodeVersion();
  if (!nodeCheck.ok) {
    p.log.error(`Node.js 20+ required (found ${nodeCheck.message})`);
    process.exit(1);
  }

  // Check dependencies
  const depsCheck = checkDepsInstalled();
  if (!depsCheck.ok) {
    const install = await p.confirm({
      message: 'Dependencies not installed. Run npm install?',
    });
    if (p.isCancel(install) || !install) {
      p.cancel('Cannot start without dependencies.');
      process.exit(1);
    }
    await spawnForwarded({ command: 'npm', args: ['install'], cwd: PROJECT_ROOT });
  }

  // Interactive drone count if not specified
  let droneCount = opts.drones;
  if (!droneCount) {
    const selected = await p.select({
      message: 'How many simulated drones?',
      options: [
        { value: 1, label: '1 drone', hint: 'minimal' },
        { value: 3, label: '3 drones' },
        { value: 5, label: '5 drones', hint: 'default' },
        { value: 10, label: '10 drones', hint: 'stress test' },
      ],
      initialValue: 5,
    });
    if (p.isCancel(selected)) {
      p.cancel('Cancelled.');
      process.exit(0);
    }
    droneCount = selected;
  }

  p.note(
    [
      `Demo mode starts ${pc.cyan(String(droneCount))} simulated drones with realistic`,
      'flight data. No real hardware or backend required.',
      '',
      'Features available in demo:',
      `  ${pc.dim('•')} Live telemetry dashboard`,
      `  ${pc.dim('•')} Map with drone positions`,
      `  ${pc.dim('•')} Flight controller configuration`,
      `  ${pc.dim('•')} Mission planning`,
    ].join('\n'),
    'Demo Mode'
  );

  p.log.info(`Starting demo mode — ${pc.cyan(String(droneCount))} drones on port ${pc.cyan(String(port))}`);
  p.log.info(pc.dim('Press Ctrl+C to stop'));
  console.log();

  const code = await spawnForwarded({
    command: 'npx',
    args: ['next', 'dev', '--port', String(port)],
    cwd: PROJECT_ROOT,
    env: {
      NEXT_PUBLIC_DEMO_MODE: 'true',
      NEXT_PUBLIC_DEMO_DRONE_COUNT: String(droneCount),
    },
  });

  process.exit(code);
}

export function registerDemo(program: Command): void {
  program
    .command('demo')
    .description('Start demo mode with simulated drones')
    .option('-p, --port <port>', 'Port number', '4000')
    .option('-d, --drones <count>', 'Number of simulated drones')
    .action(async (opts) => {
      await demoCommand({
        port: parseInt(opts.port, 10),
        drones: opts.drones ? parseInt(opts.drones, 10) : undefined,
      });
    });
}
