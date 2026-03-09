# ag-sync

`ag-sync` syncs Codex agent assets between a local repo and the live `~/.codex` runtime directories.

It is intentionally narrower than `skillz`: this project only handles native file assets for agents and automations. Skills are out of scope for now.

## Commands

```sh
ag-sync init
ag-sync sync
ag-sync import
ag-sync sync --watch
```

## Quickstart

```sh
cd /path/to/ag-sync-repo
ag-sync init
```

`init` creates `ag-sync.json`, ensures local `agents/` and `automations/` directories exist, and imports the current live assets from `~/.codex/agents` and `~/.codex/automations`.

After that, edit the local files and push them back to the live runtime with:

```sh
ag-sync sync
```

If the live runtime gains new files that are not yet in the repo, pull them back into the first configured source root with:

```sh
ag-sync import
```

To keep the live runtime updated while you edit:

```sh
ag-sync sync --watch
```

## Configuration

`ag-sync` reads `ag-sync.json` from the current working directory.

```json
{
  "version": "1.0",
  "agentDestDir": [
    {
      "path": "~/.codex/agents",
      "deleteExistingFromDest": true
    }
  ],
  "agentSourceDir": [
    {
      "path": "./agents"
    }
  ],
  "automationDestDir": [
    {
      "path": "~/.codex/automations",
      "deleteExistingFromDest": true
    }
  ],
  "automationSourceDir": [
    {
      "path": "./automations"
    }
  ],
  "denyList": []
}
```

### Semantics

- `agentSourceDir` and `automationSourceDir` are ordered overlays. Later directories win when the same relative path appears more than once.
- `deleteExistingFromDest` clears the destination root before the merged snapshot is copied.
- `agentDestDir` and `automationDestDir` must not overlap or nest inside each other.
- `denyList` applies glob patterns across both asset families.
- Sync is one-way from source directories into destination directories.
- `import` is non-destructive: it only copies destination files whose relative paths are missing from the merged source snapshot.
- `import` writes into the first configured source root for each asset family.
- `import` fails before writing if the same new relative path exists in multiple destination roots or if the target source tree has a file-vs-directory collision.

## Development

```sh
pnpm install
pnpm build
pnpm test
pnpm precommit
```
