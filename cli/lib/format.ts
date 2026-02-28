import pc from 'picocolors';

export function label(text: string, color: 'cyan' | 'green' | 'yellow' | 'red' | 'magenta' = 'cyan'): string {
  const colorFn = pc[color];
  return colorFn(`[${text}]`);
}

export function badge(text: string, pass: boolean): string {
  return pass ? pc.green(`[${text}]`) : pc.red(`[${text}]`);
}

export function dots(name: string, value: string, width = 20): string {
  const dotsNeeded = Math.max(2, width - name.length);
  const dotStr = '  ' + '.'.repeat(dotsNeeded) + '  ';
  return `${name}${pc.dim(dotStr)}${value}`;
}

export function heading(text: string): string {
  return pc.bold(pc.underline(text));
}

export const dim = pc.dim;
export const success = pc.green;
export const warn = pc.yellow;
export const error = pc.red;
export const accent = pc.cyan;
