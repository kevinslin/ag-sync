# Memory

## Durable Facts

- Project name: `ag-sync`
- Primary goal: sync Codex agent assets, excluding skills for now.
- Config file: `ag-sync.json`
- Asset families:
  - `agents` for file-based agent definitions
  - `automations` for directory-based automation bundles
- Default local source roots:
  - `./agents`
  - `./automations`
- Default destination roots:
  - `~/.codex/agents`
  - `~/.codex/automations`
- `init` bootstraps the repo by copying live Codex assets into the local source roots.
- `sync` is one-way from configured source roots to configured destination roots.
- Global `denyList` patterns apply to both asset families.
