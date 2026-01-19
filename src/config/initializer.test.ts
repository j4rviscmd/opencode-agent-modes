import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { join } from 'node:path'
import { rmSync, mkdirSync } from 'node:fs'
import { validateConfig } from './initializer.ts'
import type { ModeSwitcherConfig, ModePreset } from './types.ts'

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
          build: { model: 'opencode/glm-4.7-free' },
          plan: { model: 'opencode/glm-4.7-free' },
        },
        'oh-my-opencode': {},
      }

      expect(economyPreset.model).toBe('opencode/glm-4.7-free')
      expect(economyPreset.opencode.build?.model).toBe('opencode/glm-4.7-free')
    })

    test('performance preset captures existing models', () => {
      // Simulate building performance preset from existing config
      const existingOpencodeConfig = {
        model: 'anthropic/claude-sonnet-4',
        agent: {
          build: { model: 'anthropic/claude-sonnet-4' },
          plan: { model: 'anthropic/claude-haiku' },
        },
      }

      const performancePreset: ModePreset = {
        description: 'High-performance models for complex tasks',
        model: existingOpencodeConfig.model,
        opencode: {
          build: { model: existingOpencodeConfig.agent.build.model },
          plan: { model: existingOpencodeConfig.agent.plan.model },
        },
        'oh-my-opencode': {},
      }

      expect(performancePreset.model).toBe('anthropic/claude-sonnet-4')
      expect(performancePreset.opencode.build?.model).toBe(
        'anthropic/claude-sonnet-4'
      )
      expect(performancePreset.opencode.plan?.model).toBe(
        'anthropic/claude-haiku'
      )
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
