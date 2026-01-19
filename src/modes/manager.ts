import type { OpencodeClient } from '@opencode-ai/sdk'
import type { ModeSwitcherConfig, ModePreset } from '../config/types.ts'
import {
  savePluginConfig,
  loadOpencodeConfig,
  saveOpencodeConfig,
  loadOhMyOpencodeConfig,
  saveOhMyOpencodeConfig,
} from '../config/loader.ts'
import { initializeConfig } from '../config/initializer.ts'

/**
 * Manages agent mode switching between different presets
 */
export class ModeManager {
  private config: ModeSwitcherConfig | null = null

  constructor(private readonly client: OpencodeClient) {}

  /**
   * Initialize the mode manager and load configuration
   */
  async initialize(): Promise<void> {
    this.config = await initializeConfig()
  }

  /**
   * Ensure configuration is loaded
   */
  private async ensureConfig(): Promise<ModeSwitcherConfig> {
    if (!this.config) {
      this.config = await initializeConfig()
    }
    return this.config
  }

  /**
   * Get the current mode name
   */
  async getCurrentMode(): Promise<string> {
    const config = await this.ensureConfig()
    return config.currentMode
  }

  /**
   * Get a specific preset by name
   */
  async getPreset(modeName: string): Promise<ModePreset | undefined> {
    const config = await this.ensureConfig()
    return config.presets[modeName]
  }

  /**
   * Get all available mode names
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
   * Get current status including mode and agent configurations
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
   * Switch to a different mode
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
   * Update opencode.json with global model and agent section
   * @param globalModel - Global model setting (optional)
   * @param agentPresets - Agent-specific model settings
   * @returns Result status: "updated", "skipped (not found)", or "error: ..."
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
   * Update oh-my-opencode.json agents section with preset values
   * @returns Result status: "updated", "skipped (not found)", or "error: ..."
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
   * Check if toast should be shown on startup
   */
  async shouldShowToastOnStartup(): Promise<boolean> {
    const config = await this.ensureConfig()
    return config.showToastOnStartup
  }
}
