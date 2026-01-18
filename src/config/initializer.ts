import type {
  ModeSwitcherConfig,
  ModePreset,
  AgentPreset,
} from "./types.ts";
import {
  DEFAULT_ECONOMY_MODEL,
} from "./types.ts";
import {
  loadOpencodeConfig,
  loadOhMyOpencodeConfig,
  loadPluginConfig,
  savePluginConfig,
  pluginConfigExists,
} from "./loader.ts";

/**
 * Default opencode agent names
 */
const OPENCODE_AGENTS = [
  "build",
  "plan",
  "summary",
  "compaction",
  "title",
  "explore",
  "general",
] as const;

/**
 * Build a preset from existing configurations
 */
async function buildPerformancePreset(): Promise<ModePreset> {
  const opencodeConfig = await loadOpencodeConfig();
  const ohMyOpencodeConfig = await loadOhMyOpencodeConfig();

  const opencodePreset: Record<string, AgentPreset> = {};
  const ohMyOpencodePreset: Record<string, AgentPreset> = {};

  // Extract opencode agent settings
  if (opencodeConfig?.agent) {
    for (const agentName of OPENCODE_AGENTS) {
      const agentConfig = opencodeConfig.agent[agentName];
      if (agentConfig?.model) {
        opencodePreset[agentName] = { model: agentConfig.model };
      }
    }
  }

  // Extract oh-my-opencode agent settings
  if (ohMyOpencodeConfig?.agents) {
    for (const [agentName, agentConfig] of Object.entries(
      ohMyOpencodeConfig.agents
    )) {
      if (agentConfig?.model) {
        ohMyOpencodePreset[agentName] = { model: agentConfig.model };
      }
    }
  }

  return {
    description: "High-performance models for complex tasks",
    opencode: opencodePreset,
    "oh-my-opencode": ohMyOpencodePreset,
  };
}

/**
 * Build economy preset with free model
 */
async function buildEconomyPreset(): Promise<ModePreset> {
  const opencodeConfig = await loadOpencodeConfig();
  const ohMyOpencodeConfig = await loadOhMyOpencodeConfig();

  const opencodePreset: Record<string, AgentPreset> = {};
  const ohMyOpencodePreset: Record<string, AgentPreset> = {};

  // Set economy model for all opencode agents
  if (opencodeConfig?.agent) {
    for (const agentName of Object.keys(opencodeConfig.agent)) {
      opencodePreset[agentName] = { model: DEFAULT_ECONOMY_MODEL };
    }
  } else {
    // Use default agent list if no config exists
    for (const agentName of OPENCODE_AGENTS) {
      opencodePreset[agentName] = { model: DEFAULT_ECONOMY_MODEL };
    }
  }

  // Set economy model for all oh-my-opencode agents
  if (ohMyOpencodeConfig?.agents) {
    for (const agentName of Object.keys(ohMyOpencodeConfig.agents)) {
      ohMyOpencodePreset[agentName] = { model: DEFAULT_ECONOMY_MODEL };
    }
  }

  return {
    description: "Cost-efficient free model for routine tasks",
    opencode: opencodePreset,
    "oh-my-opencode": ohMyOpencodePreset,
  };
}

/**
 * Initialize the plugin configuration if it doesn't exist
 * @returns The configuration (existing or newly created)
 */
export async function initializeConfig(): Promise<ModeSwitcherConfig> {
  const exists = await pluginConfigExists();
  if (exists) {
    // Config already exists, load it
    const config = await loadPluginConfig();
    if (config) {
      return config;
    }
  }

  // Build initial configuration from existing settings
  const performancePreset = await buildPerformancePreset();
  const economyPreset = await buildEconomyPreset();

  const config: ModeSwitcherConfig = {
    currentMode: "performance",
    showToastOnStartup: true,
    presets: {
      performance: performancePreset,
      economy: economyPreset,
    },
  };

  // Save the initial configuration
  await savePluginConfig(config);

  return config;
}

/**
 * Ensure configuration is valid and has required presets
 */
export function validateConfig(config: ModeSwitcherConfig): boolean {
  if (!config.currentMode) {
    return false;
  }
  if (!config.presets || Object.keys(config.presets).length === 0) {
    return false;
  }
  if (!config.presets[config.currentMode]) {
    return false;
  }
  return true;
}
