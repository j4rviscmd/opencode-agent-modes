/**
 * @fileoverview OpenCode Agent Mode Switcher Plugin.
 *
 * This plugin provides tools for managing agent mode presets in OpenCode.
 * It allows users to switch between different configurations (e.g., performance
 * vs economy modes) that determine which AI models are used for each agent type.
 *
 * @module index
 */

import { tool } from '@opencode-ai/plugin'
import type { Plugin } from '@opencode-ai/plugin'
import { copyCommandFiles } from './config/index.ts'
import { ModeManager } from './modes/index.ts'

/**
 * OpenCode Agent Mode Switcher Plugin.
 *
 * Provides tools for switching between agent mode presets (e.g., performance
 * vs economy) that configure which AI models are used for each agent type.
 * The plugin initializes on startup by loading configurations and copying
 * slash command files to the OpenCode command directory.
 *
 * @param params - Plugin initialization parameters
 * @param params.client - OpenCode client for SDK interactions
 * @returns Plugin object containing mode management tools
 *
 * @example
 * ```typescript
 * // Plugin is automatically loaded by OpenCode
 * // Users can then use slash commands:
 * // /mode-performance
 * // /mode-economy
 * // /mode-status
 * // /mode-list
 * ```
 */
const modeSwitcherPlugin: Plugin = async ({ client }) => {
  const modeManager = new ModeManager(client)

  // Initialize on startup with error handling
  try {
    await modeManager.initialize()
    // Copy slash command files to ~/.config/opencode/command/
    copyCommandFiles()
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
       * Switch to a different agent mode preset.
       *
       * Updates the active mode configuration and applies it to both
       * opencode.json and oh-my-opencode.json files. The mode preset
       * determines which AI models are assigned to each agent type.
       *
       * @param args.mode - Name of the mode preset to switch to (e.g., "performance", "economy")
       * @returns Success or error message with details about the mode switch operation
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
       * Display current agent mode and its configuration.
       *
       * Shows the currently active mode preset and the AI model assignments
       * for all agent types in both OpenCode and Oh My OpenCode configurations.
       *
       * @returns Current mode name and detailed configuration information
       */
      mode_status: tool({
        description: 'Show current agent mode and its configuration',
        args: {},
        async execute() {
          return await modeManager.getStatus()
        },
      }),

      /**
       * List all available mode presets.
       *
       * Returns a list of all configured mode presets with their names
       * and AI model assignments for each agent type. This helps users
       * understand what modes are available for switching.
       *
       * @returns Array of mode preset names and their configurations
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
