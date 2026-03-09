import { hasConfig, loadNormalizedConfig } from '../core/config';
import { syncWorkspace } from '../core/sync-engine';
import { watchWorkspace } from '../core/watch';
import { info } from '../utils/logger';

export type SyncOptions = {
  watch?: boolean;
};

export async function syncCommand(
  _workspaceRoot: string,
  options: SyncOptions,
): Promise<void> {
  const workspaceRoot = _workspaceRoot;

  if (!(await hasConfig(workspaceRoot))) {
    throw new Error('No configuration file found. Run `ag-sync init` first.');
  }

  if (options.watch) {
    await watchWorkspace(workspaceRoot);
    return;
  }

  const summary = await syncWorkspace(
    await loadNormalizedConfig(workspaceRoot),
  );
  for (const family of summary.families) {
    if (family.skippedBecauseNoSourceRoots) {
      continue;
    }

    info(
      `Synced ${family.kind}s: ${family.sourceFiles} source file(s), ${family.copiedFiles} copied file(s), ${family.deletedEntries} deleted destination entr${family.deletedEntries === 1 ? 'y' : 'ies'}.`,
    );
  }
}
