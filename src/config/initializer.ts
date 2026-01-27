import {
  loadOhMyOpencodeConfig,
  loadOpencodeConfig,
  loadPluginConfig,
  pluginConfigExists,
  savePluginConfig,
} from './loader.ts'
import type {
  HierarchicalPreset,
  ModePreset,
  ModeSwitcherConfig,
} from './types.ts'
import { DEFAULT_ECONOMY_MODEL } from './types.ts'

/**
 * Type guard to check if a value is a plain object (not null, not array).
 *
 * @param obj - Value to check
 * @returns True if the value is a plain object
 */
function isObject(obj: unknown): obj is Record<string, unknown> {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj)
}

/**
 * Recursively applies the economy model to all agent configurations.
 *
 * This function traverses the hierarchical configuration structure and
 * updates any object with a `model` field to use the economy model.
 * Other properties are preserved.
 *
 * @param config - The configuration to update
 * @param economyModel - The economy model string to apply
 * @returns A new configuration with economy models applied
 */
function applyEconomyModel(
  config: HierarchicalPreset,
  economyModel: string
): HierarchicalPreset {
  const result: HierarchicalPreset = {}

  for (const [key, value] of Object.entries(config)) {
    if (isObject(value)) {
      if ('model' in value) {
        // Leaf node with model field: update model, preserve other properties
        result[key] = {
          ...value,
          model: economyModel,
        }
      } else {
        // Branch node: recurse
        result[key] = applyEconomyModel(
          value as HierarchicalPreset,
          economyModel
        )
      }
    } else {
      result[key] = value
    }
  }

  return result
}

/**
 * Builds a performance preset from existing OpenCode configurations.
 *
 * This function reads the current `opencode.json` and `oh-my-opencode.json`
 * files and preserves their entire structure as-is. The hierarchical
 * structure (agent, agents, categories, etc.) is maintained exactly.
 *
 * @returns Promise resolving to a ModePreset with performance-oriented models
 * @example
 * ```typescript
 * const preset = await buildPerformancePreset();
 * console.log(preset.opencode); // Full hierarchical structure
 * ```
 */
async function buildPerformancePreset(): Promise<ModePreset> {
  const opencodeConfig = await loadOpencodeConfig()
  const ohMyOpencodeConfig = await loadOhMyOpencodeConfig()

  // opencode: preserve the entire agent structure as-is
  const opencodePreset: HierarchicalPreset =
    (opencodeConfig?.agent as HierarchicalPreset) || {}

  // oh-my-opencode: preserve the entire structure as-is
  const ohMyOpencodePreset: HierarchicalPreset =
    (ohMyOpencodeConfig as HierarchicalPreset) || {}

  // Extract global model from opencode.json if present
  const globalModel = opencodeConfig?.model

  return {
    description: 'High-performance models for complex tasks',
    ...(globalModel && { model: globalModel }),
    opencode: opencodePreset,
    'oh-my-opencode': ohMyOpencodePreset,
  }
}

/**
 * Builds an economy preset using the default free model.
 *
 * This function creates a cost-efficient preset where all agents
 * (both OpenCode and oh-my-opencode) are configured to use the
 * `opencode/glm-4.7-free` model. The hierarchical structure is
 * preserved while model values are updated recursively.
 *
 * @returns Promise resolving to a ModePreset with economy-oriented models
 * @example
 * ```typescript
 * const preset = await buildEconomyPreset();
 * console.log(preset.model); // "opencode/glm-4.7-free"
 * ```
 */
async function buildEconomyPreset(): Promise<ModePreset> {
  const opencodeConfig = await loadOpencodeConfig()
  const ohMyOpencodeConfig = await loadOhMyOpencodeConfig()

  // opencode: preserve structure, update models recursively
  const opencodePreset = applyEconomyModel(
    (opencodeConfig?.agent as HierarchicalPreset) || {},
    DEFAULT_ECONOMY_MODEL
  )

  // oh-my-opencode: preserve structure, update models recursively
  const ohMyOpencodePreset = applyEconomyModel(
    (ohMyOpencodeConfig as HierarchicalPreset) || {},
    DEFAULT_ECONOMY_MODEL
  )

  return {
    description: 'Cost-efficient free model for routine tasks',
    model: DEFAULT_ECONOMY_MODEL,
    opencode: opencodePreset,
    'oh-my-opencode': ohMyOpencodePreset,
  }
}

/**
 * Initializes the plugin configuration if it doesn't exist.
 *
 * This function performs the following steps:
 * 1. Checks if a configuration file already exists
 * 2. If exists, loads and returns it
 * 3. If not, creates a new configuration by:
 *    - Building a performance preset from current settings
 *    - Building an economy preset with free models
 *    - Setting default mode to "performance"
 *    - Saving the configuration to disk
 *
 * This is called on plugin startup to ensure a valid configuration
 * is always available.
 *
 * @returns Promise resolving to the configuration (existing or newly created)
 * @throws {Error} If configuration creation or file I/O fails
 * @example
 * ```typescript
 * const config = await initializeConfig();
 * console.log(config.currentMode); // "performance"
 * ```
 */
export async function initializeConfig(): Promise<ModeSwitcherConfig> {
  const exists = await pluginConfigExists()
  if (exists) {
    // Config already exists, load it
    const config = await loadPluginConfig()
    if (config) {
      return config
    }
  }

  // Build initial configuration from existing settings
  const performancePreset = await buildPerformancePreset()
  const economyPreset = await buildEconomyPreset()

  const config: ModeSwitcherConfig = {
    currentMode: 'performance',
    showToastOnStartup: true,
    presets: {
      performance: performancePreset,
      economy: economyPreset,
    },
  }

  // Save the initial configuration
  await savePluginConfig(config)

  return config
}

/**
 * Validates that a configuration object is well-formed and has required presets.
 *
 * This function performs the following checks:
 * - `currentMode` field is present and non-empty
 * - `presets` object exists and contains at least one preset
 * - A preset exists for the current mode
 *
 * @param config - The configuration object to validate
 * @returns True if configuration is valid, false otherwise
 * @example
 * ```typescript
 * const config = await loadPluginConfig();
 * if (validateConfig(config)) {
 *   console.log('Configuration is valid');
 * } else {
 *   console.error('Invalid configuration detected');
 * }
 * ```
 */
export function validateConfig(config: ModeSwitcherConfig): boolean {
  if (!config.currentMode) {
    return false
  }
  if (!config.presets || Object.keys(config.presets).length === 0) {
    return false
  }
  return Boolean(config.presets[config.currentMode])
}
