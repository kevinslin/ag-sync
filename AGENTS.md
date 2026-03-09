# AGENTS

## Workon Bootstrap Guidance

- Use `$ag-dir` first to understand the AGD project layout.
- Update `memory.md` when durable project facts, decisions, or constraints change.
- Read `$dev.research`, choose the appropriate doc type, and create or update relevant docs when context gathering or planning work requires it.
- Set `ROOT_DIR` to this project directory for project-local work.
- Read `progress.md` first to understand current project status.
- Use `$ag-ledger` to inspect the last 24 hours of workspace activity when resuming context.
- Read relevant `.agents/runs/spec-{num}-progress.md` and `.agents/runs/spec-{num}-learnings.md` files when continuing spec work.
- Log session activity via the global `$ag-ledger` workflow.

## Planloop Project Conventions

- Treat `design.md` as the canonical project plan and workflow-state document.
- Write milestone specs to `specs/spec-{num}-{milestone}.md`.
- Use `flows/{topic}.md` for supporting flow docs when complex behavior needs extra documentation.
- Reserve `config.md` for actual product or runtime configuration (for example Statsig), not project workflow state.
- Keep `design.md` updated with `Workflow Status` and `Next Active Item`.
- Pause for user input after Refine Design before generating specs.
- Run planloop in non-interactive mode when the user explicitly requests end-to-end execution without pauses.
