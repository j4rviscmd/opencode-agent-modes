# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project Overview

OpenCode plugin for switching agent model presets between performance and
economy modes. Modifies `opencode.json` and `oh-my-opencode.json` configuration
files to change which AI models are used.

## Commands

```bash
# Type checking
bun run typecheck

# Build
bun run build

# Lint
bun run lint

# Format
bun run format

# Test
bun test
bun test --watch
bun test --coverage
```

## Architecture

```text
src/
├── index.ts                    # Plugin entry point, tool definitions
├── config/
│   ├── index.ts                # Barrel export
│   ├── types.ts                # Type definitions and constants
│   ├── loader.ts               # JSON file I/O utilities
│   ├── loader.test.ts          # Unit tests for loader
│   ├── initializer.ts          # Initial config generation
│   └── initializer.test.ts     # Unit tests for initializer
├── modes/
│   ├── index.ts                # Barrel export
│   ├── manager.ts              # Mode switching logic
│   └── manager.test.ts         # Unit tests for manager
└── test-utils/
    └── mocks.ts                # Shared test mocks

scripts/
└── postinstall.ts              # npm postinstall script

commands/
├── mode-economy.md             # /mode-economy slash command
├── mode-performance.md         # /mode-performance slash command
├── mode-list.md                # /mode-list slash command
└── mode-status.md              # /mode-status slash command
```

### Key Components

- **Plugin Entry** (`src/index.ts`): Exports OpenCode plugin with three tools:
  `mode_switch`, `mode_status`, `mode_list`

- **ModeManager** (`src/modes/manager.ts`): Core class handling mode switching.
  Updates three config files:
  - `~/.config/opencode/agent-mode-switcher.json` (plugin state)
  - `~/.config/opencode/opencode.json` (opencode agents)
  - `~/.config/opencode/oh-my-opencode.json` (oh-my-opencode agents)

- **Config Initializer** (`src/config/initializer.ts`): On first run, reads
  current models from existing configs to build "performance" preset, creates
  "economy" preset with `opencode/glm-4.7-free`

- **Slash Commands** (`commands/`): User-invocable commands for mode switching

### Plugin API

Uses `@opencode-ai/plugin` for tool definitions and `@opencode-ai/sdk` for
client interactions (toast notifications).

## Bun Runtime

Default to Bun instead of Node.js:

- `bun <file>` instead of `node <file>`
- `bun test` instead of jest/vitest
- `Bun.file()` for file I/O
- Bun automatically loads `.env`
