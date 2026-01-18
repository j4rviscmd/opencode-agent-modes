/**
 * Agent preset configuration for a single agent
 */
export interface AgentPreset {
  model: string;
}

/**
 * Mode preset containing configurations for both opencode and oh-my-opencode agents
 */
export interface ModePreset {
  description: string;
  opencode: Record<string, AgentPreset>;
  "oh-my-opencode": Record<string, AgentPreset>;
}

/**
 * Main configuration for the mode switcher plugin
 */
export interface ModeSwitcherConfig {
  currentMode: string;
  showToastOnStartup: boolean;
  presets: Record<string, ModePreset>;
}

/**
 * OpenCode agent configuration structure in opencode.json
 */
export interface OpencodeAgentConfig {
  model?: string;
  mode?: string;
  [key: string]: unknown;
}

/**
 * OpenCode configuration file structure
 */
export interface OpencodeConfig {
  agent?: Record<string, OpencodeAgentConfig>;
  [key: string]: unknown;
}

/**
 * Oh-my-opencode configuration file structure
 */
export interface OhMyOpencodeConfig {
  agents?: Record<string, AgentPreset>;
  [key: string]: unknown;
}

/**
 * Default economy model for cost-efficient operations
 */
export const DEFAULT_ECONOMY_MODEL = "opencode/glm-4.7-free";

/**
 * Configuration file paths
 */
export const CONFIG_PATHS = {
  pluginConfig: "~/.config/opencode/agent-mode-switcher.json",
  opencodeConfig: "~/.config/opencode/opencode.json",
  ohMyOpencodeConfig: "~/.config/opencode/oh-my-opencode.json",
} as const;
