import type { OpencodeClient } from '@opencode-ai/sdk'
import { initializeConfig } from '../config/initializer.ts'
import {
  loadOhMyOpencodeConfig,
  loadOpencodeConfig,
  saveOhMyOpencodeConfig,
  saveOpencodeConfig,
  savePluginConfig,
} from '../config/loader.ts'
import type { ModePreset, ModeSwitcherConfig } from '../config/types.ts'

/**
 * Manages agent mode switching between different presets.
 *
 * This class provides the core functionality for switching between
 * performance and economy modes (or custom presets). It handles:
 * - Loading and managing plugin configuration
 * - Switching between different model presets
 * - Updating OpenCode configuration files
 * - Providing status and listing available modes
 *
 * The manager updates three configuration files when switching modes:
 * - `~/.config/opencode/agent-mode-switcher.json` (plugin state)
 * - `~/.config/opencode/opencode.json` (OpenCode agents)
 * - `~/.config/opencode/oh-my-opencode.json` (oh-my-opencode agents)
 *
 * @example
 * ```typescript
 * const manager = new ModeManager(client);
 * await manager.initialize();
 *
 * // Switch to economy mode
 * const result = await manager.switchMode('economy');
 * console.log(result);
 *
 * // Get current status
 * const status = await manager.getStatus();
 * console.log(status);
 * ```
 */
export class ModeManager {
  private config: ModeSwitcherConfig | null = null

  constructor(private readonly client: OpencodeClient) {}

  /**
   * Initializes the mode manager and loads configuration.
   *
   * This method should be called before using any other manager methods.
   * It loads or creates the plugin configuration file, ensuring all
   * required presets are available.
   *
   * @throws {Error} If configuration initialization fails
   * @example
   * ```typescript
   * const manager = new ModeManager(client);
   * await manager.initialize();
   * ```
   */
  async initialize(): Promise<void> {
    this.config = await initializeConfig()
  }

  /**
   * Ensures configuration is loaded before any operation.
   *
   * This internal method is called by all public methods to lazily
   * initialize the configuration if it hasn't been loaded yet.
   *
   * @returns Promise resolving to the loaded configuration
   * @throws {Error} If configuration loading fails
   * @private
   */
  private async ensureConfig(): Promise<ModeSwitcherConfig> {
    if (!this.config) {
      this.config = await initializeConfig()
    }
    return this.config
  }

  /**
   * Gets the name of the currently active mode.
   *
   * @returns Promise resolving to the current mode name (e.g., "performance", "economy")
   * @example
   * ```typescript
   * const currentMode = await manager.getCurrentMode();
   * console.log(`Current mode: ${currentMode}`);
   * ```
   */
  async getCurrentMode(): Promise<string> {
    const config = await this.ensureConfig()
    return config.currentMode
  }

  /**
   * Gets a specific mode preset by name.
   *
   * @param modeName - The name of the mode to retrieve (e.g., "performance", "economy")
   * @returns Promise resolving to the preset configuration, or undefined if not found
   * @example
   * ```typescript
   * const preset = await manager.getPreset('economy');
   * if (preset) {
   *   console.log(preset.description);
   *   console.log(preset.model);
   * }
   * ```
   */
  async getPreset(modeName: string): Promise<ModePreset | undefined> {
    const config = await this.ensureConfig()
    return config.presets[modeName]
  }

  /**
   * Gets a formatted list of all available modes.
   *
   * Returns a multi-line string listing each mode with its description,
   * marking the currently active mode with "(current)".
   *
   * @returns Promise resolving to formatted string listing all available modes
   * @example
   * ```typescript
   * const list = await manager.listModes();
   * console.log(list);
   * // Output:
   * // Available modes:
   * // - performance (current): High-performance models for complex tasks
   * // - economy: Cost-efficient free model for routine tasks
   * ```
   */
  async listModes(): Promise<string> {
    const config = await this.ensureConfig()
    const currentMode = config.currentMode
    const modes = Object.entries(config.presets)
      .map(([name, preset]) => {
        const marker = name === currentMode ? ' (current)' : ''
        return `- ${name}${marker}: ${preset.description}`
      })
      .join('\n')

    return `Available modes:\n${modes}`
  }

  /**
   * Gets detailed status information for the current mode.
   *
   * Returns a formatted multi-line string showing:
   * - Current mode name and description
   * - Global model setting (if configured)
   * - All OpenCode agents and their assigned models
   * - All oh-my-opencode agents and their assigned models
   *
   * @returns Promise resolving to formatted status string
   * @example
   * ```typescript
   * const status = await manager.getStatus();
   * console.log(status);
   * // Output:
   * // Current mode: performance
   * // Description: High-performance models for complex tasks
   * // Global model: (not set)
   * //
   * // OpenCode agents:
   * //   - build: anthropic/claude-sonnet-4
   * //   - plan: anthropic/claude-sonnet-4
   * // ...
   * ```
   */
  async getStatus(): Promise<string> {
    const config = await this.ensureConfig()
    const currentMode = config.currentMode
    const preset = config.presets[currentMode]

    if (!preset) {
      return `Current mode: ${currentMode} (preset not found)`
    }

    const globalModel = preset.model
      ? `Global model: ${preset.model}`
      : 'Global model: (not set)'

    const opencodeAgents = Object.entries(preset.opencode)
      .map(([name, cfg]) => `  - ${name}: ${cfg.model}`)
      .join('\n')

    const ohMyOpencodeAgents = Object.entries(preset['oh-my-opencode'])
      .map(([name, cfg]) => `  - ${name}: ${cfg.model}`)
      .join('\n')

    return [
      `Current mode: ${currentMode}`,
      `Description: ${preset.description}`,
      globalModel,
      '',
      'OpenCode agents:',
      opencodeAgents || '  (none configured)',
      '',
      'Oh-my-opencode agents:',
      ohMyOpencodeAgents || '  (none configured)',
    ].join('\n')
  }

  /**
   * Switches to a different mode by updating all configuration files.
   *
   * This method performs the following operations:
   * 1. Validates that the requested mode exists
   * 2. Updates `opencode.json` with new global model and agent settings
   * 3. Updates `oh-my-opencode.json` with new agent settings
   * 4. Updates `agent-mode-switcher.json` with the new current mode
   * 5. Shows a toast notification (if available)
   *
   * Configuration files that don't exist are skipped with a warning.
   * Changes take effect after restarting OpenCode.
   *
   * @param modeName - The name of the mode to switch to
   * @returns Promise resolving to a formatted result message with status of each config update
   * @example
   * ```typescript
   * const result = await manager.switchMode('economy');
   * console.log(result);
   * // Output:
   * // Switched to economy mode
   * // Cost-efficient free model for routine tasks
   * //
   * // Results:
   * //   - opencode.json: updated
   * //   - oh-my-opencode.json: updated
   * //   - agent-mode-switcher.json: updated
   * //
   * // Note: Restart opencode to apply changes.
   * ```
   */
  async switchMode(modeName: string): Promise<string> {
    const config = await this.ensureConfig()
    const preset = config.presets[modeName]

    if (!preset) {
      const available = Object.keys(config.presets).join(', ')
      return `Mode "${modeName}" not found. Available modes: ${available}`
    }

    const results: string[] = []

    // 1. Update opencode.json (global model and agent section)
    const opencodeResult = await this.updateOpencodeConfig(
      preset.model,
      preset.opencode
    )
    results.push(`opencode.json: ${opencodeResult}`)

    // 2. Update oh-my-opencode.json directly (agents section only)
    const ohMyResult = await this.updateOhMyOpencodeConfig(
      preset['oh-my-opencode']
    )
    results.push(`oh-my-opencode.json: ${ohMyResult}`)

    // 3. Update plugin configuration
    config.currentMode = modeName
    this.config = config
    await savePluginConfig(config)
    results.push('agent-mode-switcher.json: updated')

    // 4. Show toast notification
    try {
      await this.client.tui.showToast({
        body: {
          title: 'Mode Switched',
          message: `Switched to "${modeName}". Restart opencode to apply.`,
          variant: 'warning',
          duration: 5000,
        },
      })
    } catch {
      // Toast might not be available in all contexts
    }

    return [
      `Switched to ${modeName} mode`,
      preset.description,
      '',
      'Results:',
      ...results.map((r) => `  - ${r}`),
      '',
      'Note: Restart opencode to apply changes.',
    ].join('\n')
  }

  /**
   * Updates opencode.json with global model and agent section.
   *
   * This internal method modifies the OpenCode configuration file to apply
   * the new preset's settings. It preserves other configuration properties
   * and only updates model-related fields.
   *
   * @param globalModel - Global model setting (optional). If provided, sets the top-level "model" field
   * @param agentPresets - Agent-specific model settings. Keys are agent names, values contain model strings
   * @returns Promise resolving to result status: "updated", "skipped (not found)", or "error: ..."
   * @private
   */
  private async updateOpencodeConfig(
    globalModel: string | undefined,
    agentPresets: Record<string, { model: string }>
  ): Promise<string> {
    try {
      const opencodeConfig = await loadOpencodeConfig()

      if (!opencodeConfig) {
        return 'skipped (not found)'
      }

      // Update global model if specified
      if (globalModel) {
        opencodeConfig.model = globalModel
      }

      // Update agent section (preserve other settings)
      if (Object.keys(agentPresets).length > 0) {
        opencodeConfig.agent = opencodeConfig.agent || {}
        for (const [agentName, preset] of Object.entries(agentPresets)) {
          opencodeConfig.agent[agentName] = {
            ...opencodeConfig.agent[agentName],
            model: preset.model,
          }
        }
      }

      await saveOpencodeConfig(opencodeConfig)
      return 'updated'
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return `error: ${message}`
    }
  }

  /**
   * Updates oh-my-opencode.json agents section with preset values.
   *
   * This internal method modifies the oh-my-opencode configuration file
   * to apply the new preset's agent settings. Unlike opencode.json, this
   * only updates the agents section and doesn't set a global model.
   *
   * @param agentPresets - Agent-specific model settings. Keys are agent names, values contain model strings
   * @returns Promise resolving to result status: "updated", "skipped (not found)", or "error: ..."
   * @private
   */
  private async updateOhMyOpencodeConfig(
    agentPresets: Record<string, { model: string }>
  ): Promise<string> {
    try {
      const ohMyConfig = await loadOhMyOpencodeConfig()

      if (!ohMyConfig) {
        return 'skipped (not found)'
      }

      // Update agents section only (preserve other settings)
      ohMyConfig.agents = ohMyConfig.agents || {}
      for (const [agentName, preset] of Object.entries(agentPresets)) {
        ohMyConfig.agents[agentName] = { model: preset.model }
      }

      await saveOhMyOpencodeConfig(ohMyConfig)
      return 'updated'
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return `error: ${message}`
    }
  }

  /**
   * Checks if a toast notification should be shown on plugin startup.
   *
   * This is controlled by the `showToastOnStartup` configuration flag,
   * which can be useful for reminding users of the current mode when
   * OpenCode starts.
   *
   * @returns Promise resolving to true if toast should be shown, false otherwise
   * @example
   * ```typescript
   * if (await manager.shouldShowToastOnStartup()) {
   *   const mode = await manager.getCurrentMode();
   *   await client.tui.showToast({
   *     body: { message: `Current mode: ${mode}` }
   *   });
   * }
   * ```
   */
  async shouldShowToastOnStartup(): Promise<boolean> {
    const config = await this.ensureConfig()
    return config.showToastOnStartup
  }
}
