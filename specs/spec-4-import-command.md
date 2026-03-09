# Spec 4: Import Command

## Objective and Scope

Add an `ag-sync import` subcommand that scans configured destination trees and copies only net-new files back into the repo source trees.

In scope:

- `ag-sync import`
- destination-to-source scanning for both asset families
- deny-list filtering during import planning
- deterministic import target selection
- conflict detection for ambiguous destination candidates
- integration tests for import behavior

Out of scope:

- overwriting existing source files
- deleting files from source or destination
- merging edits for paths that already exist in any source root
- watch mode for import

## Required Pre-Read

- `design.md`
- `flows/asset-sync-lifecycle.md`
- `specs/spec-1-project-scaffold-and-init.md`
- `specs/spec-2-sync-engine.md`

## Requirements

1. `ag-sync import` must require `ag-sync.json`, just like `sync`.
2. For each asset family, the command must build the same merged source snapshot used by `sync`, applying `denyList` and ordered source-root semantics.
3. A destination file qualifies as importable only when its relative path is absent from the merged source snapshot for that asset family.
4. Imported files must be written into the first configured source root for that asset family, preserving relative paths and creating parent directories as needed.
5. If the same net-new relative path appears in more than one destination root for a family, the command must fail before writing any files and report the conflicting path(s) and destination roots.
6. The command must never overwrite an existing source file, even if destination contents differ.
7. The command must never delete files from any source or destination directory.
8. If a configured destination root does not exist, it should be skipped without failing the command.
9. If a family has no configured source root, the command must fail clearly because it has no deterministic write target.
10. If an import path would require creating a directory beneath an existing source file, or writing a file where the target path is already a directory in the first source root, the command must fail before writing any files and report the conflicting source path(s).
11. Command output must summarize imported file counts per family and surface skipped families or conflicts clearly.

## Proposed Design

### CLI contract

- Add a top-level `import` command in `src/cli.ts`.
- Implement `src/commands/import.ts` following the same command shape as `init` and `sync`.

### Planning pass

1. Load and normalize `ag-sync.json`.
2. For each asset family:
   - validate that at least one source root is configured
   - build a merged source snapshot using the existing source-scanning and deny-list behavior
   - scan every existing destination root recursively, applying the same deny list
   - collect destination candidates whose relative paths are absent from the merged source snapshot
3. Group candidate files by relative path within each asset family.
4. Validate that every planned write is shape-compatible with the first source root's current filesystem state.
5. Abort the command before any writes if any relative path maps to more than one destination root or any target path collides with existing source filesystem shape.

This all-or-nothing planning pass keeps `import` non-destructive and avoids partial writes when the live runtime is ambiguous.

### Execution pass

1. For each asset family with an import plan:
   - ensure the first source root exists
   - copy each planned file into that source root
2. Preserve relative paths exactly, so automation bundles remain directory-structured on import.
3. Log a per-family summary with imported file counts and any skipped destination roots.

### Reuse and boundaries

- Reuse the existing snapshot-building rules from `sync` rather than inventing a second path-resolution model.
- Keep import-specific logic separate from forward sync writes so the existing `sync` behavior remains unchanged.
- Do not add new config fields for milestone 4; the command should derive all behavior from existing source roots, destination roots, and `denyList`.

## Validation and Rollout

- add integration coverage for:
  - importing a new agent file from a destination root into the first source root
  - importing nested automation files while preserving directory structure
  - skipping files that already exist in any source root
  - respecting `denyList` during destination scans
  - failing cleanly when the same net-new path appears in multiple destination roots
  - failing cleanly on file-vs-directory collisions in the target source root
- run `pnpm test -- import`
- run `pnpm precommit`

## Dependencies and Risks

- Depends on Spec 2 for shared snapshot logic and file-copy utilities.
- Risk: multiple destination roots make reverse sync ambiguous; the spec resolves this by failing on duplicate net-new paths instead of inventing precedence.
- Risk: importing into the first source root is a policy choice; it matches `init` and keeps writes deterministic, but it should be documented clearly.
- Risk: target source roots can contain file-vs-directory collisions that are invisible in the merged file snapshot; planning must detect those before any writes start.
- Risk: destination trees may contain ephemeral runtime files; `denyList` remains the first mechanism for excluding them.

## Status Checklist

- [x] CLI command added
- [x] Import planner implemented
- [x] Conflict handling implemented
- [x] Import integration tests passing
- [x] README updated

## Manual Notes

[keep this for the user to add notes. do not change between edits]

## Changelog

- 2026-03-09: Verified `ag-sync import` with a passing `pnpm precommit`. (019cd042-8f2b-77c1-be49-55abadf7a975)
- 2026-03-09: Implemented `ag-sync import` with conflict detection, docs, and integration coverage. (019cd042-8f2b-77c1-be49-55abadf7a975)
- 2026-03-09: Added the execution-ready milestone spec for the `import` subcommand. (019cd042-8f2b-77c1-be49-55abadf7a975)
