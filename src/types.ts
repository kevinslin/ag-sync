export type SyncPathEntry = {
  path: string;
  deleteExistingFromDest?: boolean;
};

export type AgSyncConfig = {
  version: string;
  agentDestDir: SyncPathEntry[];
  agentSourceDir: SyncPathEntry[];
  automationDestDir: SyncPathEntry[];
  automationSourceDir: SyncPathEntry[];
  denyList: string[];
};

export type AssetKind = 'agent' | 'automation';

export type NormalizedSyncPathEntry = {
  path: string;
  absolutePath: string;
  deleteExistingFromDest: boolean;
};

export type NormalizedAgSyncConfig = {
  version: string;
  workspaceRoot: string;
  agentDestDir: NormalizedSyncPathEntry[];
  agentSourceDir: NormalizedSyncPathEntry[];
  automationDestDir: NormalizedSyncPathEntry[];
  automationSourceDir: NormalizedSyncPathEntry[];
  denyList: string[];
};
