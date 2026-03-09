import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import { execCli } from '../helpers/cli';
import { createMockWorkspace, type MockWorkspace } from '../helpers/workspace';

type ConfigFile = {
  version: string;
  agentDestDir: Array<{ path: string; deleteExistingFromDest?: boolean }>;
  agentSourceDir: Array<{ path: string }>;
  automationDestDir: Array<{ path: string; deleteExistingFromDest?: boolean }>;
  automationSourceDir: Array<{ path: string }>;
  denyList: string[];
};

describe('ag-sync sync', () => {
  let workspace: MockWorkspace;

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
    await workspace.cleanup();
  });

  it('syncs local agent and automation assets into the configured destinations', async () => {
    await fs.writeFile(
      path.join(workspace.root, 'agents', 'a-review.toml'),
      'model = "gpt-5.4-codex"\n',
      'utf8',
    );
    await fs.writeFile(
      path.join(workspace.root, 'automations', 'prepday', 'memory.md'),
      '# prepday memory\n\n- Updated locally.\n',
      'utf8',
    );

    const result = await execCli(['sync'], {
      cwd: workspace.root,
      env: {
        HOME: workspace.fakeHome,
      },
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Synced agents');
    expect(result.stdout).toContain('Synced automations');

    const syncedAgent = await fs.readFile(
      path.join(workspace.fakeHome, '.codex', 'agents', 'a-review.toml'),
      'utf8',
    );
    const syncedAutomation = await fs.readFile(
      path.join(
        workspace.fakeHome,
        '.codex',
        'automations',
        'prepday',
        'memory.md',
      ),
      'utf8',
    );

    expect(syncedAgent).toContain('gpt-5.4-codex');
    expect(syncedAutomation).toContain('Updated locally');
  });

  it('respects denyList patterns across both asset families', async () => {
    const configPath = path.join(workspace.root, 'ag-sync.json');
    const config = JSON.parse(
      await fs.readFile(configPath, 'utf8'),
    ) as ConfigFile;
    config.denyList = ['ignored/**', '*.bak'];
    await fs.writeFile(
      configPath,
      `${JSON.stringify(config, null, 2)}\n`,
      'utf8',
    );

    await fs.mkdir(path.join(workspace.root, 'agents', 'ignored'), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(workspace.root, 'agents', 'ignored', 'skip.toml'),
      'skip\n',
      'utf8',
    );
    await fs.writeFile(
      path.join(workspace.root, 'automations', 'prepday', 'state.bak'),
      'nope\n',
      'utf8',
    );

    const result = await execCli(['sync'], {
      cwd: workspace.root,
      env: {
        HOME: workspace.fakeHome,
      },
    });

    expect(result.exitCode).toBe(0);

    await expect(
      fs.readFile(
        path.join(
          workspace.fakeHome,
          '.codex',
          'agents',
          'ignored',
          'skip.toml',
        ),
        'utf8',
      ),
    ).rejects.toThrow();
    await expect(
      fs.readFile(
        path.join(
          workspace.fakeHome,
          '.codex',
          'automations',
          'prepday',
          'state.bak',
        ),
        'utf8',
      ),
    ).rejects.toThrow();
  });

  it('uses later source directories to override earlier ones', async () => {
    const overlayRoot = path.join(workspace.root, 'overlay-agents');
    await fs.mkdir(overlayRoot, { recursive: true });
    await fs.writeFile(
      path.join(overlayRoot, 'a-review.toml'),
      'model = "overlay"\n',
      'utf8',
    );

    const configPath = path.join(workspace.root, 'ag-sync.json');
    const config = JSON.parse(
      await fs.readFile(configPath, 'utf8'),
    ) as ConfigFile;
    config.agentSourceDir = [
      ...config.agentSourceDir,
      { path: './overlay-agents' },
    ];
    await fs.writeFile(
      configPath,
      `${JSON.stringify(config, null, 2)}\n`,
      'utf8',
    );

    const result = await execCli(['sync'], {
      cwd: workspace.root,
      env: {
        HOME: workspace.fakeHome,
      },
    });

    expect(result.exitCode).toBe(0);

    const syncedAgent = await fs.readFile(
      path.join(workspace.fakeHome, '.codex', 'agents', 'a-review.toml'),
      'utf8',
    );
    expect(syncedAgent).toContain('overlay');
  });

  it('clears stale destination files when deleteExistingFromDest is enabled', async () => {
    const staleAgentPath = path.join(
      workspace.fakeHome,
      '.codex',
      'agents',
      'stale.toml',
    );
    await fs.writeFile(staleAgentPath, 'stale\n', 'utf8');

    const result = await execCli(['sync'], {
      cwd: workspace.root,
      env: {
        HOME: workspace.fakeHome,
      },
    });

    expect(result.exitCode).toBe(0);
    await expect(fs.readFile(staleAgentPath, 'utf8')).rejects.toThrow();
  });

  it('rejects overlapping agent and automation destination roots', async () => {
    const configPath = path.join(workspace.root, 'ag-sync.json');
    const config = JSON.parse(
      await fs.readFile(configPath, 'utf8'),
    ) as ConfigFile;
    config.automationDestDir = [
      { path: '~/.codex/agents', deleteExistingFromDest: true },
    ];
    await fs.writeFile(
      configPath,
      `${JSON.stringify(config, null, 2)}\n`,
      'utf8',
    );

    const result = await execCli(['sync'], {
      cwd: workspace.root,
      env: {
        HOME: workspace.fakeHome,
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('must not overlap');
  });
});
