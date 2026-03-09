import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { execCli } from '../helpers/cli';
import { createMockWorkspace, type MockWorkspace } from '../helpers/workspace';

describe('ag-sync sync --watch', () => {
  let workspace: MockWorkspace;
  let watchProcess: WatchProcess | null = null;

  beforeEach(async () => {
    workspace = await createMockWorkspace();
    await execCli(['init'], {
      cwd: workspace.root,
      env: {
        HOME: workspace.fakeHome,
      },
    });
  });

  afterEach(async () => {
    if (watchProcess && !watchProcess.child.killed) {
      watchProcess.child.kill('SIGTERM');
      await waitForExit(watchProcess.child);
    }

    await workspace.cleanup();
  });

  it('performs an initial sync and reacts to later source changes', async () => {
    const cliPath = path.join(process.cwd(), 'dist', 'cli.js');
    watchProcess = startWatchProcess(
      cliPath,
      workspace.root,
      workspace.fakeHome,
    );

    await waitForOutput(
      watchProcess,
      'Watching for changes. Press Ctrl+C to stop.',
    );

    await fs.writeFile(
      path.join(workspace.root, 'agents', 'a-review.toml'),
      'model = "watched-update"\n',
      'utf8',
    );

    await waitFor(async () => {
      const destinationContent = await fs.readFile(
        path.join(workspace.fakeHome, '.codex', 'agents', 'a-review.toml'),
        'utf8',
      );
      return destinationContent.includes('watched-update');
    });

    const destinationContent = await fs.readFile(
      path.join(workspace.fakeHome, '.codex', 'agents', 'a-review.toml'),
      'utf8',
    );
    expect(destinationContent).toContain('watched-update');
  });

  it('stays alive after a bad config edit and resumes syncing once fixed', async () => {
    const cliPath = path.join(process.cwd(), 'dist', 'cli.js');
    watchProcess = startWatchProcess(
      cliPath,
      workspace.root,
      workspace.fakeHome,
    );

    await waitForOutput(
      watchProcess,
      'Watching for changes. Press Ctrl+C to stop.',
    );

    await fs.writeFile(
      path.join(workspace.root, 'ag-sync.json'),
      '{\n',
      'utf8',
    );
    await waitForOutput(watchProcess, 'Watch sync failed:');

    await fs.writeFile(
      path.join(workspace.root, 'ag-sync.json'),
      `${JSON.stringify(
        {
          version: '1.0',
          agentDestDir: [
            { path: '~/.codex/agents', deleteExistingFromDest: true },
          ],
          agentSourceDir: [{ path: './agents' }],
          automationDestDir: [
            { path: '~/.codex/automations', deleteExistingFromDest: true },
          ],
          automationSourceDir: [{ path: './automations' }],
          denyList: [],
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    await fs.writeFile(
      path.join(workspace.root, 'automations', 'prepday', 'memory.md'),
      '# prepday memory\n\n- Recovered after invalid config.\n',
      'utf8',
    );

    await waitFor(async () => {
      const destinationContent = await fs.readFile(
        path.join(
          workspace.fakeHome,
          '.codex',
          'automations',
          'prepday',
          'memory.md',
        ),
        'utf8',
      );
      return destinationContent.includes('Recovered after invalid config');
    });
  });
});

type WatchProcess = {
  child: ChildProcessWithoutNullStreams;
  combinedOutput: { value: string };
};

function startWatchProcess(
  cliPath: string,
  cwd: string,
  fakeHome: string,
): WatchProcess {
  const child = spawn('node', [cliPath, 'sync', '--watch'], {
    cwd,
    env: {
      ...process.env,
      HOME: fakeHome,
    },
  });
  const combinedOutput = { value: '' };

  child.stdout.on('data', (chunk: Buffer) => {
    combinedOutput.value += chunk.toString();
  });

  child.stderr.on('data', (chunk: Buffer) => {
    combinedOutput.value += chunk.toString();
  });

  return {
    child,
    combinedOutput,
  };
}

async function waitForOutput(
  watchProcess: WatchProcess,
  expectedOutput: string,
): Promise<void> {
  await waitFor(
    async () => watchProcess.combinedOutput.value.includes(expectedOutput),
    5000,
  );
}

async function waitFor(
  predicate: () => Promise<boolean>,
  timeoutMs: number = 4000,
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (await predicate()) {
      return;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
  }

  throw new Error(`Timed out after ${timeoutMs}ms`);
}

async function waitForExit(
  childProcess: ChildProcessWithoutNullStreams,
): Promise<void> {
  await new Promise<void>((resolve) => {
    childProcess.once('exit', () => {
      resolve();
    });
  });
}
