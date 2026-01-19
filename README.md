# opencode-agent-modes

[![npm license](https://img.shields.io/npm/l/opencode-agent-modes?logo=npm&logoColor=fff)](https://www.npmjs.com/package/opencode-agent-modes)
[![npm downloads](https://img.shields.io/npm/dt/opencode-agent-modes?logo=npm&logoColor=fff)](https://www.npmjs.com/package/opencode-agent-modes)
[![npm version](https://img.shields.io/npm/v/opencode-agent-modes?logo=npm&logoColor=fff)](https://www.npmjs.com/package/opencode-agent-modes)
![OpenCode Plugin](https://img.shields.io/badge/OpenCode-Plugin-4c8bf5)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=fff)

OpenCode plugin to switch agent models between performance and economy modes.

> [!NOTE]
> **Primary Use Case**: When approaching your token limit, switch to
> pre-defined economy models to extend your session until your quota resets.
> Changes take effect after restarting opencode.

## Features

- Switch between different model presets (performance, economy, or custom)
- Configurable presets with user-defined models
- Toast notifications for mode changes

### Supported Agents

|      Agent Type       |                                           Description                                           |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| opencode agents       | Standard agents (`build`, `plan`, etc.)                                                         |
| oh-my-opencode agents | Optional - applies if [oh-my-opencode](https://github.com/pekepeke/oh-my-opencode) is installed |

## Installation

Add the plugin to your `opencode.json`:

```json
{
  "plugin": ["opencode-agent-modes@latest"]
}
```

The following command files are automatically copied to
`~/.config/opencode/command/` on installation:

- `mode-performance.md`
- `mode-economy.md`
- `mode-status.md`
- `mode-list.md`

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

> [!TIP]
> The `oh-my-opencode` section is optional. Omit it if you don't use oh-my-opencode.

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

## Custom Presets

To add a custom preset (e.g., "premium"):

1. Add the preset to `~/.config/opencode/agent-mode-switcher.json`:

   ```json
   {
     "presets": {
       "premium": {
         "description": "High-end models for critical tasks",
         "opencode": {
           "build": { "model": "anthropic/claude-opus-4-5-20251101" }
         }
       }
     }
   }
   ```

2. Create a command file at `~/.config/opencode/command/mode-premium.md`:

   ```md
   ---
   description: "Switch to premium mode (high-end models)"
   ---

   Use mode_switch tool to switch agent mode to "premium".
   ```

3. Restart opencode to apply changes.

## Notes

- Changes require an opencode restart to take effect
- Custom mode presets can be added by editing the configuration file
