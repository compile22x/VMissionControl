// cli/commands/info.ts — System info and prerequisite checks
// SPDX-License-Identifier: GPL-3.0-only

import { type Command } from 'commander';
import { execSync } from 'node:child_process';
import { printBanner } from '../banner.js';
import { checkNodeVersion, checkDepsInstalled, checkEnvFile, checkArdupilot, checkSitlDeps, checkPortAvailable } from '../lib/checks.js';
import { dots, badge, heading } from '../lib/format.js';

export async function infoCommand(): Promise<void> {
  printBanner();

  // System
  console.log(heading('System'));
  const nodeCheck = checkNodeVersion();
  console.log(`  ${dots('Node.js', `${nodeCheck.message}    ${badge('pass', nodeCheck.ok)}`)}`);

  let npmVersion = 'unknown';
  try { npmVersion = execSync('npm --version', { stdio: 'pipe' }).toString().trim(); } catch {}
  console.log(`  ${dots('npm', `${npmVersion}    ${badge('pass', true)}`)}`);

  console.log(`  ${dots('Platform', `${process.platform} ${process.arch}`)}`);
  console.log();

  // Project
  console.log(heading('Project'));
  const depsCheck = checkDepsInstalled();
  console.log(`  ${dots('Dependencies', `${depsCheck.message}    ${badge(depsCheck.ok ? 'pass' : 'fail', depsCheck.ok)}`)}`);

  const envCheck = checkEnvFile();
  console.log(`  ${dots('.env.local', `${envCheck.message}    ${badge(envCheck.ok ? 'pass' : 'fail', envCheck.ok)}`)}`);
  console.log();

  // SITL
  console.log(heading('SITL'));
  const ardupilotCheck = checkArdupilot();
  console.log(`  ${dots('ArduPilot', `${ardupilotCheck.message}    ${badge(ardupilotCheck.ok ? 'pass' : 'fail', ardupilotCheck.ok)}`)}`);

  if (ardupilotCheck.ok) {
    console.log(`  ${dots('ArduCopter binary', `found    ${badge('pass', true)}`)}`);
  } else {
    console.log(`  ${dots('ArduCopter binary', `missing    ${badge('fail', false)}`)}`);
  }

  const sitlDeps = checkSitlDeps();
  console.log(`  ${dots('SITL deps', `${sitlDeps.message}    ${badge(sitlDeps.ok ? 'pass' : 'fail', sitlDeps.ok)}`)}`);
  console.log();

  // Ports
  console.log(heading('Ports'));
  const port4000 = await checkPortAvailable(4000);
  console.log(`  ${dots('4000 (GCS)', `${port4000.message}    ${badge(port4000.ok ? 'pass' : 'fail', port4000.ok)}`)}`);

  const port5760 = await checkPortAvailable(5760);
  console.log(`  ${dots('5760 (SITL WS)', `${port5760.message}    ${badge(port5760.ok ? 'pass' : 'fail', port5760.ok)}`)}`);
  console.log();
}

export function registerInfo(program: Command): void {
  program
    .command('info')
    .description('System info and prerequisite checks')
    .action(async () => {
      await infoCommand();
    });
}
