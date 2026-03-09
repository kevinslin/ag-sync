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

describe('ag-sync import', () => {
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

  it('imports destination-only agent and automation files into the first source roots', async () => {
    await fs.writeFile(
      path.join(workspace.fakeHome, '.codex', 'agents', 'new-agent.toml'),
      'model = "imported"\n',
      'utf8',
    );
    await fs.mkdir(
      path.join(workspace.fakeHome, '.codex', 'automations', 'retro'),
      {
        recursive: true,
      },
    );
    await fs.writeFile(
      path.join(
        workspace.fakeHome,
        '.codex',
        'automations',
        'retro',
        'automation.toml',
      ),
      'id = "retro"\n',
      'utf8',
    );
    await fs.writeFile(
      path.join(
        workspace.fakeHome,
        '.codex',
        'automations',
        'retro',
        'memory.md',
      ),
      '# retro memory\n',
      'utf8',
    );

    const result = await execCli(['import'], {
      cwd: workspace.root,
      env: {
        HOME: workspace.fakeHome,
      },
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Imported agents');
    expect(result.stdout).toContain('Imported automations');

    expect(
      await fs.readFile(
        path.join(workspace.root, 'agents', 'new-agent.toml'),
        'utf8',
      ),
    ).toContain('imported');
    expect(
      await fs.readFile(
        path.join(workspace.root, 'automations', 'retro', 'automation.toml'),
        'utf8',
      ),
    ).toContain('id = "retro"');
    expect(
      await fs.readFile(
        path.join(workspace.root, 'automations', 'retro', 'memory.md'),
        'utf8',
      ),
    ).toContain('# retro memory');
  });

  it('skips denied files and paths that already exist in any source root', async () => {
    const overlayRoot = path.join(workspace.root, 'overlay-agents');
    await fs.mkdir(overlayRoot, { recursive: true });
    await fs.writeFile(
      path.join(overlayRoot, 'shared.toml'),
      'model = "existing-overlay"\n',
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
    config.denyList = ['ignored/**'];
    await fs.writeFile(
      configPath,
      `${JSON.stringify(config, null, 2)}\n`,
      'utf8',
    );

    await fs.writeFile(
      path.join(workspace.fakeHome, '.codex', 'agents', 'shared.toml'),
      'model = "runtime-version"\n',
      'utf8',
    );
    await fs.mkdir(
      path.join(workspace.fakeHome, '.codex', 'agents', 'ignored'),
      {
        recursive: true,
      },
    );
    await fs.writeFile(
      path.join(workspace.fakeHome, '.codex', 'agents', 'ignored', 'skip.toml'),
      'ignore me\n',
      'utf8',
    );

    const result = await execCli(['import'], {
      cwd: workspace.root,
      env: {
        HOME: workspace.fakeHome,
      },
    });

    expect(result.exitCode).toBe(0);
    await expect(
      fs.readFile(path.join(workspace.root, 'agents', 'shared.toml'), 'utf8'),
    ).rejects.toThrow();
    await expect(
      fs.readFile(
        path.join(workspace.root, 'agents', 'ignored', 'skip.toml'),
        'utf8',
      ),
    ).rejects.toThrow();
  });

  it('fails before writing when the same net-new path exists in multiple destination roots', async () => {
    const configPath = path.join(workspace.root, 'ag-sync.json');
    const config = JSON.parse(
      await fs.readFile(configPath, 'utf8'),
    ) as ConfigFile;
    config.agentDestDir = [
      ...config.agentDestDir,
      { path: './mirror-agents-dest' },
    ];
    await fs.writeFile(
      configPath,
      `${JSON.stringify(config, null, 2)}\n`,
      'utf8',
    );

    await fs.mkdir(path.join(workspace.root, 'mirror-agents-dest'), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(workspace.fakeHome, '.codex', 'agents', 'shared-new.toml'),
      'primary\n',
      'utf8',
    );
    await fs.writeFile(
      path.join(workspace.root, 'mirror-agents-dest', 'shared-new.toml'),
      'secondary\n',
      'utf8',
    );

    const result = await execCli(['import'], {
      cwd: workspace.root,
      env: {
        HOME: workspace.fakeHome,
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('multiple destination roots');
    await expect(
      fs.readFile(
        path.join(workspace.root, 'agents', 'shared-new.toml'),
        'utf8',
      ),
    ).rejects.toThrow();
  });

  it('fails before writing on target file-vs-directory collisions', async () => {
    await fs.writeFile(
      path.join(workspace.root, 'agents', 'collision'),
      'existing file\n',
      'utf8',
    );
    await fs.mkdir(
      path.join(workspace.fakeHome, '.codex', 'agents', 'collision'),
      {
        recursive: true,
      },
    );
    await fs.writeFile(
      path.join(
        workspace.fakeHome,
        '.codex',
        'agents',
        'collision',
        'nested.toml',
      ),
      'nested\n',
      'utf8',
    );

    const result = await execCli(['import'], {
      cwd: workspace.root,
      env: {
        HOME: workspace.fakeHome,
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('conflict with existing source path');
    await expect(
      fs.readFile(
        path.join(workspace.root, 'agents', 'collision', 'nested.toml'),
        'utf8',
      ),
    ).rejects.toThrow();
  });
});
