// cli/commands/deploy.ts — Build and deploy workflow
// SPDX-License-Identifier: GPL-3.0-only

import { type Command } from 'commander';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { Listr } from 'listr2';
import { execSync } from 'node:child_process';
import { checkNodeVersion, checkDepsInstalled } from '../lib/checks.js';
import { spawnForwarded } from '../lib/process.js';
import { PROJECT_ROOT } from '../lib/paths.js';
import { printBanner } from '../banner.js';

interface DeployOptions {
  skipLint?: boolean;
  port?: number;
}

export async function deployCommand(opts: DeployOptions): Promise<void> {
  printBanner();

  const port = opts.port ?? 4000;

  // Pre-flight checks
  const nodeCheck = checkNodeVersion();
  if (!nodeCheck.ok) {
    p.log.error(`Node.js 20+ required (found ${nodeCheck.message})`);
    process.exit(1);
  }

  const depsCheck = checkDepsInstalled();
  if (!depsCheck.ok) {
    p.log.error('Dependencies not installed. Run: npm run cli setup');
    process.exit(1);
  }

  p.intro(pc.cyan('Build & Deploy'));

  const tasks = new Listr([
    {
      title: 'Running ESLint',
      enabled: () => !opts.skipLint,
      task: async () => {
        try {
          execSync('npx eslint', { cwd: PROJECT_ROOT, stdio: 'pipe', timeout: 120000 });
        } catch (e) {
          const err = e as { stdout?: Buffer; stderr?: Buffer };
          const output = err.stdout?.toString() || err.stderr?.toString() || '';
          throw new Error(`Lint errors found:\n${output.slice(0, 500)}`);
        }
      },
    },
    {
      title: 'Building for production',
      task: async () => {
        try {
          execSync('npx next build', { cwd: PROJECT_ROOT, stdio: 'pipe', timeout: 300000 });
        } catch (e) {
          const err = e as { stderr?: Buffer };
          throw new Error(`Build failed:\n${err.stderr?.toString().slice(0, 500) || 'Unknown error'}`);
        }
      },
    },
  ], {
    rendererOptions: { collapseSubtasks: false },
  });

  await tasks.run();
  console.log();

  p.log.success('Build completed successfully!');

  const action = await p.select({
    message: 'What next?',
    options: [
      { value: 'start', label: 'Start production server', hint: `port ${port}` },
      { value: 'exit', label: 'Exit' },
    ],
  });

  if (p.isCancel(action) || action === 'exit') {
    p.outro('Build artifacts ready in .next/');
    return;
  }

  p.log.info(`Starting production server on port ${pc.cyan(String(port))}...`);
  p.log.info(pc.dim('Press Ctrl+C to stop'));
  console.log();

  const code = await spawnForwarded({
    command: 'npx',
    args: ['next', 'start', '--port', String(port)],
    cwd: PROJECT_ROOT,
  });

  process.exit(code);
}

export function registerDeploy(program: Command): void {
  program
    .command('deploy')
    .description('Build for production and optionally start server')
    .option('--skip-lint', 'Skip ESLint check')
    .option('-p, --port <port>', 'Production server port', '4000')
    .action(async (opts) => {
      await deployCommand({
        skipLint: opts.skipLint,
        port: parseInt(opts.port, 10),
      });
    });
}
