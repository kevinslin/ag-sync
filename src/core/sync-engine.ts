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

type FileSnapshot = Map<string, string>;

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
