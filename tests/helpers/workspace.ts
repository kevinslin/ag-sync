import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

export type MockWorkspace = {
  root: string;
  fakeHome: string;
  codexDir: string;
  cleanup: () => Promise<void>;
};

export async function createMockWorkspace(): Promise<MockWorkspace> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ag-sync-workspace-'));
  const fakeHome = await fs.mkdtemp(path.join(os.tmpdir(), 'ag-sync-home-'));
  const codexDir = path.join(fakeHome, '.codex');
  const agentDir = path.join(codexDir, 'agents');
  const automationDir = path.join(codexDir, 'automations');

  await fs.mkdir(agentDir, { recursive: true });
  await fs.mkdir(automationDir, { recursive: true });
  await fs.mkdir(path.join(automationDir, 'prepday'), { recursive: true });

  await fs.writeFile(
    path.join(agentDir, 'a-review.toml'),
    [
      'model = "gpt-5.3-codex"',
      'model_reasoning_effort = "high"',
      '',
      'developer_instructions = """reviewer"""',
      '',
    ].join('\n'),
    'utf8',
  );

  await fs.writeFile(
    path.join(automationDir, 'prepday', 'automation.toml'),
    ['version = 1', 'id = "prepday"', 'name = "Prepday"', ''].join('\n'),
    'utf8',
  );

  await fs.writeFile(
    path.join(automationDir, 'prepday', 'memory.md'),
    '# prepday memory\n\n- Existing durable state.\n',
    'utf8',
  );

  return {
    root,
    fakeHome,
    codexDir,
    cleanup: async () => {
      await fs.rm(root, { recursive: true, force: true });
      await fs.rm(fakeHome, { recursive: true, force: true });
    },
  };
}
