import fs from 'node:fs';
import pc from 'picocolors';
import { PACKAGE_JSON } from './lib/paths.js';

const LOGO = `
${pc.cyan('     ___   __   ______ _   __')}
${pc.cyan('    /   | / /  /_  __// | / /')}
${pc.cyan('   / /| |/ /    / /  /  |/ /')}
${pc.cyan('  / ___ / /____/ /  / /|  /')}
${pc.cyan(' /_/  |_/_____/_/  /_/ |_/')}
`;

export function printBanner(): void {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8'));
  const version = pkg.version ?? '0.0.0';

  console.log(LOGO);
  console.log(` ${pc.bold('Altnautica Command GCS')}  ${pc.dim(`v${version}`)}`);
  console.log(` ${pc.dim('Open-source Ground Control Station')}`);
  console.log();
}
