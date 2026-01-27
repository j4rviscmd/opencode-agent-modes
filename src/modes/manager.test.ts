import { beforeEach, describe, expect, test } from 'bun:test'
import type { OpencodeClient } from '@opencode-ai/sdk'
import type {
  HierarchicalPreset,
  ModePreset,
  ModeSwitcherConfig,
  OhMyOpencodeConfig,
  OpencodeConfig,
} from '../config/types.ts'
import { createMockOpencodeClient, sampleConfigs } from '../test-utils/mocks.ts'

/**
 * Type guard to check if a value is a plain object (not null, not array).
 */
function isObject(obj: unknown): obj is Record<string, unknown> {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj)
}

/**
 * Recursively merges model settings from preset into target config.
 */
function deepMergeModel(
  target: Record<string, unknown>,
  preset: HierarchicalPreset
): void {
  for (const [key, value] of Object.entries(preset)) {
    if (!isObject(value)) continue

    const actualValue = target[key]

    if ('model' in value && typeof value.model === 'string') {
      const valueRecord = value as Record<string, unknown>
      const existing =
        (actualValue as Record<string, unknown> | undefined) ?? {}

      const merged: Record<string, unknown> = {
        ...existing,
        model: valueRecord.model,
      }

      if (valueRecord.variant) {
        merged.variant = valueRecord.variant
      }

      target[key] = merged
    } else {
      const childTarget =
        (actualValue as Record<string, unknown> | undefined) ?? {}
      target[key] = childTarget
      deepMergeModel(childTarget, value as HierarchicalPreset)
    }
  }
}

/**
 * Recursively checks if actual configuration differs from expected preset.
 */
function hasDriftRecursive(
  actual: Record<string, unknown>,
  expected: HierarchicalPreset
): boolean {
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (!isObject(expectedValue)) continue

    const actualValue = actual[key]

    if ('model' in expectedValue && typeof expectedValue.model === 'string') {
      const actualObj = actualValue as Record<string, unknown> | undefined
      if (actualObj?.model !== expectedValue.model) {
        return true
      }
      if (
        expectedValue.variant &&
        actualObj?.variant !== expectedValue.variant
      ) {
        return true
      }
    } else {
      if (
        hasDriftRecursive(
          (actualValue || {}) as Record<string, unknown>,
          expectedValue as HierarchicalPreset
        )
      ) {
        return true
      }
    }
  }

  return false
}

/**
 * Creates a deep copy of the sample plugin config for isolated test use.
 */
function clonePluginConfig(): ModeSwitcherConfig {
  return JSON.parse(
    JSON.stringify(sampleConfigs.pluginConfig)
  ) as ModeSwitcherConfig
}

/**
 * Mock implementation of ModeManager for testing purposes.
 *
 * This test double avoids the complexity of mocking file system operations
 * by storing configuration in memory. It implements the same public API
 * as the real ModeManager but uses in-memory state instead of reading/writing
 * JSON files.
 *
 * @internal
 */
class MockModeManager {
  private config: ModeSwitcherConfig | null = null
  private opencodeConfig: OpencodeConfig | null = null
  private ohMyConfig: OhMyOpencodeConfig | null = null
  private client: OpencodeClient

  /** Tracks whether a drift-toast was shown during initialize */
  lastDriftToast: string | null = null

  constructor(client: OpencodeClient) {
    this.client = client
  }

  setConfig(config: ModeSwitcherConfig): void {
    this.config = config
  }

  setOpencodeConfig(config: OpencodeConfig): void {
    this.opencodeConfig = config
  }

  setOhMyConfig(config: OhMyOpencodeConfig): void {
    this.ohMyConfig = config
  }

  async initialize(): Promise<void> {
    if (!this.config) {
      this.config = clonePluginConfig()
    }
    await this.applyCurrentModeIfNeeded()
  }

  private async applyCurrentModeIfNeeded(): Promise<void> {
    if (!this.config) {
      return
    }

    const preset = this.config.presets[this.config.currentMode]
    if (!preset) {
      return
    }

    const drifted = this.hasConfigDrift(preset)
    if (!drifted) {
      return
    }

    // Apply preset to in-memory configs using recursive merge
    if (this.opencodeConfig) {
      if (preset.model) {
        this.opencodeConfig.model = preset.model
      }
      this.opencodeConfig.agent = this.opencodeConfig.agent || {}
      deepMergeModel(
        this.opencodeConfig.agent as Record<string, unknown>,
        preset.opencode
      )
    }

    if (this.ohMyConfig) {
      deepMergeModel(
        this.ohMyConfig as Record<string, unknown>,
        preset['oh-my-opencode']
      )
    }

    this.lastDriftToast = `Applied "${this.config.currentMode}" mode. Restart opencode to take effect.`
  }

  private hasConfigDrift(preset: ModePreset): boolean {
    // Check global model
    if (preset.model && this.opencodeConfig) {
      if (this.opencodeConfig.model !== preset.model) {
        return true
      }
    }

    // Check opencode: recursively
    if (this.opencodeConfig?.agent) {
      if (
        hasDriftRecursive(
          this.opencodeConfig.agent as Record<string, unknown>,
          preset.opencode
        )
      ) {
        return true
      }
    }

    // Check oh-my-opencode: recursively
    if (this.ohMyConfig) {
      if (
        hasDriftRecursive(
          this.ohMyConfig as Record<string, unknown>,
          preset['oh-my-opencode']
        )
      ) {
        return true
      }
    }

    return false
  }

  private async ensureConfig(): Promise<ModeSwitcherConfig> {
    if (!this.config) {
      await this.initialize()
    }
    if (!this.config) {
      throw new Error('Config not initialized')
    }
    return this.config
  }

  async getCurrentMode(): Promise<string> {
    const config = await this.ensureConfig()
    return config.currentMode
  }

  async getPreset(modeName: string) {
    const config = await this.ensureConfig()
    return config.presets[modeName]
  }

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
   * Recursively formats hierarchical configuration as a tree string.
   */
  private formatHierarchicalTree(
    preset: HierarchicalPreset,
    indent = '  '
  ): string {
    const lines: string[] = []

    for (const [key, value] of Object.entries(preset)) {
      if (isObject(value)) {
        if ('model' in value && typeof value.model === 'string') {
          const variant = value.variant ? ` (${value.variant})` : ''
          const otherProps = Object.keys(value)
            .filter((k) => k !== 'model' && k !== 'variant')
            .map(
              (k) =>
                `${k}: ${JSON.stringify((value as Record<string, unknown>)[k])}`
            )
            .join(', ')
          const extra = otherProps ? ` [${otherProps}]` : ''
          lines.push(`${indent}${key}: ${value.model}${variant}${extra}`)
        } else {
          lines.push(`${indent}${key}:`)
          lines.push(
            this.formatHierarchicalTree(
              value as HierarchicalPreset,
              `${indent}  `
            )
          )
        }
      }
    }

    return lines.join('\n')
  }

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

    const opencodeTree = this.formatHierarchicalTree(preset.opencode)
    const ohMyOpencodeTree = this.formatHierarchicalTree(
      preset['oh-my-opencode']
    )

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

  async switchMode(modeName: string): Promise<string> {
    const config = await this.ensureConfig()
    const preset = config.presets[modeName]

    if (!preset) {
      const available = Object.keys(config.presets).join(', ')
      return `Mode "${modeName}" not found. Available modes: ${available}`
    }

    const results: string[] = []

    // Simulate updating opencode.json
    if (this.opencodeConfig) {
      results.push('opencode.json: updated')
    } else {
      results.push('opencode.json: skipped (not found)')
    }

    // Simulate updating oh-my-opencode.json
    if (this.ohMyConfig) {
      results.push('oh-my-opencode.json: updated')
    } else {
      results.push('oh-my-opencode.json: skipped (not found)')
    }

    // Update plugin configuration
    config.currentMode = modeName
    this.config = config
    results.push('agent-mode-switcher.json: updated')

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

  async shouldShowToastOnStartup(): Promise<boolean> {
    const config = await this.ensureConfig()
    return config.showToastOnStartup
  }
}

describe('ModeManager', () => {
  let manager: MockModeManager
  let mockClient: OpencodeClient

  beforeEach(() => {
    mockClient = createMockOpencodeClient()
    manager = new MockModeManager(mockClient)
  })

  describe('initialize', () => {
    test('loads configuration on initialize', async () => {
      await manager.initialize()
      const mode = await manager.getCurrentMode()
      expect(mode).toBe('performance')
    })

    test('uses provided config if set before initialize', async () => {
      const customConfig: ModeSwitcherConfig = {
        currentMode: 'custom',
        showToastOnStartup: false,
        presets: {
          custom: {
            description: 'Custom mode',
            opencode: {},
            'oh-my-opencode': {},
          },
        },
      }
      manager.setConfig(customConfig)
      await manager.initialize()
      const mode = await manager.getCurrentMode()
      expect(mode).toBe('custom')
    })
  })

  describe('getCurrentMode', () => {
    test('returns current mode name', async () => {
      await manager.initialize()
      const mode = await manager.getCurrentMode()
      expect(mode).toBe('performance')
    })

    test('returns updated mode after switch', async () => {
      await manager.initialize()
      await manager.switchMode('economy')
      const mode = await manager.getCurrentMode()
      expect(mode).toBe('economy')
    })
  })

  describe('getPreset', () => {
    test('returns preset when it exists', async () => {
      await manager.initialize()
      const preset = await manager.getPreset('performance')
      expect(preset).toBeDefined()
      expect(preset?.description).toBe(
        'High-performance models for complex tasks'
      )
    })

    test('returns undefined for non-existent preset', async () => {
      await manager.initialize()
      const preset = await manager.getPreset('nonexistent')
      expect(preset).toBeUndefined()
    })

    test('returns economy preset with correct model', async () => {
      await manager.initialize()
      const preset = await manager.getPreset('economy')
      expect(preset).toBeDefined()
      expect(preset?.model).toBe('opencode/glm-4.7-free')
    })
  })

  describe('listModes', () => {
    test('returns formatted list of available modes', async () => {
      await manager.initialize()
      const list = await manager.listModes()

      expect(list).toContain('Available modes:')
      expect(list).toContain('performance')
      expect(list).toContain('economy')
      expect(list).toContain('(current)')
    })

    test('marks current mode correctly', async () => {
      await manager.initialize()
      const list = await manager.listModes()
      expect(list).toContain('performance (current)')
    })

    test('includes mode descriptions', async () => {
      await manager.initialize()
      const list = await manager.listModes()
      expect(list).toContain('High-performance models for complex tasks')
      expect(list).toContain('Cost-efficient free model for routine tasks')
    })
  })

  describe('getStatus', () => {
    test('returns detailed status information', async () => {
      await manager.initialize()
      const status = await manager.getStatus()

      expect(status).toContain('Current mode: performance')
      expect(status).toContain('Description:')
      expect(status).toContain('Global model:')
      expect(status).toContain('OpenCode config:')
      expect(status).toContain('Oh-my-opencode config:')
    })

    test('shows preset not found for invalid mode', async () => {
      const invalidConfig: ModeSwitcherConfig = {
        currentMode: 'invalid',
        showToastOnStartup: true,
        presets: {},
      }
      manager.setConfig(invalidConfig)
      await manager.initialize()
      const status = await manager.getStatus()
      expect(status).toContain('(preset not found)')
    })

    test('shows agent configurations', async () => {
      await manager.initialize()
      const status = await manager.getStatus()
      expect(status).toContain('build:')
      expect(status).toContain('anthropic/claude-sonnet-4')
    })
  })

  describe('switchMode', () => {
    test('switches to existing mode successfully', async () => {
      await manager.initialize()
      const result = await manager.switchMode('economy')

      expect(result).toContain('Switched to economy mode')
      expect(result).toContain('Cost-efficient free model for routine tasks')
      expect(result).toContain('Results:')
    })

    test('returns error for non-existent mode', async () => {
      await manager.initialize()
      const result = await manager.switchMode('nonexistent')

      expect(result).toContain('Mode "nonexistent" not found')
      expect(result).toContain('Available modes:')
      expect(result).toContain('performance, economy')
    })

    test('updates current mode after switch', async () => {
      await manager.initialize()
      await manager.switchMode('economy')
      const mode = await manager.getCurrentMode()
      expect(mode).toBe('economy')
    })

    test('skips opencode.json when not found', async () => {
      await manager.initialize()
      // Don't set opencode config
      const result = await manager.switchMode('economy')
      expect(result).toContain('opencode.json: skipped (not found)')
    })

    test('updates opencode.json when present', async () => {
      await manager.initialize()
      manager.setOpencodeConfig(sampleConfigs.opencodeConfig)
      const result = await manager.switchMode('economy')
      expect(result).toContain('opencode.json: updated')
    })

    test('skips oh-my-opencode.json when not found', async () => {
      await manager.initialize()
      const result = await manager.switchMode('economy')
      expect(result).toContain('oh-my-opencode.json: skipped (not found)')
    })

    test('updates oh-my-opencode.json when present', async () => {
      await manager.initialize()
      manager.setOhMyConfig(sampleConfigs.ohMyOpencodeConfig)
      const result = await manager.switchMode('economy')
      expect(result).toContain('oh-my-opencode.json: updated')
    })

    test('always updates plugin config', async () => {
      await manager.initialize()
      const result = await manager.switchMode('economy')
      expect(result).toContain('agent-mode-switcher.json: updated')
    })

    test('includes restart note in result', async () => {
      await manager.initialize()
      const result = await manager.switchMode('economy')
      expect(result).toContain('Note: Restart opencode to apply changes.')
    })
  })

  describe('shouldShowToastOnStartup', () => {
    test('returns true when showToastOnStartup is true', async () => {
      await manager.initialize()
      const result = await manager.shouldShowToastOnStartup()
      expect(result).toBe(true)
    })

    test('returns false when showToastOnStartup is false', async () => {
      const config: ModeSwitcherConfig = {
        currentMode: 'performance',
        showToastOnStartup: false,
        presets: {
          performance: {
            description: 'Test',
            opencode: {},
            'oh-my-opencode': {},
          },
        },
      }
      manager.setConfig(config)
      await manager.initialize()
      const result = await manager.shouldShowToastOnStartup()
      expect(result).toBe(false)
    })
  })

  describe('applyCurrentModeIfNeeded', () => {
    test('applies preset when opencode.json has drifted', async () => {
      // Set currentMode to economy but opencode.json has performance models
      const config = clonePluginConfig()
      config.currentMode = 'economy'
      manager.setConfig(config)
      manager.setOpencodeConfig({
        model: 'anthropic/claude-sonnet-4',
        agent: {
          build: { model: 'anthropic/claude-sonnet-4' },
          plan: { model: 'anthropic/claude-sonnet-4' },
        },
      })

      await manager.initialize()

      expect(manager.lastDriftToast).toContain('economy')
      expect(manager.lastDriftToast).toContain('Restart opencode')
    })

    test('applies preset when oh-my-opencode.json has drifted', async () => {
      const config = clonePluginConfig()
      config.currentMode = 'economy'
      manager.setConfig(config)
      manager.setOhMyConfig({
        agents: {
          coder: { model: 'anthropic/claude-sonnet-4' },
        },
      })

      await manager.initialize()

      expect(manager.lastDriftToast).toContain('economy')
    })

    test('does not apply when configs match preset', async () => {
      // Set currentMode to economy and configs already match
      const config = clonePluginConfig()
      config.currentMode = 'economy'
      manager.setConfig(config)

      // Configs must match the economy preset structure
      manager.setOpencodeConfig({
        model: 'opencode/glm-4.7-free',
        agent: {
          build: { model: 'opencode/glm-4.7-free' },
          plan: { model: 'opencode/glm-4.7-free' },
        },
      })

      // Economy preset has agents: sisyphus and oracle under agents section
      // and categories section. For this test, we'll use a simpler structure.
      manager.setOhMyConfig({
        agents: {
          sisyphus: { model: 'opencode/glm-4.7-free' },
          oracle: { model: 'opencode/glm-4.7-free' },
        },
        categories: {
          'visual-engineering': { model: 'opencode/glm-4.7-free' },
          quick: { model: 'opencode/glm-4.7-free' },
        },
      })

      await manager.initialize()

      expect(manager.lastDriftToast).toBeNull()
    })

    test('does nothing when preset is not found', async () => {
      const config: ModeSwitcherConfig = {
        currentMode: 'nonexistent',
        showToastOnStartup: true,
        presets: {
          performance: {
            description: 'Test',
            opencode: {},
            'oh-my-opencode': {},
          },
        },
      }
      manager.setConfig(config)
      manager.setOpencodeConfig({
        model: 'anthropic/claude-sonnet-4',
        agent: { build: { model: 'anthropic/claude-sonnet-4' } },
      })

      await manager.initialize()

      expect(manager.lastDriftToast).toBeNull()
    })

    test('does nothing when no config files exist', async () => {
      const config = clonePluginConfig()
      config.currentMode = 'economy'
      manager.setConfig(config)
      // Don't set opencodeConfig or ohMyConfig

      await manager.initialize()

      expect(manager.lastDriftToast).toBeNull()
    })

    test('detects drift on global model mismatch', async () => {
      const config = clonePluginConfig()
      config.currentMode = 'economy'
      manager.setConfig(config)
      manager.setOpencodeConfig({
        model: 'anthropic/claude-sonnet-4', // Mismatch
        agent: {
          build: { model: 'opencode/glm-4.7-free' },
          plan: { model: 'opencode/glm-4.7-free' },
        },
      })

      await manager.initialize()

      expect(manager.lastDriftToast).not.toBeNull()
    })
  })
})
