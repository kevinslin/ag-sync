import path from 'path';
import { z } from 'zod';
import { CONFIG_FILE, getDefaultConfig } from '../constants';
import type {
  AgSyncConfig,
  NormalizedAgSyncConfig,
  NormalizedSyncPathEntry,
} from '../types';
import { exists, readJsonFile, writeJsonFile } from '../utils/fs';
import { resolveFromWorkspace } from '../utils/path';

const syncPathEntrySchema = z.object({
  path: z.string().min(1),
  deleteExistingFromDest: z.boolean().optional(),
});

const configSchema = z.object({
  version: z.string().min(1),
  agentDestDir: z.array(syncPathEntrySchema),
  agentSourceDir: z.array(syncPathEntrySchema),
  automationDestDir: z.array(syncPathEntrySchema),
  automationSourceDir: z.array(syncPathEntrySchema),
  denyList: z.array(z.string()),
});

export function getConfigPath(workspaceRoot: string): string {
  return resolveFromWorkspace(workspaceRoot, CONFIG_FILE);
}

export async function hasConfig(workspaceRoot: string): Promise<boolean> {
  return exists(getConfigPath(workspaceRoot));
}

export async function writeDefaultConfig(
  workspaceRoot: string,
): Promise<AgSyncConfig> {
  const config = getDefaultConfig();
  await writeJsonFile(getConfigPath(workspaceRoot), config);
  return config;
}

export async function loadConfig(workspaceRoot: string): Promise<AgSyncConfig> {
  const parsed = configSchema.safeParse(
    await readJsonFile<unknown>(getConfigPath(workspaceRoot)),
  );
  if (!parsed.success) {
    throw new Error(`Invalid ag-sync.json: ${z.prettifyError(parsed.error)}`);
  }

  return parsed.data;
}

export async function loadNormalizedConfig(
  workspaceRoot: string,
): Promise<NormalizedAgSyncConfig> {
  const config = await loadConfig(workspaceRoot);

  const normalizedConfig = {
    version: config.version,
    workspaceRoot,
    agentDestDir: normalizeEntries(config.agentDestDir, workspaceRoot),
    agentSourceDir: normalizeEntries(config.agentSourceDir, workspaceRoot),
    automationDestDir: normalizeEntries(
      config.automationDestDir,
      workspaceRoot,
    ),
    automationSourceDir: normalizeEntries(
      config.automationSourceDir,
      workspaceRoot,
    ),
    denyList: config.denyList,
  };

  validateDestinationLayout(normalizedConfig);

  return normalizedConfig;
}

function normalizeEntries(
  entries: AgSyncConfig['agentDestDir'],
  workspaceRoot: string,
): NormalizedSyncPathEntry[] {
  return entries.map((entry) => ({
    path: entry.path,
    absolutePath: resolveFromWorkspace(workspaceRoot, entry.path),
    deleteExistingFromDest: entry.deleteExistingFromDest ?? false,
  }));
}

function validateDestinationLayout(config: NormalizedAgSyncConfig): void {
  for (const agentDestination of config.agentDestDir) {
    for (const automationDestination of config.automationDestDir) {
      if (
        !pathsOverlap(
          agentDestination.absolutePath,
          automationDestination.absolutePath,
        )
      ) {
        continue;
      }

      throw new Error(
        `Invalid ag-sync.json: agent and automation destination directories must not overlap (${agentDestination.path} vs ${automationDestination.path})`,
      );
    }
  }
}

function pathsOverlap(leftPath: string, rightPath: string): boolean {
  if (leftPath === rightPath) {
    return true;
  }

  return (
    isParentOrSame(leftPath, rightPath) || isParentOrSame(rightPath, leftPath)
  );
}

function isParentOrSame(parentPath: string, childPath: string): boolean {
  const relativePath = path.relative(parentPath, childPath);
  return (
    relativePath !== '..' &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath)
  );
}
