import {
  DEFAULT_AGENT_DEST_DIR,
  DEFAULT_AUTOMATION_DEST_DIR,
} from '../constants';
import {
  hasConfig,
  loadNormalizedConfig,
  writeDefaultConfig,
} from '../core/config';
import { copyDirectoryContents, ensureDir } from '../utils/fs';
import { info, success, warning } from '../utils/logger';

export async function initCommand(workspaceRoot: string): Promise<void> {
  if (await hasConfig(workspaceRoot)) {
    throw new Error('Configuration file already exists at ag-sync.json');
  }

  await writeDefaultConfig(workspaceRoot);
  const normalizedConfig = await loadNormalizedConfig(workspaceRoot);

  for (const entry of normalizedConfig.agentSourceDir) {
    await ensureDir(entry.absolutePath);
  }

  for (const entry of normalizedConfig.automationSourceDir) {
    await ensureDir(entry.absolutePath);
  }

  const importedAgents = await importLiveAssets(
    normalizedConfig.agentDestDir[0]?.absolutePath,
    normalizedConfig.agentSourceDir[0]?.absolutePath,
    DEFAULT_AGENT_DEST_DIR,
  );

  const importedAutomations = await importLiveAssets(
    normalizedConfig.automationDestDir[0]?.absolutePath,
    normalizedConfig.automationSourceDir[0]?.absolutePath,
    DEFAULT_AUTOMATION_DEST_DIR,
  );

  success('Created configuration file: ag-sync.json');
  info(`Imported ${importedAgents} top-level agent entries into ./agents`);
  info(
    `Imported ${importedAutomations} top-level automation entries into ./automations`,
  );
  success('Initialization complete');
}

async function importLiveAssets(
  sourceDir: string | undefined,
  destinationDir: string | undefined,
  sourceLabel: string,
): Promise<number> {
  if (!sourceDir || !destinationDir) {
    return 0;
  }

  const copiedEntries = await copyDirectoryContents(sourceDir, destinationDir);

  if (copiedEntries === 0) {
    warning(
      `No existing assets found in ${sourceLabel}; created an empty local source directory.`,
    );
  }

  return copiedEntries;
}
