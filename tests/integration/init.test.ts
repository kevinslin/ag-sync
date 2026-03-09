import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import { execCli } from '../helpers/cli';
import { createMockWorkspace, type MockWorkspace } from '../helpers/workspace';

describe('ag-sync init', () => {
  let workspace: MockWorkspace;

  beforeEach(async () => {
    workspace = await createMockWorkspace();
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  it('creates ag-sync.json with the default local and Codex paths', async () => {
    const result = await execCli(['init'], {
      cwd: workspace.root,
      env: {
        HOME: workspace.fakeHome,
      },
    });

    expect(result.exitCode).toBe(0);

    const configPath = path.join(workspace.root, 'ag-sync.json');
    const config = JSON.parse(await fs.readFile(configPath, 'utf8')) as {
      version: string;
      agentDestDir: Array<{ path: string; deleteExistingFromDest?: boolean }>;
      agentSourceDir: Array<{ path: string }>;
      automationDestDir: Array<{
        path: string;
        deleteExistingFromDest?: boolean;
      }>;
      automationSourceDir: Array<{ path: string }>;
      denyList: string[];
    };

    expect(config.version).toBe('1.0');
    expect(config.agentSourceDir).toEqual([{ path: './agents' }]);
    expect(config.automationSourceDir).toEqual([{ path: './automations' }]);
    expect(config.agentDestDir).toEqual([
      { path: '~/.codex/agents', deleteExistingFromDest: true },
    ]);
    expect(config.automationDestDir).toEqual([
      { path: '~/.codex/automations', deleteExistingFromDest: true },
    ]);
    expect(config.denyList).toEqual([]);
  });

  it('imports live Codex assets into local source directories', async () => {
    const result = await execCli(['init'], {
      cwd: workspace.root,
      env: {
        HOME: workspace.fakeHome,
      },
    });

    expect(result.exitCode).toBe(0);

    const localAgentFile = path.join(workspace.root, 'agents', 'a-review.toml');
    const localAutomationFile = path.join(
      workspace.root,
      'automations',
      'prepday',
      'automation.toml',
    );
    const localAutomationMemory = path.join(
      workspace.root,
      'automations',
      'prepday',
      'memory.md',
    );

    expect(await fs.readFile(localAgentFile, 'utf8')).toContain(
      'model = "gpt-5.3-codex"',
    );
    expect(await fs.readFile(localAutomationFile, 'utf8')).toContain(
      'id = "prepday"',
    );
    expect(await fs.readFile(localAutomationMemory, 'utf8')).toContain(
      'Existing durable state',
    );
  });

  it('fails if ag-sync.json already exists', async () => {
    await execCli(['init'], {
      cwd: workspace.root,
      env: {
        HOME: workspace.fakeHome,
      },
    });

    const result = await execCli(['init'], {
      cwd: workspace.root,
      env: {
        HOME: workspace.fakeHome,
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      'Configuration file already exists at ag-sync.json',
    );
  });
});
