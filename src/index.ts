import { tool } from '@opencode-ai/plugin'
import type { Plugin } from '@opencode-ai/plugin'
import { ModeManager } from './modes/index.ts'

/**
 * OpenCode Agent Mode Switcher Plugin
 *
 * Allows switching between different agent mode presets (e.g., performance vs economy)
 * that configure which AI models are used for each agent type.
 */
const modeSwitcherPlugin: Plugin = async ({ client }) => {
  const modeManager = new ModeManager(client)

  // Initialize on startup with error handling
  try {
    await modeManager.initialize()
  } catch (error) {
    // Log error but don't block opencode startup
    console.error(
      '[agent-mode-switcher] Failed to initialize:',
      error instanceof Error ? error.message : String(error)
    )
  }

  return {
    tool: {
      /**
       * Switch to a different agent mode preset
       */
      mode_switch: tool({
        description: 'Switch agent mode to a specified preset',
        args: {
          mode: tool.schema
            .string()
            .describe('Name of the mode preset to switch to'),
        },
        async execute({ mode }) {
          return await modeManager.switchMode(mode)
        },
      }),

      /**
       * Display current agent mode and configuration
       */
      mode_status: tool({
        description: 'Show current agent mode and its configuration',
        args: {},
        async execute() {
          return await modeManager.getStatus()
        },
      }),

      /**
       * List all available mode presets
       */
      mode_list: tool({
        description: 'List all available mode presets',
        args: {},
        async execute() {
          return await modeManager.listModes()
        },
      }),
    },
  }
}

export default modeSwitcherPlugin
