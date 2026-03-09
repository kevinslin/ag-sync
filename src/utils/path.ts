import os from 'os';
import path from 'path';

export function expandHome(inputPath: string): string {
  if (inputPath === '~') {
    return os.homedir();
  }

  if (inputPath.startsWith('~/')) {
    return path.join(os.homedir(), inputPath.slice(2));
  }

  return inputPath;
}

export function resolveFromWorkspace(
  workspaceRoot: string,
  inputPath: string,
): string {
  const expanded = expandHome(inputPath);
  if (path.isAbsolute(expanded)) {
    return path.normalize(expanded);
  }

  return path.resolve(workspaceRoot, expanded);
}
