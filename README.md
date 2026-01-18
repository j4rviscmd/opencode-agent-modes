# opencode-agent-modes

OpenCode plugin to switch agent models between performance and economy modes.

> [!NOTE]
> **Primary Use Case**: When approaching your token limit, quickly switch to
> pre-defined economy models to extend your session until your quota resets.

## Features

- Switch between different model presets (performance, economy, or custom)
- Automatically applies settings to both opencode agents and oh-my-opencode agents
- Configurable presets with user-defined models
- Toast notifications for mode changes

## Installation

### 1. Add the plugin to your opencode.json

```json
{
  "plugin": [
    "file:///path/to/opencode-agent-modes/src/index.ts"
  ]
}
```

### 2. Copy command files (optional)

Copy the command files to enable Ctrl+P access:

```bash
cp commands/*.md ~/.config/opencode/command/
```

## Usage

### Available Commands

- `/mode-performance` - Switch to high-performance models
- `/mode-economy` - Switch to cost-efficient free models
- `/mode-status` - Show current mode and configuration
- `/mode-list` - List all available mode presets

### Available Tools

- `mode_switch` - Switch to a specified mode preset
- `mode_status` - Display current mode settings
- `mode_list` - List all available presets

## Configuration

The plugin configuration is stored at `~/.config/opencode/agent-mode-switcher.json`.

On first run, the plugin automatically generates this file by:

1. Reading current models from `opencode.json` for the "performance" preset
2. Setting `opencode/glm-4.7-free` for the "economy" preset

### Example Configuration

```json
{
  "currentMode": "performance",
  "showToastOnStartup": true,
  "presets": {
    "performance": {
      "description": "High-performance models for complex tasks",
      "opencode": {
        "build": { "model": "github-copilot/gpt-5.2" },
        "plan": { "model": "github-copilot/gpt-5.2" }
      },
      "oh-my-opencode": {
        "Sisyphus": { "model": "anthropic/claude-opus-4-5-20251101" }
      }
    },
    "economy": {
      "description": "Cost-efficient free model for routine tasks",
      "opencode": {
        "build": { "model": "opencode/glm-4.7-free" }
      },
      "oh-my-opencode": {
        "Sisyphus": { "model": "opencode/glm-4.7-free" }
      }
    }
  }
}
```

### Model Priority

When both global `model` and agent-specific `opencode` settings are configured,
the priority is:

```text
agent.<name>.model > model (global)
```

Agent-specific settings override the global model setting.

## Notes

- Changes to oh-my-opencode agents require an opencode restart to take effect
- Custom mode presets can be added by editing the configuration file
