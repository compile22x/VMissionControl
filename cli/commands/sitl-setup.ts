// cli/commands/sitl-setup.ts — ArduPilot SITL installation wizard
// SPDX-License-Identifier: GPL-3.0-only

import { type Command } from 'commander';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import fs from 'node:fs';
import { Listr } from 'listr2';
import { checkPython3, checkGit, checkPip3, checkArdupilot } from '../lib/checks.js';
import { spawnForwarded } from '../lib/process.js';
import { ARDUPILOT_DEFAULT } from '../lib/paths.js';
import { printBanner } from '../banner.js';

export async function sitlSetupCommand(): Promise<void> {
  printBanner();
  p.intro(pc.cyan('ArduPilot SITL Setup'));

  // 1. Check prerequisites
  const python = checkPython3();
  const git = checkGit();
  const pip = checkPip3();

  p.log.info('Checking prerequisites...');
  p.log.message(`  python3  ${python.ok ? pc.green('✓') : pc.red('✗')}  ${python.message}`);
  p.log.message(`  git      ${git.ok ? pc.green('✓') : pc.red('✗')}  ${git.message}`);
  p.log.message(`  pip3     ${pip.ok ? pc.green('✓') : pc.red('✗')}  ${pip.message}`);

  if (!python.ok || !git.ok) {
    p.log.error('Missing required prerequisites. Install python3 and git first.');
    process.exit(1);
  }

  // 2. Check if already installed
  const existingCheck = checkArdupilot();
  if (existingCheck.ok) {
    p.log.success(`ArduPilot already installed and built at ${ARDUPILOT_DEFAULT}`);
    const rebuild = await p.confirm({
      message: 'Would you like to rebuild ArduCopter?',
      initialValue: false,
    });
    if (p.isCancel(rebuild) || !rebuild) {
      p.outro('ArduPilot is ready to use.');
      return;
    }
    // Rebuild only
    const tasks = new Listr([
      {
        title: 'Rebuilding ArduCopter SITL',
        task: async () => {
          const code = await spawnForwarded({
            command: 'bash',
            args: ['-c', './waf configure --board sitl && ./waf copter'],
            cwd: ARDUPILOT_DEFAULT,
          });
          if (code !== 0) throw new Error('Build failed');
        },
      },
    ]);
    await tasks.run();
    p.outro(pc.green('ArduCopter rebuilt successfully!'));
    return;
  }

  // 3. Install path
  p.note(
    [
      'This will clone the ArduPilot repository (~2 GB) and build',
      'the ArduCopter SITL binary. This may take 10-30 minutes',
      'depending on your internet connection and CPU.',
    ].join('\n'),
    'ArduPilot SITL Setup'
  );

  const installPath = await p.text({
    message: 'Install path:',
    initialValue: ARDUPILOT_DEFAULT,
    placeholder: ARDUPILOT_DEFAULT,
    validate: (v) => {
      if (!v) return 'Path is required';
      return undefined;
    },
  });

  if (p.isCancel(installPath)) {
    p.cancel('Cancelled.');
    process.exit(0);
  }

  const targetPath = installPath;

  // Check if directory already exists but binary is missing
  if (fs.existsSync(targetPath)) {
    const overwrite = await p.confirm({
      message: `Directory ${targetPath} already exists. Use it for build?`,
      initialValue: true,
    });
    if (p.isCancel(overwrite) || !overwrite) {
      p.cancel('Cancelled.');
      process.exit(0);
    }
  }

  // 4. Run setup tasks
  const needsClone = !fs.existsSync(targetPath);

  const tasks = new Listr([
    {
      title: 'Cloning ArduPilot repository',
      enabled: () => needsClone,
      task: async () => {
        const code = await spawnForwarded({
          command: 'git',
          args: ['clone', '--recurse-submodules', 'https://github.com/ArduPilot/ardupilot.git', targetPath],
        });
        if (code !== 0) throw new Error('git clone failed');
      },
    },
    {
      title: 'Installing prerequisites (macOS)',
      task: async () => {
        const prereqScript = `${targetPath}/Tools/environment_install/install-prereqs-mac.sh`;
        if (!fs.existsSync(prereqScript)) {
          throw new Error(`Prerequisites script not found at ${prereqScript}`);
        }
        const code = await spawnForwarded({
          command: 'bash',
          args: [prereqScript, '-y'],
          cwd: targetPath,
        });
        if (code !== 0) throw new Error('Prerequisites installation failed');
      },
    },
    {
      title: 'Building ArduCopter SITL',
      task: async () => {
        const code = await spawnForwarded({
          command: 'bash',
          args: ['-c', './waf configure --board sitl && ./waf copter'],
          cwd: targetPath,
        });
        if (code !== 0) throw new Error('Build failed');
      },
    },
  ], {
    rendererOptions: { collapseSubtasks: false },
  });

  await tasks.run();

  // Verify
  const verifyCheck = checkArdupilot(targetPath);
  if (verifyCheck.ok) {
    console.log();
    p.note(
      [
        `ArduPilot installed at: ${pc.cyan(targetPath)}`,
        `ArduCopter binary: ${pc.cyan(`${targetPath}/build/sitl/bin/arducopter`)}`,
        '',
        `Run the simulator:`,
        `  ${pc.cyan('npm run cli sitl')}`,
      ].join('\n'),
      'Setup Complete'
    );
    p.outro(pc.green('ArduPilot SITL is ready!'));
  } else {
    p.log.error('Setup completed but ArduCopter binary was not found.');
    p.log.info(`Try rebuilding manually: cd ${targetPath} && ./waf copter`);
  }
}

export function registerSitlSetup(program: Command): void {
  program
    .command('sitl-setup')
    .description('Install ArduPilot SITL (clone + build)')
    .action(async () => {
      await sitlSetupCommand();
    });
}
