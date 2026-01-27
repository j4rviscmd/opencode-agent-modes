import type { OpencodeClient } from '@opencode-ai/sdk'
import { isObject } from '../config/guards.ts'
import { initializeConfig } from '../config/initializer.ts'
import {
  loadOhMyOpencodeConfig,
  loadOpencodeConfig,
  saveOhMyOpencodeConfig,
  saveOpencodeConfig,
  savePluginConfig,
} from '../config/loader.ts'
import type {
  HierarchicalPreset,
  ModePreset,
  ModeSwitcherConfig,
} from '../config/types.ts'

/**
 * Checks if a value is a leaf node (has a model field).
 *
 * A leaf node represents an actual agent configuration with a `model` field,
 * as opposed to a branch node which contains nested configurations.
 *
 * @param value - The object value to check
 * @returns True if the value has a string `model` property
 * @private
 */
function isLeafNode(value: Record<string, unknown>): boolean {
  return 'model' in value && typeof value.model === 'string'
}

/**
 * Recursively merges model settings from preset into target config.
 *
 * Traverses the hierarchical structure and updates model/variant
 * fields at leaf nodes while preserving all other properties.
 *
 * The merge strategy:
 * - Leaf nodes (with `model` field): Updates `model` and `variant` while preserving other properties
 * - Branch nodes: Recursively merges into nested structures
 * - Non-object values: Skipped
 *
 * @param target - The target configuration object to modify (in-place)
 * @param preset - The hierarchical preset containing model values to apply
 * @private
 */
function deepMergeModel(
  target: Record<string, unknown>,
  preset: HierarchicalPreset
): void {
  for (const [key, value] of Object.entries(preset)) {
    if (!isObject(value)) continue

    const actualValue = target[key]

    if (isLeafNode(value as Record<string, unknown>)) {
      const valueRecord = value as Record<string, unknown>
      const existing = (actualValue as Record<string, unknown>) ?? {}

      // Merge all preset properties (model, variant, and any future properties)
      // Existing properties are preserved, preset properties override/add them
      const merged: Record<string, unknown> = {
        ...existing,
        ...valueRecord,
      }

      target[key] = merged
    } else {
      const childTarget = (actualValue as Record<string, unknown>) ?? {}
      target[key] = childTarget
      deepMergeModel(childTarget, value as HierarchicalPreset)
    }
  }
}

/**
 * Recursively checks if actual configuration differs from expected preset.
 *
 * Drift is detected when any preset property differs from the actual config.
 * This includes model, variant, and any future properties.
 *
 * @param actual - The actual configuration to check
 * @param expected - The expected preset configuration
 * @returns True if any preset property differs from expected
 * @private
 */
function hasDriftRecursive(
  actual: Record<string, unknown>,
  expected: HierarchicalPreset
): boolean {
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (!isObject(expectedValue)) continue

    const actualValue = actual[key]

    if (isLeafNode(expectedValue as Record<string, unknown>)) {
      const actualObj = actualValue as Record<string, unknown> | undefined
      if (!actualObj) {
        // Actual config missing this leaf node - drift detected
        return true
      }

      // Check all properties in the expected preset
      for (const [propKey, expectedPropValue] of Object.entries(
        expectedValue as Record<string, unknown>
      )) {
        if (actualObj[propKey] !== expectedPropValue) {
          return true
        }
      }
    } else if (
      hasDriftRecursive(
        (actualValue || {}) as Record<string, unknown>,
        expectedValue as HierarchicalPreset
      )
    ) {
      return true
    }
  }

  return false
}

/**
 * Recursively formats hierarchical configuration as a tree string.
 *
 * Output format:
 * - Branch nodes: Display as `key:` with nested children indented
 * - Leaf nodes: Display as `key: model (variant) [otherProps]`
 *
 * @param preset - The hierarchical preset to format
 * @param indent - Indentation string for current depth (default: '  ')
 * @returns Multi-line string representation of the configuration tree
 * @private
 */
function formatHierarchicalTree(
  preset: HierarchicalPreset,
  indent = '  '
): string {
  const lines: string[] = []

  for (const [key, value] of Object.entries(preset)) {
    if (!isObject(value)) continue

    if (isLeafNode(value as Record<string, unknown>)) {
      const variant = value.variant ? ` (${value.variant})` : ''
      const otherProps = Object.keys(value)
        .filter((k) => k !== 'model' && k !== 'variant')
        .map((k) => `${k}: ${JSON.stringify(value[k])}`)
        .join(', ')
      const extra = otherProps ? ` [${otherProps}]` : ''
      lines.push(`${indent}${key}: ${value.model}${variant}${extra}`)
    } else {
      lines.push(`${indent}${key}:`)
      lines.push(
        formatHierarchicalTree(value as HierarchicalPreset, `${indent}  `)
      )
    }
  }

  return lines.join('\n')
}

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
    await this.applyCurrentModeIfNeeded()
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
   * Checks if actual config files have drifted from the current
   * mode preset and applies the preset if needed.
   *
   * This handles the case where a user manually edits
   * `agent-mode-switcher.json` to change `currentMode` while
   * OpenCode is not running. On next startup, the actual config
   * files are updated to match the expected preset values,
   * and a toast notification prompts the user to restart.
   *
   * @private
   */
  private async applyCurrentModeIfNeeded(): Promise<void> {
    if (!this.config) {
      return
    }

    const preset = this.config.presets[this.config.currentMode]
    if (!preset) {
      return
    }

    const drifted = await this.hasConfigDrift(preset)
    if (!drifted) {
      return
    }

    // Apply the preset to actual config files
    await this.updateOpencodeConfig(preset.model, preset.opencode)
    await this.updateOhMyOpencodeConfig(preset['oh-my-opencode'])

    // Notify user to restart (fire-and-forget to avoid blocking
    // plugin initialization when UI is not yet ready).
    // TODO: Currently toast is likely not displayed because UI is
    // not initialized at this point. To reliably show the toast,
    // use setTimeout for delayed execution or an onReady lifecycle
    // hook if OpenCode adds one in the future.
    this.client.tui
      .showToast({
        body: {
          title: 'Mode Applied',
          message: `Applied "${this.config.currentMode}" mode. Restart opencode to take effect.`,
          variant: 'warning',
          duration: 5000,
        },
      })
      .catch(() => {
        // Toast might not be available during early initialization
      })
  }

  /**
   * Compares a mode preset against the actual opencode.json and
   * oh-my-opencode.json files to detect configuration drift.
   *
   * Checks global model and per-agent model values recursively. Returns true
   * if any expected value differs from the actual file content.
   *
   * @param preset - The mode preset to compare against
   * @returns True if actual configs differ from the preset
   * @private
   */
  private async hasConfigDrift(preset: ModePreset): Promise<boolean> {
    const opencodeConfig = await loadOpencodeConfig()
    const ohMyConfig = await loadOhMyOpencodeConfig()

    // Early return if no configs to check (no drift if nothing exists)
    if (!opencodeConfig && !ohMyConfig) {
      return false
    }

    // Check global model in opencode.json
    if (preset.model && opencodeConfig?.model !== preset.model) {
      return true
    }

    // Check opencode agents: recursively check
    if (
      opencodeConfig?.agent &&
      hasDriftRecursive(
        opencodeConfig.agent as Record<string, unknown>,
        preset.opencode
      )
    ) {
      return true
    }

    // Check oh-my-opencode: recursively check
    if (
      ohMyConfig &&
      hasDriftRecursive(
        ohMyConfig as Record<string, unknown>,
        preset['oh-my-opencode']
      )
    ) {
      return true
    }

    return false
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
   * - Hierarchical tree of OpenCode configuration
   * - Hierarchical tree of oh-my-opencode configuration
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
   * // OpenCode config:
   * //   agent:
   * //     build: anthropic/claude-sonnet-4
   * //     plan: anthropic/claude-sonnet-4
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

    // opencode: recursively format tree
    const opencodeTree = formatHierarchicalTree(preset.opencode)

    // oh-my-opencode: recursively format tree
    const ohMyOpencodeTree = formatHierarchicalTree(preset['oh-my-opencode'])

    return [
      `Current mode: ${currentMode}`,
      `Description: ${preset.description}`,
      globalModel,
      '',
      'OpenCode config:',
      opencodeTree || '  (none configured)',
      '',
      'Oh-my-opencode config:',
      ohMyOpencodeTree || '  (none configured)',
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

    // 4. Show toast notification (fire-and-forget - toast might not be available)
    this.client.tui
      .showToast({
        body: {
          title: 'Mode Switched',
          message: `Switched to "${modeName}". Restart opencode to apply.`,
          variant: 'warning',
          duration: 5000,
        },
      })
      .catch(() => {})

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
   * and only updates model-related fields using recursive merge.
   *
   * @param globalModel - Global model setting (optional). If provided, sets the top-level "model" field
   * @param agentPresets - Hierarchical preset structure for agent configuration
   * @returns Promise resolving to result status: "updated", "skipped (not found)", or "error: ..."
   * @private
   */
  private async updateOpencodeConfig(
    globalModel: string | undefined,
    agentPresets: HierarchicalPreset
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

      // Agent section: recursively merge preset into existing config
      opencodeConfig.agent = opencodeConfig.agent || {}
      deepMergeModel(
        opencodeConfig.agent as Record<string, unknown>,
        agentPresets
      )

      await saveOpencodeConfig(opencodeConfig)
      return 'updated'
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return `error: ${message}`
    }
  }

  /**
   * Updates oh-my-opencode.json with preset values.
   *
   * This internal method modifies the oh-my-opencode configuration file
   * to apply the new preset's settings using recursive merge. The entire
   * structure (agents, categories, etc.) is updated while preserving
   * other properties.
   *
   * @param preset - Hierarchical preset structure for oh-my-opencode configuration
   * @returns Promise resolving to result status: "updated", "skipped (not found)", or "error: ..."
   * @private
   */
  private async updateOhMyOpencodeConfig(
    preset: HierarchicalPreset
  ): Promise<string> {
    try {
      const ohMyConfig = await loadOhMyOpencodeConfig()

      if (!ohMyConfig) {
        return 'skipped (not found)'
      }

      // Recursively merge preset into existing config
      deepMergeModel(ohMyConfig as Record<string, unknown>, preset)

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
