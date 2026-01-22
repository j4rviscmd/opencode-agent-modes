import {
  loadOhMyOpencodeConfig,
  loadOpencodeConfig,
  loadPluginConfig,
  pluginConfigExists,
  savePluginConfig,
} from './loader.ts'
import type { AgentPreset, ModePreset, ModeSwitcherConfig } from './types.ts'
import { DEFAULT_ECONOMY_MODEL } from './types.ts'

/**
 * Default opencode agent names.
 *
 * These are the standard agents used by OpenCode for various tasks.
 *
 * @constant
 */
const OPENCODE_AGENTS = [
  'build',
  'plan',
  'summary',
  'compaction',
  'title',
  'explore',
  'general',
] as const

/**
 * Builds a performance preset from existing OpenCode configurations.
 *
 * This function scans the current `opencode.json` and `oh-my-opencode.json`
 * files to extract the currently configured models for each agent. These
 * models are saved as the "performance" preset, preserving the user's
 * high-performance model choices.
 *
 * @returns Promise resolving to a ModePreset with performance-oriented models
 * @example
 * ```typescript
 * const preset = await buildPerformancePreset();
 * console.log(preset.opencode.build.model); // "anthropic/claude-sonnet-4"
 * ```
 */
async function buildPerformancePreset(): Promise<ModePreset> {
  const opencodeConfig = await loadOpencodeConfig()
  const ohMyOpencodeConfig = await loadOhMyOpencodeConfig()

  const opencodePreset: Record<string, AgentPreset> = {}
  const ohMyOpencodePreset: Record<string, AgentPreset> = {}

  // Extract opencode agent settings
  if (opencodeConfig?.agent) {
    for (const agentName of OPENCODE_AGENTS) {
      const agentConfig = opencodeConfig.agent[agentName]
      if (agentConfig?.model) {
        opencodePreset[agentName] = { model: agentConfig.model }
      }
    }
  }

  // Extract oh-my-opencode agent settings
  if (ohMyOpencodeConfig?.agents) {
    for (const [agentName, agentConfig] of Object.entries(
      ohMyOpencodeConfig.agents
    )) {
      if (agentConfig?.model) {
        ohMyOpencodePreset[agentName] = { model: agentConfig.model }
      }
    }
  }

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
 * `opencode/glm-4.7-free` model. This provides a budget-friendly
 * alternative to performance mode for routine tasks.
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

  const opencodePreset: Record<string, AgentPreset> = {}
  const ohMyOpencodePreset: Record<string, AgentPreset> = {}

  // Set economy model for all opencode agents
  if (opencodeConfig?.agent) {
    for (const agentName of Object.keys(opencodeConfig.agent)) {
      opencodePreset[agentName] = { model: DEFAULT_ECONOMY_MODEL }
    }
  } else {
    // Use default agent list if no config exists
    for (const agentName of OPENCODE_AGENTS) {
      opencodePreset[agentName] = { model: DEFAULT_ECONOMY_MODEL }
    }
  }

  // Set economy model for all oh-my-opencode agents
  if (ohMyOpencodeConfig?.agents) {
    for (const agentName of Object.keys(ohMyOpencodeConfig.agents)) {
      ohMyOpencodePreset[agentName] = { model: DEFAULT_ECONOMY_MODEL }
    }
  }

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
