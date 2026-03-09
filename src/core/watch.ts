import chokidar, { type FSWatcher } from 'chokidar';
import { getConfigPath, loadNormalizedConfig } from './config';
import { syncWorkspace } from './sync-engine';
import { error, info } from '../utils/logger';

const DEBOUNCE_MS = 300;
const WATCH_INTERVAL_MS = 100;

export async function watchWorkspace(workspaceRoot: string): Promise<void> {
  const configPath = getConfigPath(workspaceRoot);

  let watcher: FSWatcher | null = null;
  let debounceTimer: NodeJS.Timeout | null = null;
  let isSyncing = false;
  let pendingSync = false;
  let shuttingDown = false;
  let watchedPaths = new Set<string>();

  const syncAndRefreshWatchList = async (): Promise<void> => {
    const normalizedConfig = await loadNormalizedConfig(workspaceRoot);
    const summary = await syncWorkspace(normalizedConfig);

    for (const family of summary.families) {
      if (family.skippedBecauseNoSourceRoots) {
        continue;
      }

      info(
        `Synced ${family.kind}s: ${family.sourceFiles} source file(s), ${family.copiedFiles} copied file(s), ${family.deletedEntries} deleted destination entr${family.deletedEntries === 1 ? 'y' : 'ies'}.`,
      );
    }

    if (!watcher) {
      return;
    }

    const nextWatchedPaths = new Set<string>([
      configPath,
      ...normalizedConfig.agentSourceDir.map((entry) => entry.absolutePath),
      ...normalizedConfig.automationSourceDir.map(
        (entry) => entry.absolutePath,
      ),
    ]);

    const toRemove = [...watchedPaths].filter(
      (watchedPath) => !nextWatchedPaths.has(watchedPath),
    );
    const toAdd = [...nextWatchedPaths].filter(
      (nextPath) => !watchedPaths.has(nextPath),
    );

    if (toRemove.length > 0) {
      await watcher.unwatch(toRemove);
    }

    if (toAdd.length > 0) {
      await watcher.add(toAdd);
    }

    watchedPaths = nextWatchedPaths;
  };

  const runSync = async (): Promise<void> => {
    if (isSyncing) {
      pendingSync = true;
      return;
    }

    isSyncing = true;
    try {
      await syncAndRefreshWatchList();
    } catch (err) {
      error(`Watch sync failed: ${getErrorMessage(err)}`);
    } finally {
      isSyncing = false;
    }

    if (pendingSync) {
      pendingSync = false;
      await runSync();
    }
  };

  watcher = chokidar.watch([configPath], {
    ignoreInitial: true,
    usePolling: true,
    interval: WATCH_INTERVAL_MS,
  });

  watcher.on('all', (eventName, changedPath) => {
    if (!debounceTimer) {
      info(`Change detected (${eventName} ${changedPath}).`);
    }

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void runSync();
    }, DEBOUNCE_MS);
  });

  await runSync();
  info('Watching for changes. Press Ctrl+C to stop.');

  await new Promise<void>((resolve, reject) => {
    const shutdown = async (shutdownError?: unknown) => {
      if (shuttingDown) {
        return;
      }
      shuttingDown = true;

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      if (watcher) {
        await watcher.close();
      }

      if (shutdownError) {
        reject(toError(shutdownError));
        return;
      }

      resolve();
    };

    watcher.on('error', (err) => {
      error(`Watcher error: ${getErrorMessage(err)}`);
      void shutdown(err);
    });

    process.on('SIGINT', () => {
      void shutdown();
    });

    process.on('SIGTERM', () => {
      void shutdown();
    });
  });
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }

  return String(err);
}

function toError(err: unknown): Error {
  if (err instanceof Error) {
    return err;
  }

  return new Error(String(err));
}
