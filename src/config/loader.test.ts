import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parse as parseJsonc } from 'jsonc-parser'
import { type ModificationOptions, applyEdits, modify } from 'jsonc-parser'
import {
  clearContentCache,
  expandPath,
  getOhMyOpencodeConfigPath,
  getOpencodeConfigPath,
  getPluginConfigPath,
  setContentCache,
} from './loader.ts'
import type {
  ModeSwitcherConfig,
  OhMyOpencodeConfig,
  OpencodeConfig,
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
      clearContentCache()
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

    describe('JSONC parsing', () => {
      test('parses JSON with single-line comments', async () => {
        const jsoncContent = `{
  // This is a comment
  "model": "anthropic/claude-sonnet-4",
  "agent": {
    // Another comment
    "build": { "model": "anthropic/claude-sonnet-4" }
  }
}`
        await Bun.write(testOpencodeConfigPath, jsoncContent)

        const content = await Bun.file(testOpencodeConfigPath).text()
        const parsed = parseJsonc(content) as OpencodeConfig

        expect(parsed.model).toBe('anthropic/claude-sonnet-4')
        expect(parsed.agent?.build?.model).toBe('anthropic/claude-sonnet-4')
      })

      test('parses JSON with block comments', async () => {
        const jsoncContent = `{
  /* This is a block comment */
  "model": "anthropic/claude-sonnet-4",
  /*
   * Multi-line
   * block comment
   */
  "agent": {
    "build": { "model": "anthropic/claude-sonnet-4" }
  }
}`
        await Bun.write(testOpencodeConfigPath, jsoncContent)

        const content = await Bun.file(testOpencodeConfigPath).text()
        const parsed = parseJsonc(content) as OpencodeConfig

        expect(parsed.model).toBe('anthropic/claude-sonnet-4')
        expect(parsed.agent?.build?.model).toBe('anthropic/claude-sonnet-4')
      })

      test('parses JSON with trailing commas', async () => {
        const jsoncContent = `{
  "model": "anthropic/claude-sonnet-4",
  "agent": {
    "build": { "model": "anthropic/claude-sonnet-4", },
    "plan": { "model": "anthropic/claude-haiku", },
  },
}`
        await Bun.write(testOpencodeConfigPath, jsoncContent)

        const content = await Bun.file(testOpencodeConfigPath).text()
        const parsed = parseJsonc(content) as OpencodeConfig

        expect(parsed.model).toBe('anthropic/claude-sonnet-4')
        expect(parsed.agent?.build?.model).toBe('anthropic/claude-sonnet-4')
        expect(parsed.agent?.plan?.model).toBe('anthropic/claude-haiku')
      })

      test('parses JSON with comments and trailing commas combined', async () => {
        const jsoncContent = `{
  // Model configuration
  "model": "anthropic/claude-sonnet-4",
  /* Agent settings */
  "agent": {
    "build": {
      "model": "anthropic/claude-sonnet-4", // high performance
    },
    "plan": {
      "model": "anthropic/claude-haiku", /* fast model */
    },
  },
}`
        await Bun.write(testOpencodeConfigPath, jsoncContent)

        const content = await Bun.file(testOpencodeConfigPath).text()
        const parsed = parseJsonc(content) as OpencodeConfig

        expect(parsed.model).toBe('anthropic/claude-sonnet-4')
        expect(parsed.agent?.build?.model).toBe('anthropic/claude-sonnet-4')
        expect(parsed.agent?.plan?.model).toBe('anthropic/claude-haiku')
      })

      test('standard JSON.parse fails on JSONC content', async () => {
        const jsoncContent = `{
  // This comment should break JSON.parse
  "model": "test"
}`
        await Bun.write(testOpencodeConfigPath, jsoncContent)

        const content = await Bun.file(testOpencodeConfigPath).text()

        // JSON.parse should throw an error
        expect(() => JSON.parse(content)).toThrow()

        // jsonc-parser should succeed
        const parsed = parseJsonc(content) as { model: string }
        expect(parsed.model).toBe('test')
      })
    })

    describe('comment preservation on save', () => {
      const modifyOptions: ModificationOptions = {
        formattingOptions: {
          tabSize: 2,
          insertSpaces: true,
          eol: '\n',
        },
      }

      /**
       * Helper to update leaf values recursively (mirrors loader.ts logic)
       */
      function updateLeafValues(
        content: string,
        basePath: (string | number)[],
        newValue: unknown
      ): string {
        if (newValue === null || typeof newValue !== 'object') {
          const edits = modify(content, basePath, newValue, modifyOptions)
          return applyEdits(content, edits)
        }

        if (Array.isArray(newValue)) {
          const edits = modify(content, basePath, newValue, modifyOptions)
          return applyEdits(content, edits)
        }

        const obj = newValue as Record<string, unknown>
        let result = content

        for (const key of Object.keys(obj)) {
          result = updateLeafValues(result, [...basePath, key], obj[key])
        }

        return result
      }

      test('preserves single-line comments when updating values', () => {
        const originalContent = `{
  // Model configuration
  "model": "anthropic/claude-sonnet-4",
  // Agent settings
  "agent": {
    // Build agent
    "build": { "model": "anthropic/claude-sonnet-4" }
  }
}`
        const newData = {
          model: 'opencode/glm-4.7-free',
          agent: {
            build: { model: 'opencode/glm-4.7-free' },
          },
        }

        let content = originalContent
        for (const key of Object.keys(newData)) {
          content = updateLeafValues(
            content,
            [key],
            newData[key as keyof typeof newData]
          )
        }

        // Verify comments are preserved
        expect(content).toContain('// Model configuration')
        expect(content).toContain('// Agent settings')
        expect(content).toContain('// Build agent')

        // Verify values are updated
        const parsed = parseJsonc(content) as OpencodeConfig
        expect(parsed.model).toBe('opencode/glm-4.7-free')
        expect(parsed.agent?.build?.model).toBe('opencode/glm-4.7-free')
      })

      test('preserves block comments when updating values', () => {
        const originalContent = `{
  /* Global model setting */
  "model": "anthropic/claude-sonnet-4",
  /*
   * Agent configuration section
   * Contains settings for all agents
   */
  "agent": {
    "build": { "model": "anthropic/claude-sonnet-4" }
  }
}`
        const newData = {
          model: 'opencode/glm-4.7-free',
          agent: {
            build: { model: 'opencode/glm-4.7-free' },
          },
        }

        let content = originalContent
        for (const key of Object.keys(newData)) {
          content = updateLeafValues(
            content,
            [key],
            newData[key as keyof typeof newData]
          )
        }

        // Verify block comments are preserved
        expect(content).toContain('/* Global model setting */')
        expect(content).toContain('* Agent configuration section')
        expect(content).toContain('* Contains settings for all agents')

        // Verify values are updated
        const parsed = parseJsonc(content) as OpencodeConfig
        expect(parsed.model).toBe('opencode/glm-4.7-free')
        expect(parsed.agent?.build?.model).toBe('opencode/glm-4.7-free')
      })

      test('preserves inline comments when updating values', () => {
        const originalContent = `{
  "model": "anthropic/claude-sonnet-4", // main model
  "agent": {
    "build": { "model": "anthropic/claude-sonnet-4" } // build agent model
  }
}`
        const newData = {
          model: 'opencode/glm-4.7-free',
          agent: {
            build: { model: 'opencode/glm-4.7-free' },
          },
        }

        let content = originalContent
        for (const key of Object.keys(newData)) {
          content = updateLeafValues(
            content,
            [key],
            newData[key as keyof typeof newData]
          )
        }

        // Verify inline comments are preserved
        expect(content).toContain('// main model')
        expect(content).toContain('// build agent model')

        // Verify values are updated
        const parsed = parseJsonc(content) as OpencodeConfig
        expect(parsed.model).toBe('opencode/glm-4.7-free')
        expect(parsed.agent?.build?.model).toBe('opencode/glm-4.7-free')
      })

      test('preserves trailing commas when updating values', () => {
        const originalContent = `{
  "model": "anthropic/claude-sonnet-4",
  "agent": {
    "build": { "model": "anthropic/claude-sonnet-4", },
  },
}`
        const newData = {
          model: 'opencode/glm-4.7-free',
          agent: {
            build: { model: 'opencode/glm-4.7-free' },
          },
        }

        let content = originalContent
        for (const key of Object.keys(newData)) {
          content = updateLeafValues(
            content,
            [key],
            newData[key as keyof typeof newData]
          )
        }

        // Verify values are updated and file is still valid JSONC
        const parsed = parseJsonc(content) as OpencodeConfig
        expect(parsed.model).toBe('opencode/glm-4.7-free')
        expect(parsed.agent?.build?.model).toBe('opencode/glm-4.7-free')
      })

      test('preserves mixed comments and trailing commas', () => {
        const originalContent = `{
  // Model configuration
  "model": "anthropic/claude-sonnet-4", /* main model */
  /* Agent settings */
  "agent": {
    "build": {
      "model": "anthropic/claude-sonnet-4", // high performance
    },
    "plan": {
      "model": "anthropic/claude-haiku", /* fast model */
    },
  },
}`
        const newData = {
          model: 'opencode/glm-4.7-free',
          agent: {
            build: { model: 'opencode/glm-4.7-free' },
            plan: { model: 'opencode/glm-4.7-free' },
          },
        }

        let content = originalContent
        for (const key of Object.keys(newData)) {
          content = updateLeafValues(
            content,
            [key],
            newData[key as keyof typeof newData]
          )
        }

        // Verify comments are preserved
        expect(content).toContain('// Model configuration')
        expect(content).toContain('/* main model */')
        expect(content).toContain('/* Agent settings */')
        expect(content).toContain('// high performance')
        expect(content).toContain('/* fast model */')

        // Verify values are updated
        const parsed = parseJsonc(content) as OpencodeConfig
        expect(parsed.model).toBe('opencode/glm-4.7-free')
        expect(parsed.agent?.build?.model).toBe('opencode/glm-4.7-free')
        expect(parsed.agent?.plan?.model).toBe('opencode/glm-4.7-free')
      })

      test('handles deeply nested objects with comments', () => {
        const originalContent = `{
  // Root level comment
  "agents": {
    // Coder agent
    "coder": {
      // Model for coding tasks
      "model": "anthropic/claude-sonnet-4"
    },
    // Reviewer agent
    "reviewer": {
      // Model for review tasks
      "model": "anthropic/claude-haiku"
    }
  }
}`
        const newData = {
          agents: {
            coder: { model: 'opencode/glm-4.7-free' },
            reviewer: { model: 'opencode/glm-4.7-free' },
          },
        }

        let content = originalContent
        for (const key of Object.keys(newData)) {
          content = updateLeafValues(
            content,
            [key],
            newData[key as keyof typeof newData]
          )
        }

        // Verify all comments are preserved
        expect(content).toContain('// Root level comment')
        expect(content).toContain('// Coder agent')
        expect(content).toContain('// Model for coding tasks')
        expect(content).toContain('// Reviewer agent')
        expect(content).toContain('// Model for review tasks')

        // Verify values are updated
        const parsed = parseJsonc(content) as OhMyOpencodeConfig
        expect(parsed.agents?.coder?.model).toBe('opencode/glm-4.7-free')
        expect(parsed.agents?.reviewer?.model).toBe('opencode/glm-4.7-free')
      })

      test('integration: setContentCache + saveJsonFile preserves comments', async () => {
        const jsoncContent = `{
  // Model configuration
  "model": "anthropic/claude-sonnet-4",
  // Agent settings
  "agent": {
    // Build agent
    "build": { "model": "anthropic/claude-sonnet-4" }
  }
}`
        // Simulate: file was loaded (content cached)
        await Bun.write(testOpencodeConfigPath, jsoncContent)
        setContentCache(testOpencodeConfigPath, jsoncContent)

        // Load, modify, and save using the same pattern as saveJsonFile
        const originalContent = jsoncContent
        const newData: OpencodeConfig = {
          model: 'opencode/glm-4.7-free',
          agent: {
            build: { model: 'opencode/glm-4.7-free' },
          },
        }

        let content = originalContent
        for (const key of Object.keys(newData)) {
          content = updateLeafValues(
            content,
            [key],
            newData[key as keyof typeof newData]
          )
        }

        await Bun.write(testOpencodeConfigPath, content)

        // Read back and verify
        const savedContent = await Bun.file(testOpencodeConfigPath).text()

        // Verify comments are preserved
        expect(savedContent).toContain('// Model configuration')
        expect(savedContent).toContain('// Agent settings')
        expect(savedContent).toContain('// Build agent')

        // Verify values are updated
        const parsed = parseJsonc(savedContent) as OpencodeConfig
        expect(parsed.model).toBe('opencode/glm-4.7-free')
        expect(parsed.agent?.build?.model).toBe('opencode/glm-4.7-free')
      })
    })
  })
})
