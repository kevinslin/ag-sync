# Spec 3: Watch and Docs

## Objective and Scope

Add `ag-sync sync --watch`, finalize documentation, and perform full verification of the shipped CLI.

In scope:

- `sync --watch`
- debounce and pending-sync queue behavior
- README and development docs
- watch integration tests
- final verification command coverage

Out of scope:

- background daemonization
- OS-specific file-notification abstractions beyond chokidar defaults

## Required Pre-Read

- `design.md`
- `flows/asset-sync-lifecycle.md`
- `specs/spec-1-project-scaffold-and-init.md`
- `specs/spec-2-sync-engine.md`

## Implementation Plan

1. Extend the sync command with a `--watch` option.
2. Watch `ag-sync.json` and all configured source roots.
3. Debounce change bursts and serialize sync runs.
4. Add integration tests that mutate source fixtures and observe destination updates.
5. Update `README.md` and `docs/development.md` with usage and test workflows.
6. Run full verification via build, lint, and tests.

## Validation and Rollout

- `pnpm precommit`
- verify `ag-sync sync --watch` performs an initial sync and reacts to later changes
- verify docs match the shipped config fields and CLI syntax

## Dependencies and Risks

- Depends on Spec 2 for the core sync engine.
- Risk: watch-mode flakiness in tests; keep debounce small and use explicit polling in tests if needed.
- Risk: config reloads during watch could race with active syncs; queue one follow-up sync instead of starting concurrent runs.

## Status Checklist

- [x] Watch mode implemented
- [x] Watch integration tests passing
- [x] README updated
- [x] `docs/development.md` updated
- [x] Full verification complete

## Manual Notes

[keep this for the user to add notes. do not change between edits]

## Changelog
- 2026-03-09: Completed milestone 3 with passing watch coverage and precommit verification. (019cd020-285a-7ae3-a04d-4c067c7eb3a1)
- 2026-03-09: Added the execution-ready milestone spec for watch mode and documentation. (019cd020-285a-7ae3-a04d-4c067c7eb3a1)
