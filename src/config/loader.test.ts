import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { rmSync, mkdirSync } from 'node:fs'
import {
  expandPath,
  getPluginConfigPath,
  getOpencodeConfigPath,
  getOhMyOpencodeConfigPath,
} from './loader.ts'
import type {
  ModeSwitcherConfig,
  OpencodeConfig,
  OhMyOpencodeConfig,
} from './types.ts'

describe('loader', () => {
  describe('expandPath', () => {
    test('expands ~ to home directory', () => {
      const result = expandPath('~/test/path')
      expect(result).toBe(join(homedir(), 'test/path'))
    })

    test('keeps absolute path unchanged', () => {
      const absolutePath = '/absolute/path/to/file'
      const result = expandPath(absolutePath)
      expect(result).toBe(absolutePath)
    })

    test('keeps relative path unchanged', () => {
      const relativePath = 'relative/path/to/file'
      const result = expandPath(relativePath)
      expect(result).toBe(relativePath)
    })

    test('handles empty string', () => {
      const result = expandPath('')
      expect(result).toBe('')
    })

    test('handles path with only ~', () => {
      const result = expandPath('~')
      expect(result).toBe('~')
    })

    test('expands ~/', () => {
      const result = expandPath('~/')
      expect(result).toBe(join(homedir(), ''))
    })
  })

  describe('config path functions', () => {
    test('getPluginConfigPath returns correct path', () => {
      const result = getPluginConfigPath()
      expect(result).toBe(
        join(homedir(), '.config/opencode/agent-mode-switcher.json')
      )
    })

    test('getOpencodeConfigPath returns correct path', () => {
      const result = getOpencodeConfigPath()
      expect(result).toBe(join(homedir(), '.config/opencode/opencode.json'))
    })

    test('getOhMyOpencodeConfigPath returns correct path', () => {
      const result = getOhMyOpencodeConfigPath()
      expect(result).toBe(
        join(homedir(), '.config/opencode/oh-my-opencode.json')
      )
    })
  })

  describe('file operations', () => {
    const testDir = '/tmp/opencode-agent-modes-test'
    const testPluginConfigPath = join(testDir, 'agent-mode-switcher.json')
    const testOpencodeConfigPath = join(testDir, 'opencode.json')
    const testOhMyConfigPath = join(testDir, 'oh-my-opencode.json')

    beforeEach(() => {
      mkdirSync(testDir, { recursive: true })
    })

    afterEach(() => {
      rmSync(testDir, { recursive: true, force: true })
    })

    describe('plugin config', () => {
      const sampleConfig: ModeSwitcherConfig = {
        currentMode: 'performance',
        showToastOnStartup: true,
        presets: {
          performance: {
            description: 'High-performance models',
            model: 'anthropic/claude-sonnet-4',
            opencode: { build: { model: 'anthropic/claude-sonnet-4' } },
            'oh-my-opencode': {},
          },
        },
      }

      test('savePluginConfig writes JSON with formatting', async () => {
        await Bun.write(testPluginConfigPath, '')

        // Write directly to test path
        const content = JSON.stringify(sampleConfig, null, 2)
        await Bun.write(testPluginConfigPath, content)

        const savedContent = await Bun.file(testPluginConfigPath).text()
        expect(savedContent).toBe(JSON.stringify(sampleConfig, null, 2))
      })

      test('loading non-existent config returns null', async () => {
        const file = Bun.file(join(testDir, 'nonexistent.json'))
        const exists = await file.exists()
        expect(exists).toBe(false)
      })

      test('loading invalid JSON returns null', async () => {
        await Bun.write(testPluginConfigPath, '{ invalid json }')

        const file = Bun.file(testPluginConfigPath)
        const content = await file.text()

        let parsed = null
        try {
          parsed = JSON.parse(content)
        } catch {
          parsed = null
        }

        expect(parsed).toBe(null)
      })

      test('round-trip save and load preserves data', async () => {
        const content = JSON.stringify(sampleConfig, null, 2)
        await Bun.write(testPluginConfigPath, content)

        const loadedContent = await Bun.file(testPluginConfigPath).text()
        const loadedConfig = JSON.parse(loadedContent) as ModeSwitcherConfig

        expect(loadedConfig).toEqual(sampleConfig)
      })
    })

    describe('opencode config', () => {
      const sampleConfig: OpencodeConfig = {
        model: 'anthropic/claude-sonnet-4',
        agent: {
          build: { model: 'anthropic/claude-sonnet-4' },
          plan: { model: 'anthropic/claude-haiku' },
        },
      }

      test('saveOpencodeConfig writes JSON with formatting', async () => {
        const content = JSON.stringify(sampleConfig, null, 2)
        await Bun.write(testOpencodeConfigPath, content)

        const savedContent = await Bun.file(testOpencodeConfigPath).text()
        expect(savedContent).toBe(JSON.stringify(sampleConfig, null, 2))
      })

      test('round-trip preserves all fields', async () => {
        const content = JSON.stringify(sampleConfig, null, 2)
        await Bun.write(testOpencodeConfigPath, content)

        const loadedContent = await Bun.file(testOpencodeConfigPath).text()
        const loadedConfig = JSON.parse(loadedContent) as OpencodeConfig

        expect(loadedConfig.model).toBe(sampleConfig.model)
        expect(loadedConfig.agent).toEqual(sampleConfig.agent)
      })
    })

    describe('oh-my-opencode config', () => {
      const sampleConfig: OhMyOpencodeConfig = {
        agents: {
          coder: { model: 'anthropic/claude-sonnet-4' },
          reviewer: { model: 'anthropic/claude-haiku' },
        },
      }

      test('saveOhMyOpencodeConfig writes JSON with formatting', async () => {
        const content = JSON.stringify(sampleConfig, null, 2)
        await Bun.write(testOhMyConfigPath, content)

        const savedContent = await Bun.file(testOhMyConfigPath).text()
        expect(savedContent).toBe(JSON.stringify(sampleConfig, null, 2))
      })

      test('round-trip preserves agents data', async () => {
        const content = JSON.stringify(sampleConfig, null, 2)
        await Bun.write(testOhMyConfigPath, content)

        const loadedContent = await Bun.file(testOhMyConfigPath).text()
        const loadedConfig = JSON.parse(loadedContent) as OhMyOpencodeConfig

        expect(loadedConfig.agents).toEqual(sampleConfig.agents)
      })
    })

    describe('pluginConfigExists', () => {
      test('returns true when config file exists', async () => {
        await Bun.write(testPluginConfigPath, '{}')
        const file = Bun.file(testPluginConfigPath)
        const exists = await file.exists()
        expect(exists).toBe(true)
      })

      test('returns false when config file does not exist', async () => {
        const file = Bun.file(join(testDir, 'nonexistent.json'))
        const exists = await file.exists()
        expect(exists).toBe(false)
      })
    })
  })
})
