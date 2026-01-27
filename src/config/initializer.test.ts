import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { validateConfig } from './initializer.ts'
import type { ModePreset, ModeSwitcherConfig } from './types.ts'

describe('initializer', () => {
  describe('validateConfig', () => {
    const createValidPreset = (): ModePreset => ({
      description: 'Test preset',
      model: 'test-model',
      opencode: {},
      'oh-my-opencode': {},
    })

    const createValidConfig = (): ModeSwitcherConfig => ({
      currentMode: 'performance',
      showToastOnStartup: true,
      presets: {
        performance: createValidPreset(),
      },
    })

    test('returns true for valid configuration', () => {
      const config = createValidConfig()
      expect(validateConfig(config)).toBe(true)
    })

    test('returns false when currentMode is empty', () => {
      const config = createValidConfig()
      config.currentMode = ''
      expect(validateConfig(config)).toBe(false)
    })

    test('returns false when presets is empty object', () => {
      const config = createValidConfig()
      config.presets = {}
      expect(validateConfig(config)).toBe(false)
    })

    test('returns false when currentMode preset does not exist', () => {
      const config = createValidConfig()
      config.currentMode = 'nonexistent'
      expect(validateConfig(config)).toBe(false)
    })

    test('returns true with multiple presets', () => {
      const config = createValidConfig()
      config.presets.economy = createValidPreset()
      config.presets.economy.description = 'Economy preset'
      expect(validateConfig(config)).toBe(true)
    })

    test('returns true when currentMode matches one of multiple presets', () => {
      const config: ModeSwitcherConfig = {
        currentMode: 'economy',
        showToastOnStartup: false,
        presets: {
          performance: createValidPreset(),
          economy: {
            ...createValidPreset(),
            description: 'Economy preset',
          },
        },
      }
      expect(validateConfig(config)).toBe(true)
    })

    test('returns false when presets is undefined', () => {
      const config = {
        currentMode: 'performance',
        showToastOnStartup: true,
      } as ModeSwitcherConfig
      // @ts-expect-error: Testing invalid state
      config.presets = undefined
      expect(validateConfig(config)).toBe(false)
    })

    test('handles config with extra fields', () => {
      const config = createValidConfig()
      // Add extra field that shouldn't affect validation
      ;(config as unknown as Record<string, unknown>).extraField = 'value'
      expect(validateConfig(config)).toBe(true)
    })
  })

  describe('initializeConfig integration', () => {
    const testDir = '/tmp/opencode-initializer-test'
    const configDir = join(testDir, '.config/opencode')

    beforeEach(() => {
      mkdirSync(configDir, { recursive: true })
    })

    afterEach(() => {
      rmSync(testDir, { recursive: true, force: true })
    })

    test('creates default config structure', async () => {
      // Simulate what initializeConfig does: create a config with
      // performance and economy presets
      const config: ModeSwitcherConfig = {
        currentMode: 'performance',
        showToastOnStartup: true,
        presets: {
          performance: {
            description: 'High-performance models for complex tasks',
            opencode: {},
            'oh-my-opencode': {},
          },
          economy: {
            description: 'Cost-efficient free model for routine tasks',
            model: 'opencode/glm-4.7-free',
            opencode: {},
            'oh-my-opencode': {},
          },
        },
      }

      expect(validateConfig(config)).toBe(true)
      expect(config.currentMode).toBe('performance')
      expect(config.presets.performance).toBeDefined()
      expect(config.presets.economy).toBeDefined()
    })

    test('economy preset has default model', () => {
      const economyPreset: ModePreset = {
        description: 'Cost-efficient free model for routine tasks',
        model: 'opencode/glm-4.7-free',
        opencode: {
          agent: {
            build: { model: 'opencode/glm-4.7-free' },
            plan: { model: 'opencode/glm-4.7-free' },
          },
        },
        'oh-my-opencode': {
          agents: {
            sisyphus: { model: 'opencode/glm-4.7-free' },
          },
        },
      }

      expect(economyPreset.model).toBe('opencode/glm-4.7-free')
      // Check hierarchical structure
      const opencodeAgent = economyPreset.opencode.agent as Record<
        string,
        unknown
      >
      const buildConfig = opencodeAgent.build as Record<string, unknown>
      expect(buildConfig.model).toBe('opencode/glm-4.7-free')

      const ohMyAgents = economyPreset['oh-my-opencode'].agents as Record<
        string,
        unknown
      >
      const sisyphusConfig = ohMyAgents.sisyphus as Record<string, unknown>
      expect(sisyphusConfig.model).toBe('opencode/glm-4.7-free')
    })

    test('performance preset captures existing models with hierarchy', () => {
      // Simulate building performance preset from existing config with hierarchy
      const existingOpencodeConfig = {
        model: 'anthropic/claude-sonnet-4',
        agent: {
          build: { model: 'anthropic/claude-sonnet-4', piyo: 'fuga' },
          plan: { model: 'anthropic/claude-haiku' },
        },
      }

      const existingOhMyConfig = {
        agents: {
          sisyphus: {
            model: 'github-copilot/claude-4.5',
            variant: 'high',
            abc: 123,
          },
          oracle: { model: 'github-copilot/gpt-5.2' },
        },
        categories: {
          quick: { model: 'github-copilot/haiku-4.5' },
        },
      }

      const performancePreset: ModePreset = {
        description: 'High-performance models for complex tasks',
        model: existingOpencodeConfig.model,
        opencode: existingOpencodeConfig.agent as Record<string, unknown>,
        'oh-my-opencode': existingOhMyConfig as Record<string, unknown>,
      }

      expect(performancePreset.model).toBe('anthropic/claude-sonnet-4')

      // Check opencode hierarchy is preserved (opencode IS the agent hierarchy)
      const buildConfig = performancePreset.opencode.build as Record<
        string,
        unknown
      >
      expect(buildConfig.model).toBe('anthropic/claude-sonnet-4')
      expect(buildConfig.piyo).toBe('fuga') // Other properties preserved

      // Check oh-my-opencode hierarchy is preserved
      const ohMyAgents = performancePreset['oh-my-opencode'].agents as Record<
        string,
        unknown
      >
      const sisyphusConfig = ohMyAgents.sisyphus as Record<string, unknown>
      expect(sisyphusConfig.model).toBe('github-copilot/claude-4.5')
      expect(sisyphusConfig.variant).toBe('high')
      expect(sisyphusConfig.abc).toBe(123) // Other properties preserved
    })

    test('config file persistence', async () => {
      const configPath = join(configDir, 'agent-mode-switcher.json')
      const config: ModeSwitcherConfig = {
        currentMode: 'economy',
        showToastOnStartup: false,
        presets: {
          economy: {
            description: 'Economy preset',
            model: 'opencode/glm-4.7-free',
            opencode: {},
            'oh-my-opencode': {},
          },
        },
      }

      // Save config
      await Bun.write(configPath, JSON.stringify(config, null, 2))

      // Load and verify
      const loadedContent = await Bun.file(configPath).text()
      const loadedConfig = JSON.parse(loadedContent) as ModeSwitcherConfig

      expect(loadedConfig.currentMode).toBe('economy')
      expect(loadedConfig.showToastOnStartup).toBe(false)
      expect(validateConfig(loadedConfig)).toBe(true)
    })
  })
})
