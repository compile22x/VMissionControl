import fs from 'node:fs';
import net from 'node:net';
import { execSync } from 'node:child_process';
import { NODE_MODULES, ENV_FILE, SITL_NODE_MODULES, ARDUPILOT_DEFAULT } from './paths.js';

export interface CheckResult {
  ok: boolean;
  message: string;
  detail?: string;
}

export function checkNodeVersion(minMajor = 20): CheckResult {
  const version = process.versions.node;
  const major = parseInt(version.split('.')[0], 10);
  return {
    ok: major >= minMajor,
    message: `v${version}`,
    detail: major < minMajor ? `Node.js ${minMajor}+ required` : undefined,
  };
}

export function checkDepsInstalled(): CheckResult {
  const exists = fs.existsSync(NODE_MODULES);
  return {
    ok: exists,
    message: exists ? 'installed' : 'missing',
    detail: exists ? undefined : 'Run npm install',
  };
}

export function checkEnvFile(): CheckResult {
  const exists = fs.existsSync(ENV_FILE);
  return {
    ok: exists,
    message: exists ? 'present' : 'missing',
    detail: exists ? undefined : 'Run: npm run cli setup',
  };
}

export function checkArdupilot(ardupilotPath?: string): CheckResult {
  const p = ardupilotPath ?? ARDUPILOT_DEFAULT;
  const dirExists = fs.existsSync(p);
  if (!dirExists) {
    return { ok: false, message: 'not found', detail: `Expected at ${p}` };
  }
  const binaryPath = `${p}/build/sitl/bin/arducopter`;
  const binaryExists = fs.existsSync(binaryPath);
  return {
    ok: binaryExists,
    message: binaryExists ? p : 'not built',
    detail: binaryExists ? undefined : 'ArduCopter binary not found — rebuild needed',
  };
}

export function checkSitlDeps(): CheckResult {
  const exists = fs.existsSync(SITL_NODE_MODULES);
  return {
    ok: exists,
    message: exists ? 'installed' : 'missing',
    detail: exists ? undefined : 'Run: cd tools/sitl && npm install',
  };
}

export function checkPortAvailable(port: number): Promise<CheckResult> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err: NodeJS.ErrnoException) => {
      resolve({
        ok: false,
        message: `in use`,
        detail: err.code === 'EADDRINUSE' ? `Port ${port} is already in use` : err.message,
      });
    });
    server.once('listening', () => {
      server.close(() => {
        resolve({ ok: true, message: 'available' });
      });
    });
    server.listen(port, '127.0.0.1');
  });
}

function checkCommand(cmd: string, args: string): CheckResult {
  try {
    const output = execSync(`${cmd} ${args}`, { stdio: 'pipe', timeout: 5000 }).toString().trim();
    return { ok: true, message: output.split('\n')[0] };
  } catch {
    return { ok: false, message: 'not found', detail: `${cmd} is not installed` };
  }
}

export function checkPython3(): CheckResult {
  return checkCommand('python3', '--version');
}

export function checkGit(): CheckResult {
  return checkCommand('git', '--version');
}

export function checkPip3(): CheckResult {
  return checkCommand('pip3', '--version');
}
