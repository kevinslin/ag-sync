# Spec 1: Project Scaffold and Init

## Objective and Scope

Create the initial TypeScript CLI project, define the config schema for `ag-sync.json`, and implement `ag-sync init` so a blank repo becomes a usable agent-asset workspace.

In scope:

- package/tooling scaffold
- `ag-sync init`
- default config generation
- local `agents/` and `automations/` directory creation
- import from live Codex directories into local sources
- integration tests for init

Out of scope:

- actual sync engine behavior
- watch mode

## Required Pre-Read

- `design.md`
- `flows/asset-sync-lifecycle.md`

## Implementation Plan

1. Scaffold a Node 18+ TypeScript CLI with Commander, Zod, Jest, and build/test scripts.
2. Add path utilities for `cwd` resolution, `~` expansion, and safe directory creation/copying.
3. Define config types and validation for:
   - `agentDestDir`
   - `agentSourceDir`
   - `automationDestDir`
   - `automationSourceDir`
   - `denyList`
4. Implement `ag-sync init`:
   - fail if `ag-sync.json` already exists
   - write default config pointing local sources at `./agents` and `./automations`
   - ensure local source directories exist
   - import from `~/.codex/agents` and `~/.codex/automations` into the local source directories
5. Add integration tests that validate config contents and imported files.

## Validation and Rollout

- `pnpm test -- init`
- verify `ag-sync init` creates `ag-sync.json`
- verify local source directories are created
- verify existing destination assets are imported into the local repo
- verify rerunning `init` fails clearly

## Dependencies and Risks

- Depends on the design and flow doc semantics being stable.
- Risk: the user’s live Codex directories may be missing; `init` should still create an empty local scaffold without failing.
- Risk: copying from live directories during tests must be isolated behind env overrides or temp fixtures.

## Status Checklist

- [x] Project scaffold created
- [x] Config schema added
- [x] `init` implemented
- [x] Init integration tests passing

## Manual Notes 

[keep this for the user to add notes. do not change between edits]

## Changelog
- 2026-03-09: Completed milestone 1 with passing integration coverage for `ag-sync init`. (019cd020-285a-7ae3-a04d-4c067c7eb3a1)
- 2026-03-09: Added the execution-ready milestone spec for project scaffold and init. (019cd020-285a-7ae3-a04d-4c067c7eb3a1)
