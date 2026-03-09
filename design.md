# Ag Sync Design

## Problem / Context

`ag-sync` is a new CLI for syncing Codex agent assets across a local repo and the live `~/.codex` runtime directories. The user wants something analogous to `skillz`, but scoped to agent assets only for now. The initial asset families are:

- `agents/`: file-based agent definitions such as `a-review.toml`
- `automations/`: directory-based automation bundles such as `prepday/automation.toml` and `memory.md`

The current repo is empty, while the live Codex home already contains real assets under `~/.codex/agents` and `~/.codex/automations`. `ag-sync init` therefore needs to bootstrap a local project by importing those live assets into the current repo and generating `ag-sync.json` with sensible defaults.

The nearest prior art is the sibling `skillz` repo. We want to preserve its strengths, especially a small TypeScript CLI, integration-first tests, and watch mode, while removing prompt-template complexity and focusing on native directory/file sync.

## Goals

- Provide an `ag-sync` CLI with `init`, `sync`, `sync --watch`, and `import`.
- Store configuration in `ag-sync.json`.
- Default local source directories to `./agents` and `./automations`.
- Default destination directories to `~/.codex/agents` and `~/.codex/automations`.
- During `init`, import the current live Codex assets into the local repo so the repo becomes the source of truth.
- Support multiple source and destination entries per asset family.
- Support global deny-list glob patterns that exclude files or directories from sync.
- Support destructive destination cleanup when `deleteExistingFromDest` is enabled.
- Allow `import` to pull destination files that are missing from all configured source roots back into the repo without overwriting existing source files.
- Provide integration tests for `init`, `sync`, `import`, and watch behavior.

## Non-Goals

- Syncing `skills/` or any prompt-injection output.
- General bidirectional merge or conflict resolution between source and destination.
- Git-driven sync, remote pull/push, or branch management automation.
- Partial in-file edits; sync is native file copying only.
- Automatic migration from the existing `~/.codex/agent-sync.json` format.

## Proposed Architecture and Control / Config Model

The CLI will be a small Node 18+ TypeScript app with four core layers:

1. CLI surface
   - `src/cli.ts` wires Commander commands.
   - `init` bootstraps config and imports live assets.
   - `sync` performs one sync cycle and optionally enters watch mode.
   - `import` scans configured destinations for net-new files and copies them into the first configured source root for each asset family.

2. Config model
   - `ag-sync.json` is the only control-plane file.
   - Zod validates the config at load time.
   - Paths are normalized with `~` expansion and relative-path resolution from the workspace root.

3. Asset sync engine
   - Asset families are modeled as `agent` and `automation`.
   - For each family, the engine scans source roots, applies global deny rules, materializes a merged relative-path snapshot, and copies the snapshot into each destination.
   - Later source directories override earlier ones for the same relative path. This keeps layering deterministic and simple.
   - If `deleteExistingFromDest` is `true`, the engine clears destination contents before copying the merged snapshot for that family.
   - `import` reuses the same snapshot semantics, but only copies destination files whose relative paths are missing from the merged source snapshot.

4. Watch runner
   - `sync --watch` watches `ag-sync.json` plus configured source roots.
   - Changes are debounced and serialized so only one sync runs at a time.
   - If changes occur during a running sync, one follow-up sync is queued.

Critical lifecycle assumptions:

- `cwd` initialization: `init` captures the current working directory once and treats it as the workspace root for config and local source paths.
- Config snapshot: `sync` loads and validates `ag-sync.json` at the start of each run. Watch mode reloads config before every sync cycle.
- Source snapshot: each sync run snapshots source file trees before destination writes begin.
- Consume boundary: destination writes only begin after the merged source snapshot is fully known for a given asset family.

Snapshot semantics:

```text
run starts
   |
   v
load ag-sync.json
   |
   v
normalize paths + denyList
   |
   v
scan source roots in config order
   |
   +--> source[0] --\
   +--> source[1] ----> merged source snapshot (relative path -> file path)
   +--> source[n] --/      later source roots win on duplicate paths
                              |
                              +--> sync: write snapshot to each destination root
                              |
                              +--> import: scan destination roots, keep only
                                           paths missing from the snapshot, then
                                           copy those files into the first
                                           configured source root

write boundary: no sync/import writes begin until the merged source snapshot is complete
```

This ordering avoids half-computed deletes and makes watch retries deterministic.

## Project Conventions

- `design.md` is the canonical planning artifact.
- Specs live in `specs/`.
- `flows/` stores optional supporting flow docs.
- `config.md` is reserved for real runtime configuration, not workflow state.
- `.agents/progress/` stores execution progress and learnings for dev-loop runs.

## Workflow Status

- Current planning stage: Execution complete.
- Workflow paused: no.
- Ready for spec generation: complete.
- Ready for execution: complete.

## Next Active Item

Decide whether `ag-sync` should expand beyond `agents/` and `automations/` into other Codex asset families.

## Rollout Plan and Verification Signals

- Milestone 1: scaffold the TypeScript CLI, config schema, and `init` bootstrap flow.
- Milestone 2: implement native sync for both asset families with deny-list filtering and destructive sync semantics.
- Milestone 3: add `sync --watch`, documentation, and full verification.
- Milestone 4: add `import` to pull net-new destination files back into the first configured source root.

Verification signals:

- `pnpm test` passes with integration coverage for init, sync, and watch behavior.
- `ag-sync init` creates `ag-sync.json`, local source folders, and imported asset copies.
- `ag-sync sync` mirrors local changes into destination test directories.
- `ag-sync import` copies destination-only files into the first source root without overwriting existing source content.
- `ag-sync sync --watch` performs follow-up syncs after source or config changes.

## Risks and Open Questions

- The live `~/.codex/automations` tree may contain nested artifacts that should not always be copied. The deny list is the first escape hatch.
- Destructive destination cleanup is powerful; the implementation must guarantee the delete happens only after a valid merged source snapshot exists.
- Multiple source directories can shadow each other. The chosen rule is ordered override, documented in README and tests.
- `import` needs an explicit conflict contract when the same net-new relative path appears in multiple destination roots; silent precedence would be surprising.
- `import` must stay non-destructive: it should not overwrite existing source files or delete destination-only content.
- We should keep the config narrow now instead of abstracting for future asset types too early.

## Milestone Breakdown

1. `specs/spec-1-project-scaffold-and-init.md`
   - Build the project scaffold and `init` command.
   - Import existing live Codex agent assets into `./agents` and `./automations`.
2. `specs/spec-2-sync-engine.md`
   - Implement the sync engine with global deny-list filtering and ordered source overlays.
   - Support destructive destination resets via `deleteExistingFromDest`.
3. `specs/spec-3-watch-and-docs.md`
   - Add `sync --watch`, debounce/queue semantics, README coverage, and verification polish.
4. `specs/spec-4-import-command.md`
   - Add `import` to copy destination-only files back into the repo without overwriting existing source content.

## Manual Notes

[keep this for the user to add notes. do not change between edits]

## Changelog

- 2026-03-09: Implemented milestone 4 with the `import` command, docs, and passing precommit verification. (019cd042-8f2b-77c1-be49-55abadf7a975)
- 2026-03-09: Drafted milestone 4 for an `import` subcommand that pulls net-new destination assets back into source trees. (019cd042-8f2b-77c1-be49-55abadf7a975)
- 2026-03-09: Completed milestone 3 with watch mode, docs, and a passing precommit run. (019cd020-285a-7ae3-a04d-4c067c7eb3a1)
- 2026-03-09: Completed milestone 2 with ordered source overlays, deny-list filtering, and destructive native sync. (019cd020-285a-7ae3-a04d-4c067c7eb3a1)
- 2026-03-09: Completed milestone 1 with the TypeScript scaffold, config model, and `ag-sync init`. (019cd020-285a-7ae3-a04d-4c067c7eb3a1)
- 2026-03-09: Created the initial non-interactive planloop design, flow doc, and milestone specs. (019cd020-285a-7ae3-a04d-4c067c7eb3a1)
