import type { OpencodeClient } from "@opencode-ai/sdk";
import type {
  ModeSwitcherConfig,
  ModePreset,
  OhMyOpencodeConfig,
} from "../config/types.ts";
import {
  savePluginConfig,
  loadOhMyOpencodeConfig,
  saveOhMyOpencodeConfig,
} from "../config/loader.ts";
import { initializeConfig, validateConfig } from "../config/initializer.ts";

/**
 * Manages agent mode switching between different presets
 */
export class ModeManager {
  private config: ModeSwitcherConfig | null = null;

  constructor(private readonly client: OpencodeClient) {}

  /**
   * Initialize the mode manager and load configuration
   */
  async initialize(): Promise<void> {
    this.config = await initializeConfig();
  }

  /**
   * Ensure configuration is loaded
   */
  private async ensureConfig(): Promise<ModeSwitcherConfig> {
    if (!this.config) {
      this.config = await initializeConfig();
    }
    return this.config;
  }

  /**
   * Get the current mode name
   */
  async getCurrentMode(): Promise<string> {
    const config = await this.ensureConfig();
    return config.currentMode;
  }

  /**
   * Get a specific preset by name
   */
  async getPreset(modeName: string): Promise<ModePreset | undefined> {
    const config = await this.ensureConfig();
    return config.presets[modeName];
  }

  /**
   * Get all available mode names
   */
  async listModes(): Promise<string> {
    const config = await this.ensureConfig();
    const currentMode = config.currentMode;
    const modes = Object.entries(config.presets)
      .map(([name, preset]) => {
        const marker = name === currentMode ? " (current)" : "";
        return `- ${name}${marker}: ${preset.description}`;
      })
      .join("\n");

    return `Available modes:\n${modes}`;
  }

  /**
   * Get current status including mode and agent configurations
   */
  async getStatus(): Promise<string> {
    const config = await this.ensureConfig();
    const currentMode = config.currentMode;
    const preset = config.presets[currentMode];

    if (!preset) {
      return `Current mode: ${currentMode} (preset not found)`;
    }

    const opencodeAgents = Object.entries(preset.opencode)
      .map(([name, cfg]) => `  - ${name}: ${cfg.model}`)
      .join("\n");

    const ohMyOpencodeAgents = Object.entries(preset["oh-my-opencode"])
      .map(([name, cfg]) => `  - ${name}: ${cfg.model}`)
      .join("\n");

    return [
      `Current mode: ${currentMode}`,
      `Description: ${preset.description}`,
      "",
      "OpenCode agents:",
      opencodeAgents || "  (none configured)",
      "",
      "Oh-my-opencode agents:",
      ohMyOpencodeAgents || "  (none configured)",
    ].join("\n");
  }

  /**
   * Switch to a different mode
   */
  async switchMode(modeName: string): Promise<string> {
    const config = await this.ensureConfig();
    const preset = config.presets[modeName];

    if (!preset) {
      const available = Object.keys(config.presets).join(", ");
      return `Mode "${modeName}" not found. Available modes: ${available}`;
    }

    // 1. Update opencode agent settings via client API
    try {
      const agentConfig: Record<string, { model: string }> = {};
      for (const [agentName, agentPreset] of Object.entries(preset.opencode)) {
        agentConfig[agentName] = { model: agentPreset.model };
      }

      await this.client.config.update({
        body: { agent: agentConfig },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `Failed to update opencode config: ${message}`;
    }

    // 2. Update oh-my-opencode.json directly
    try {
      const ohMyConfig = await loadOhMyOpencodeConfig();
      if (ohMyConfig) {
        const updatedConfig: OhMyOpencodeConfig = {
          ...ohMyConfig,
          agents: {},
        };

        // Merge preset agents into existing config
        if (ohMyConfig.agents) {
          for (const agentName of Object.keys(ohMyConfig.agents)) {
            const presetAgent = preset["oh-my-opencode"][agentName];
            if (presetAgent) {
              updatedConfig.agents![agentName] = { model: presetAgent.model };
            } else {
              // Keep existing agent if not in preset
              updatedConfig.agents![agentName] = ohMyConfig.agents[agentName]!;
            }
          }
        }

        // Add any new agents from preset
        for (const [agentName, agentPreset] of Object.entries(
          preset["oh-my-opencode"]
        )) {
          if (!updatedConfig.agents![agentName]) {
            updatedConfig.agents![agentName] = { model: agentPreset.model };
          }
        }

        await saveOhMyOpencodeConfig(updatedConfig);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Log but don't fail - oh-my-opencode might not be installed
      console.warn(`Warning: Could not update oh-my-opencode.json: ${message}`);
    }

    // 3. Update plugin configuration
    config.currentMode = modeName;
    this.config = config;
    await savePluginConfig(config);

    // 4. Show toast notification
    try {
      await this.client.tui.showToast({
        body: {
          title: "Mode Switched",
          message: `Now using "${modeName}" mode. Restart opencode for oh-my-opencode changes.`,
          variant: "warning",
          duration: 5000,
        },
      });
    } catch {
      // Toast might not be available in all contexts
    }

    return [
      `Switched to ${modeName} mode`,
      preset.description,
      "",
      "Note: Restart opencode to apply oh-my-opencode changes.",
    ].join("\n");
  }

  /**
   * Apply the current mode settings (called on startup)
   */
  async applyCurrentMode(): Promise<void> {
    const config = await this.ensureConfig();

    if (!validateConfig(config)) {
      console.warn("Invalid mode switcher configuration");
      return;
    }

    const preset = config.presets[config.currentMode];
    if (!preset) {
      return;
    }

    // Apply opencode agent settings
    try {
      const agentConfig: Record<string, { model: string }> = {};
      for (const [agentName, agentPreset] of Object.entries(preset.opencode)) {
        agentConfig[agentName] = { model: agentPreset.model };
      }

      await this.client.config.update({
        body: { agent: agentConfig },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Failed to apply mode settings: ${message}`);
    }
  }

  /**
   * Check if toast should be shown on startup
   */
  async shouldShowToastOnStartup(): Promise<boolean> {
    const config = await this.ensureConfig();
    return config.showToastOnStartup;
  }
}
