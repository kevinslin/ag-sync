import { hasConfig, loadNormalizedConfig } from '../core/config';
import { importWorkspace } from '../core/sync-engine';
import { info } from '../utils/logger';

export async function importCommand(workspaceRoot: string): Promise<void> {
  if (!(await hasConfig(workspaceRoot))) {
    throw new Error('No configuration file found. Run `ag-sync init` first.');
  }

  const summary = await importWorkspace(
    await loadNormalizedConfig(workspaceRoot),
  );
  for (const family of summary.families) {
    info(
      `Imported ${family.kind}s: ${family.importedFiles} file(s), ${family.missingDestinationRoots} missing destination root(s).`,
    );
  }
}
