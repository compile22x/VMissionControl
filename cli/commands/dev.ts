// cli/commands/dev.ts — Start development server
// SPDX-License-Identifier: GPL-3.0-only

import { type Command } from 'commander';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { checkNodeVersion, checkDepsInstalled } from '../lib/checks.js';
import { spawnForwarded } from '../lib/process.js';
import { PROJECT_ROOT } from '../lib/paths.js';

interface DevOptions {
  port?: number;
}

export async function devCommand(opts: DevOptions): Promise<void> {
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

  p.log.info(`Starting dev server on port ${pc.cyan(String(port))}...`);
  p.log.info(pc.dim('Press Ctrl+C to stop'));
  console.log();

  const code = await spawnForwarded({
    command: 'npx',
    args: ['next', 'dev', '--port', String(port)],
    cwd: PROJECT_ROOT,
  });

  process.exit(code);
}

export function registerDev(program: Command): void {
  program
    .command('dev')
    .description('Start development server')
    .option('-p, --port <port>', 'Port number', '4000')
    .action(async (opts) => {
      await devCommand({ port: parseInt(opts.port, 10) });
    });
}
