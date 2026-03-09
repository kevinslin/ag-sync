# Development

## Commands

```sh
pnpm build
pnpm test -- import
pnpm test
pnpm lint
pnpm format
pnpm precommit
```

## Testing Notes

- Integration tests build the CLI and invoke `dist/cli.js`.
- Tests use a temporary workspace and temporary `HOME` directory so `~/.codex` paths stay isolated from the real machine state.
- `pnpm test -- import` runs the focused reverse-sync coverage for the `import` command.
- GitHub Actions runs `pnpm precommit` and then `git diff --exit-code` so formatting drift fails in CI instead of being silently rewritten.
- Watch-mode tests should run serially to avoid timing overlap.
- `sync --watch` uses polling in tests to reduce platform-specific file notification flakiness.
