import { promises as fs } from 'fs';
import path from 'path';

export async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

export async function writeJsonFile(
  filePath: string,
  value: unknown,
): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function isDirectory(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

export async function copyDirectoryContents(
  sourceDir: string,
  destinationDir: string,
): Promise<number> {
  if (!(await isDirectory(sourceDir))) {
    return 0;
  }

  await ensureDir(destinationDir);
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destinationPath = path.join(destinationDir, entry.name);
    await fs.cp(sourcePath, destinationPath, {
      recursive: true,
      force: true,
    });
  }

  return entries.length;
}

export async function clearDirectoryContents(dirPath: string): Promise<number> {
  if (!(await isDirectory(dirPath))) {
    return 0;
  }

  const entries = await fs.readdir(dirPath);
  for (const entry of entries) {
    await fs.rm(path.join(dirPath, entry), {
      recursive: true,
      force: true,
    });
  }

  return entries.length;
}

export async function listFilesRecursive(
  rootDir: string,
  currentDir: string = rootDir,
): Promise<string[]> {
  if (!(await isDirectory(currentDir))) {
    return [];
  }

  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await listFilesRecursive(rootDir, absolutePath)));
      continue;
    }

    if (entry.isFile()) {
      results.push(path.relative(rootDir, absolutePath));
    }
  }

  return results;
}

export async function copyFileWithParents(
  sourcePath: string,
  destinationPath: string,
): Promise<void> {
  await ensureDir(path.dirname(destinationPath));
  await fs.copyFile(sourcePath, destinationPath);
}
