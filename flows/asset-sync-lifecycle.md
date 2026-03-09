# Asset Sync Lifecycle

## Purpose

Document the end-to-end lifecycle for `ag-sync init`, `ag-sync sync`, `ag-sync import`, and `ag-sync sync --watch` so implementation keeps delete/copy ordering correct.

## Entry Assumptions

- The workspace root is the current working directory.
- `ag-sync.json` lives in the workspace root after initialization.
- Local source directories are `./agents` and `./automations` unless config overrides them.
- Destination paths may point to live runtime directories under `~/.codex`.

## Critical State Values

| Value | Source of truth | Representation | Initialization point | Snapshot point | First consumer |
| --- | --- | --- | --- | --- | --- |
| Workspace root | process cwd | absolute path | command startup | command startup | path resolver |
| Config document | `ag-sync.json` | parsed JSON | config load | start of each sync run | sync planner |
| Source entries | config arrays | normalized absolute paths | config normalization | start of each family sync | source snapshotter |
| Deny list | config `denyList` | glob strings | config normalization | start of each sync run | file filter |
| Merged snapshot | source scan output | relative path map | per-family planning | after source scan completes | destination writer |

## Flow

### Init

1. Resolve workspace root from `cwd`.
2. Create `ag-sync.json` with default local source roots and default Codex destination roots.
3. Ensure local `agents/` and `automations/` directories exist.
4. Copy existing assets from live destination roots into the local source roots.
5. Exit with a summary of created config and imported assets.

### Sync

1. Load and validate `ag-sync.json`.
2. Normalize source and destination paths.
3. For each asset family, scan all source roots and apply the deny list.
4. Build a merged relative-path snapshot with later roots overriding earlier ones.
5. For each destination:
   - If `deleteExistingFromDest` is true, delete current contents for that family destination.
   - Copy the merged snapshot into the destination.
6. Report copied, removed, and skipped entries.

### Import

1. Load and validate `ag-sync.json`.
2. Normalize source and destination paths.
3. For each asset family, build the merged source snapshot using the same deny-list and ordered-overlay rules as `sync`.
4. Scan each existing destination root and collect only files whose relative paths are missing from the merged source snapshot.
5. Abort before any writes if:
   - the same net-new relative path appears in multiple destination roots
   - the first source root has a file-vs-directory collision at an import target path
6. Copy the planned files into the first configured source root for that asset family.
7. Report imported files and skipped missing destination roots.

### Watch

1. Start from the `sync` flow’s validated config.
2. Watch `ag-sync.json` and all configured source roots.
3. Debounce change bursts.
4. If a sync is already running, mark a follow-up sync as pending.
5. After the active sync finishes, run one queued sync if needed.

## Exit / Handoff

- `init` produces a ready-to-edit local repo plus `ag-sync.json`.
- `sync` produces a destination tree consistent with the latest merged source snapshot.
- `import` produces a source tree that includes destination-only files without overwriting existing source content.
- `watch` hands back control only on process exit.

## Adjacent Flow Links

- `design.md`
- `specs/spec-1-project-scaffold-and-init.md`
- `specs/spec-2-sync-engine.md`
- `specs/spec-4-import-command.md`
- `specs/spec-3-watch-and-docs.md`

## Manual Notes 

[keep this for the user to add notes. do not change between edits]

## Changelog
- 2026-03-09: Added the reverse-sync lifecycle for `ag-sync import`. (019cd042-8f2b-77c1-be49-55abadf7a975)
- 2026-03-09: Added the core init/sync/watch lifecycle and snapshot boundaries for `ag-sync`. (019cd020-285a-7ae3-a04d-4c067c7eb3a1)
