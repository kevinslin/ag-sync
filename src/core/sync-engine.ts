import path from 'path';
import type {
  AssetKind,
  NormalizedAgSyncConfig,
  NormalizedSyncPathEntry,
} from '../types';
import {
  clearDirectoryContents,
  copyFileWithParents,
  ensureDir,
  exists,
  isDirectory,
  listFilesRecursive,
} from '../utils/fs';
import { warning } from '../utils/logger';
import { isDenied } from './deny-list';

export type SyncSummary = {
  families: Array<{
    kind: AssetKind;
    sourceFiles: number;
    copiedFiles: number;
    deletedEntries: number;
    skippedBecauseNoSourceRoots: boolean;
  }>;
};

export type ImportSummary = {
  families: Array<{
    kind: AssetKind;
    importedFiles: number;
    missingDestinationRoots: number;
  }>;
};

type FileSnapshot = Map<string, string>;
type ImportCandidate = {
  relativePath: string;
  sourcePath: string;
  destinationRootPath: string;
};

export async function syncWorkspace(
  config: NormalizedAgSyncConfig,
): Promise<SyncSummary> {
  const families: SyncSummary['families'] = [];

  families.push(
    await syncFamily(
      'agent',
      config.agentSourceDir,
      config.agentDestDir,
      config.denyList,
    ),
  );
  families.push(
    await syncFamily(
      'automation',
      config.automationSourceDir,
      config.automationDestDir,
      config.denyList,
    ),
  );

  return { families };
}

export async function importWorkspace(
  config: NormalizedAgSyncConfig,
): Promise<ImportSummary> {
  const families: ImportSummary['families'] = [];

  families.push(
    await importFamily(
      'agent',
      config.agentSourceDir,
      config.agentDestDir,
      config.denyList,
    ),
  );
  families.push(
    await importFamily(
      'automation',
      config.automationSourceDir,
      config.automationDestDir,
      config.denyList,
    ),
  );

  return { families };
}

async function syncFamily(
  kind: AssetKind,
  sourceRoots: NormalizedSyncPathEntry[],
  destinationRoots: NormalizedSyncPathEntry[],
  denyList: string[],
): Promise<SyncSummary['families'][number]> {
  const existingSourceRoots = [];
  for (const sourceRoot of sourceRoots) {
    if (await isDirectory(sourceRoot.absolutePath)) {
      existingSourceRoots.push(sourceRoot);
    }
  }

  if (existingSourceRoots.length === 0) {
    warning(
      `Skipping ${kind} sync because no configured source directories exist.`,
    );
    return {
      kind,
      sourceFiles: 0,
      copiedFiles: 0,
      deletedEntries: 0,
      skippedBecauseNoSourceRoots: true,
    };
  }

  const snapshot = await buildSnapshot(existingSourceRoots, denyList);

  let copiedFiles = 0;
  let deletedEntries = 0;

  for (const destinationRoot of destinationRoots) {
    await ensureDir(destinationRoot.absolutePath);

    if (destinationRoot.deleteExistingFromDest) {
      deletedEntries += await clearDirectoryContents(
        destinationRoot.absolutePath,
      );
    }

    copiedFiles += await copySnapshot(snapshot, destinationRoot.absolutePath);
  }

  return {
    kind,
    sourceFiles: snapshot.size,
    copiedFiles,
    deletedEntries,
    skippedBecauseNoSourceRoots: false,
  };
}

async function importFamily(
  kind: AssetKind,
  sourceRoots: NormalizedSyncPathEntry[],
  destinationRoots: NormalizedSyncPathEntry[],
  denyList: string[],
): Promise<ImportSummary['families'][number]> {
  const targetSourceRoot = sourceRoots[0];
  if (!targetSourceRoot) {
    throw new Error(
      `Cannot import ${kind}s because no source directory is configured.`,
    );
  }

  const existingSourceRoots = [];
  for (const sourceRoot of sourceRoots) {
    if (await isDirectory(sourceRoot.absolutePath)) {
      existingSourceRoots.push(sourceRoot);
    }
  }

  const snapshot = await buildSnapshot(existingSourceRoots, denyList);
  const { candidates, missingDestinationRoots } = await planImports(
    kind,
    snapshot,
    targetSourceRoot,
    destinationRoots,
    denyList,
  );

  await ensureDir(targetSourceRoot.absolutePath);
  for (const candidate of candidates) {
    await copyFileWithParents(
      candidate.sourcePath,
      path.join(
        targetSourceRoot.absolutePath,
        fromPosixPath(candidate.relativePath),
      ),
    );
  }

  return {
    kind,
    importedFiles: candidates.length,
    missingDestinationRoots,
  };
}

async function buildSnapshot(
  sourceRoots: NormalizedSyncPathEntry[],
  denyList: string[],
): Promise<FileSnapshot> {
  const snapshot: FileSnapshot = new Map();

  for (const sourceRoot of sourceRoots) {
    const relativePaths = await listFilesRecursive(sourceRoot.absolutePath);
    for (const relativePath of relativePaths) {
      const normalizedRelativePath = toPosixPath(relativePath);
      if (isDenied(normalizedRelativePath, denyList)) {
        continue;
      }

      const absolutePath = path.join(sourceRoot.absolutePath, relativePath);
      if (!(await exists(absolutePath))) {
        continue;
      }

      snapshot.set(normalizedRelativePath, absolutePath);
    }
  }

  return snapshot;
}

async function planImports(
  kind: AssetKind,
  snapshot: FileSnapshot,
  targetSourceRoot: NormalizedSyncPathEntry,
  destinationRoots: NormalizedSyncPathEntry[],
  denyList: string[],
): Promise<{
  candidates: ImportCandidate[];
  missingDestinationRoots: number;
}> {
  const candidatesByRelativePath = new Map<string, ImportCandidate>();
  const duplicatePaths = new Map<string, string[]>();
  let missingDestinationRoots = 0;

  for (const destinationRoot of destinationRoots) {
    if (!(await isDirectory(destinationRoot.absolutePath))) {
      missingDestinationRoots += 1;
      continue;
    }

    const relativePaths = await listFilesRecursive(
      destinationRoot.absolutePath,
    );
    for (const relativePath of relativePaths) {
      const normalizedRelativePath = toPosixPath(relativePath);
      if (isDenied(normalizedRelativePath, denyList)) {
        continue;
      }

      if (snapshot.has(normalizedRelativePath)) {
        continue;
      }

      const existingCandidate = candidatesByRelativePath.get(
        normalizedRelativePath,
      );
      if (existingCandidate) {
        const roots = duplicatePaths.get(normalizedRelativePath) ?? [
          existingCandidate.destinationRootPath,
        ];
        roots.push(destinationRoot.path);
        duplicatePaths.set(normalizedRelativePath, roots);
        continue;
      }

      candidatesByRelativePath.set(normalizedRelativePath, {
        relativePath: normalizedRelativePath,
        sourcePath: path.join(destinationRoot.absolutePath, relativePath),
        destinationRootPath: destinationRoot.path,
      });
    }
  }

  if (duplicatePaths.size > 0) {
    const duplicateSummary = [...duplicatePaths.entries()]
      .map(
        ([relativePath, roots]) =>
          `${relativePath} (${[...new Set(roots)].join(', ')})`,
      )
      .join('; ');
    throw new Error(
      `Cannot import ${kind}s because the following paths exist in multiple destination roots: ${duplicateSummary}`,
    );
  }

  const candidates = [...candidatesByRelativePath.values()];
  const collisions: string[] = [];
  for (const candidate of candidates) {
    const conflictPath = await findSourcePathConflict(
      targetSourceRoot.absolutePath,
      candidate.relativePath,
    );
    if (!conflictPath) {
      continue;
    }

    collisions.push(`${candidate.relativePath} (${conflictPath})`);
  }

  if (collisions.length > 0) {
    throw new Error(
      `Cannot import ${kind}s because the following paths conflict with existing source path(s): ${collisions.join('; ')}`,
    );
  }

  return {
    candidates,
    missingDestinationRoots,
  };
}

async function copySnapshot(
  snapshot: FileSnapshot,
  destinationRoot: string,
): Promise<number> {
  let copiedFiles = 0;

  for (const [relativePath, sourcePath] of snapshot.entries()) {
    const destinationPath = path.join(destinationRoot, relativePath);
    await copyFileWithParents(sourcePath, destinationPath);
    copiedFiles += 1;
  }

  return copiedFiles;
}

function toPosixPath(relativePath: string): string {
  return relativePath.split(path.sep).join('/');
}

function fromPosixPath(relativePath: string): string {
  return relativePath.split('/').join(path.sep);
}

async function findSourcePathConflict(
  rootDir: string,
  relativePath: string,
): Promise<string | null> {
  const parts = relativePath.split('/');
  let currentPath = rootDir;

  for (let index = 0; index < parts.length; index += 1) {
    currentPath = path.join(currentPath, parts[index]);
    if (!(await exists(currentPath))) {
      continue;
    }

    const isCurrentDirectory = await isDirectory(currentPath);
    const isLeaf = index === parts.length - 1;

    if (!isLeaf && !isCurrentDirectory) {
      return currentPath;
    }

    if (isLeaf) {
      return currentPath;
    }
  }

  return null;
}
