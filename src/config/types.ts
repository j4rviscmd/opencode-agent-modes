/**
 * Generic model configuration for any agent.
 *
 * This interface is intentionally flexible to support arbitrary
 * properties beyond just `model` and `variant`.
 */
export interface ModelConfig {
  model?: string
  variant?: string
  [key: string]: unknown
}

/**
 * Hierarchical preset structure supporting arbitrary nesting.
 *
 * This type recursively represents the configuration structure for
 * both opencode and oh-my-opencode, supporting any level of nesting
 * (e.g., agents/categories, future sections).
 *
 * Note: This type alias has a circular reference by design to support
 * recursive structures. The TypeScript compiler warning about this
 * can be safely ignored.
 */
// @ts-expect-error: Circular reference is intentional for recursive structure
export type HierarchicalPreset = Record<
  string,
  ModelConfig | HierarchicalPreset
>

/**
 * Mode preset containing configurations for both opencode and oh-my-opencode agents.
 *
 * Both opencode and oh-my-opencode use the same HierarchicalPreset type,
 * allowing them to have arbitrary nested structures that are handled
 * uniformly by recursive merge functions.
 */
export interface ModePreset {
  description: string
  model?: string
  opencode: HierarchicalPreset
  'oh-my-opencode': HierarchicalPreset
}

/**
 * Main configuration for the mode switcher plugin
 */
export interface ModeSwitcherConfig {
  currentMode: string
  showToastOnStartup: boolean
  presets: Record<string, ModePreset>
}

/**
 * OpenCode agent configuration structure in opencode.json
 *
 * @deprecated This type is kept for backward compatibility but may not
 * accurately represent the actual structure. Use ModelConfig directly.
 */
export interface OpencodeAgentConfig {
  model?: string
  mode?: string
  [key: string]: unknown
}

/**
 * OpenCode configuration file structure
 *
 * Supports arbitrary properties beyond the documented ones.
 */
export interface OpencodeConfig {
  model?: string
  agent?: HierarchicalPreset
  [key: string]: unknown
}

/**
 * Oh-my-opencode configuration file structure
 *
 * Supports arbitrary properties and nested structures like
 * agents, categories, and any future sections.
 */
export interface OhMyOpencodeConfig {
  [key: string]: unknown
}

/**
 * Default economy model for cost-efficient operations
 */
export const DEFAULT_ECONOMY_MODEL = 'opencode/glm-4.7-free'

/**
 * Configuration file paths
 */
export const CONFIG_PATHS = {
  pluginConfig: '~/.config/opencode/agent-mode-switcher.json',
  opencodeConfig: '~/.config/opencode/opencode.json',
  ohMyOpencodeConfig: '~/.config/opencode/oh-my-opencode.json',
} as const
