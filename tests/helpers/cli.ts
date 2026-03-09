import { spawn } from 'child_process';
import path from 'path';

export type CliResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type CliOptions = {
  cwd: string;
  env?: Record<string, string>;
};

export async function execCli(
  args: string[],
  options: CliOptions,
): Promise<CliResult> {
  const cliPath = path.join(process.cwd(), 'dist', 'cli.js');

  return new Promise((resolve, reject) => {
    const child = spawn('node', [cliPath, ...args], {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      resolve({
        exitCode: code ?? 0,
        stdout,
        stderr,
      });
    });
  });
}
