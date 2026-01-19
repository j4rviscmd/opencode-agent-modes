import { mock } from 'bun:test'
import type { OpencodeClient } from '@opencode-ai/sdk'

/**
 * Virtual file system for testing
 */
export class MockFileSystem {
  private files = new Map<string, string>()

  /**
   * Set file content in virtual file system
   */
  set(path: string, content: string): void {
    this.files.set(path, content)
  }

  /**
   * Get file content from virtual file system
   */
  get(path: string): string | undefined {
    return this.files.get(path)
  }

  /**
   * Check if file exists in virtual file system
   */
  has(path: string): boolean {
    return this.files.has(path)
  }

  /**
   * Delete file from virtual file system
   */
  delete(path: string): boolean {
    return this.files.delete(path)
  }

  /**
   * Clear all files from virtual file system
   */
  clear(): void {
    this.files.clear()
  }

  /**
   * Get all file paths
   */
  keys(): IterableIterator<string> {
    return this.files.keys()
  }
}

/**
 * Create a mock Bun.file function bound to a virtual file system
 */
export function createMockBunFile(fs: MockFileSystem) {
  return (path: string) => ({
    exists: async () => fs.has(path),
    text: async () => {
      const content = fs.get(path)
      if (content === undefined) {
        throw new Error(`ENOENT: no such file or directory: ${path}`)
      }
      return content
    },
  })
}

/**
 * Create a mock Bun.write function bound to a virtual file system
 */
export function createMockBunWrite(fs: MockFileSystem) {
  return async (path: string, content: string) => {
    fs.set(path, content)
    return content.length
  }
}

/**
 * Mock homedir to return a consistent test path
 */
export const MOCK_HOME_DIR = '/test-home'

export function createMockHomedir() {
  return () => MOCK_HOME_DIR
}

/**
 * Create a mock OpencodeClient for testing
 */
export function createMockOpencodeClient(): OpencodeClient {
  return {
    tui: {
      showToast: mock(() => Promise.resolve()),
    },
  } as unknown as OpencodeClient
}

/**
 * Helper to create a complete test setup
 */
export function createTestSetup() {
  const fs = new MockFileSystem()
  const mockFile = createMockBunFile(fs)
  const mockWrite = createMockBunWrite(fs)
  const mockHomedir = createMockHomedir()
  const mockClient = createMockOpencodeClient()

  return {
    fs,
    mockFile,
    mockWrite,
    mockHomedir,
    mockClient,
    cleanup: () => fs.clear(),
  }
}

/**
 * Sample configuration data for testing
 */
export const sampleConfigs = {
  pluginConfig: {
    currentMode: 'performance',
    showToastOnStartup: true,
    presets: {
      performance: {
        description: 'High-performance models for complex tasks',
        model: 'anthropic/claude-sonnet-4',
        opencode: {
          build: { model: 'anthropic/claude-sonnet-4' },
          plan: { model: 'anthropic/claude-sonnet-4' },
        },
        'oh-my-opencode': {
          coder: { model: 'anthropic/claude-sonnet-4' },
        },
      },
      economy: {
        description: 'Cost-efficient free model for routine tasks',
        model: 'opencode/glm-4.7-free',
        opencode: {
          build: { model: 'opencode/glm-4.7-free' },
          plan: { model: 'opencode/glm-4.7-free' },
        },
        'oh-my-opencode': {
          coder: { model: 'opencode/glm-4.7-free' },
        },
      },
    },
  },
  opencodeConfig: {
    model: 'anthropic/claude-sonnet-4',
    agent: {
      build: { model: 'anthropic/claude-sonnet-4' },
      plan: { model: 'anthropic/claude-sonnet-4' },
      summary: { model: 'anthropic/claude-haiku' },
    },
  },
  ohMyOpencodeConfig: {
    agents: {
      coder: { model: 'anthropic/claude-sonnet-4' },
      reviewer: { model: 'anthropic/claude-haiku' },
    },
  },
}
