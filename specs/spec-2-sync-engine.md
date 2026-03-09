# Spec 2: Sync Engine

## Objective and Scope

Implement the one-way native sync engine that copies local agent assets to configured destinations for both asset families.

In scope:

- merged source snapshots
- global deny-list filtering
- multiple source roots with ordered override semantics
- destructive destination resets with `deleteExistingFromDest`
- integration tests for sync behavior

Out of scope:

- watch mode
- advanced conflict resolution beyond ordered override

## Required Pre-Read

- `design.md`
- `flows/asset-sync-lifecycle.md`
- `specs/spec-1-project-scaffold-and-init.md`

## Implementation Plan

1. Implement config loading and validation for `ag-sync.json`.
2. Add recursive source scanners that emit relative-path snapshots per asset family.
3. Apply `denyList` filters consistently to files and directories.
4. Merge source snapshots in config order so later roots override earlier roots.
5. Write the merged snapshot into every configured destination.
6. If `deleteExistingFromDest` is true, clear destination contents before copying.
7. Add integration tests covering:
   - file and directory sync
   - deny-list exclusion
   - ordered override behavior
   - destructive sync cleanup

## Validation and Rollout

- `pnpm test -- sync`
- verify destination trees match the merged source snapshot
- verify denied files are absent
- verify destructive sync removes stale files

## Dependencies and Risks

- Depends on Spec 1 for project scaffold and reusable utilities.
- Risk: delete-before-copy could destroy destination data if the source snapshot is empty for the wrong reason; validation must happen first.
- Risk: mixed file/directory layouts need explicit tests to avoid path collisions.

## Status Checklist

- [x] Config loader implemented
- [x] Snapshot builder implemented
- [x] Destination writer implemented
- [x] Sync integration tests passing

## Manual Notes 

[keep this for the user to add notes. do not change between edits]

## Changelog
- 2026-03-09: Completed milestone 2 with passing sync integration coverage. (019cd020-285a-7ae3-a04d-4c067c7eb3a1)
- 2026-03-09: Added the execution-ready milestone spec for native asset sync. (019cd020-285a-7ae3-a04d-4c067c7eb3a1)
