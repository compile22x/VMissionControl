import { spawn, type ChildProcess } from 'node:child_process';

export interface SpawnOptions {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export function spawnForwarded(opts: SpawnOptions): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(opts.command, opts.args, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      stdio: 'inherit',
    });

    const onSignal = () => {
      child.kill('SIGINT');
    };
    process.on('SIGINT', onSignal);
    process.on('SIGTERM', onSignal);

    child.on('error', (err) => {
      process.removeListener('SIGINT', onSignal);
      process.removeListener('SIGTERM', onSignal);
      reject(err);
    });

    child.on('close', (code) => {
      process.removeListener('SIGINT', onSignal);
      process.removeListener('SIGTERM', onSignal);
      resolve(code ?? 1);
    });
  });
}

export interface ProcessGroupEntry extends SpawnOptions {
  label?: string;
}

export interface ProcessGroup {
  waitForExit(): Promise<void>;
  shutdown(): void;
}

export function spawnGroup(processes: ProcessGroupEntry[]): ProcessGroup {
  const children: ChildProcess[] = [];
  let shuttingDown = false;

  for (const proc of processes) {
    const child = spawn(proc.command, proc.args, {
      cwd: proc.cwd,
      env: { ...process.env, ...proc.env },
      stdio: 'inherit',
    });
    children.push(child);
  }

  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;

    for (const child of children) {
      if (!child.killed) {
        child.kill('SIGINT');
      }
    }

    // Force kill after 3 seconds
    setTimeout(() => {
      for (const child of children) {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }
    }, 3000);
  };

  const onSignal = () => shutdown();
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  const waitForExit = (): Promise<void> => {
    return new Promise((resolve) => {
      let remaining = children.length;
      if (remaining === 0) {
        resolve();
        return;
      }

      for (const child of children) {
        child.on('close', () => {
          remaining--;
          if (remaining <= 0) {
            process.removeListener('SIGINT', onSignal);
            process.removeListener('SIGTERM', onSignal);
            resolve();
          }
        });
      }
    });
  };

  return { waitForExit, shutdown };
}
