import type { AgSyncConfig } from './types';

export const CONFIG_FILE = 'ag-sync.json';
export const DEFAULT_VERSION = '1.0';
export const DEFAULT_AGENT_SOURCE_DIR = './agents';
export const DEFAULT_AUTOMATION_SOURCE_DIR = './automations';
export const DEFAULT_AGENT_DEST_DIR = '~/.codex/agents';
export const DEFAULT_AUTOMATION_DEST_DIR = '~/.codex/automations';

export function getDefaultConfig(): AgSyncConfig {
  return {
    version: DEFAULT_VERSION,
    agentDestDir: [
      { path: DEFAULT_AGENT_DEST_DIR, deleteExistingFromDest: true },
    ],
    agentSourceDir: [{ path: DEFAULT_AGENT_SOURCE_DIR }],
    automationDestDir: [
      { path: DEFAULT_AUTOMATION_DEST_DIR, deleteExistingFromDest: true },
    ],
    automationSourceDir: [{ path: DEFAULT_AUTOMATION_SOURCE_DIR }],
    denyList: [],
  };
}
