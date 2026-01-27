import { mock } from 'bun:test'
import type { OpencodeClient } from '@opencode-ai/sdk'

/**
 * Virtual file system for testing.
 *
 * Provides an in-memory file storage implementation that mimics
 * basic file system operations for isolated testing without
 * touching the actual disk.
 *
 * @example
 * ```typescript
 * const fs = new MockFileSystem();
 * fs.set('/path/to/file.json', '{"key": "value"}');
 * const content = fs.get('/path/to/file.json');
 * fs.has('/path/to/file.json'); // true
 * fs.delete('/path/to/file.json');
 * ```
 */
export class MockFileSystem {
  private files = new Map<string, string>()

  /**
   * Set file content in virtual file system.
   *
   * @param path - The file path to set
   * @param content - The file content to store
   */
  set(path: string, content: string): void {
    this.files.set(path, content)
  }

  /**
   * Get file content from virtual file system.
   *
   * @param path - The file path to retrieve
   * @returns The file content, or undefined if not found
   */
  get(path: string): string | undefined {
    return this.files.get(path)
  }

  /**
   * Check if file exists in virtual file system.
   *
   * @param path - The file path to check
   * @returns True if the file exists
   */
  has(path: string): boolean {
    return this.files.has(path)
  }

  /**
   * Delete file from virtual file system.
   *
   * @param path - The file path to delete
   * @returns True if the file was deleted, false if not found
   */
  delete(path: string): boolean {
    return this.files.delete(path)
  }

  /**
   * Clear all files from virtual file system.
   */
  clear(): void {
    this.files.clear()
  }

  /**
   * Get all file paths.
   *
   * @returns Iterator over all stored file paths
   */
  keys(): IterableIterator<string> {
    return this.files.keys()
  }
}

/**
 * Create a mock Bun.file function bound to a virtual file system.
 *
 * Returns a function that mimics Bun.file() API, reading from
 * the provided virtual file system instead of disk.
 *
 * @param fs - The virtual file system to read from
 * @returns A mock Bun.file function
 *
 * @example
 * ```typescript
 * const fs = new MockFileSystem();
 * fs.set('/test/file.json', '{}');
 * const mockFile = createMockBunFile(fs);
 * const file = mockFile('/test/file.json');
 * const exists = await file.exists(); // true
 * const text = await file.text(); // '{}'
 * ```
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
 * Create a mock Bun.write function bound to a virtual file system.
 *
 * Returns a function that mimics Bun.write() API, writing to
 * the provided virtual file system instead of disk.
 *
 * @param fs - The virtual file system to write to
 * @returns A mock Bun.write function
 *
 * @example
 * ```typescript
 * const fs = new MockFileSystem();
 * const mockWrite = createMockBunWrite(fs);
 * await mockWrite('/test/file.json', '{}');
 * fs.has('/test/file.json'); // true
 * ```
 */
export function createMockBunWrite(fs: MockFileSystem) {
  return async (path: string, content: string) => {
    fs.set(path, content)
    return content.length
  }
}

/**
 * Mock homedir to return a consistent test path.
 *
 * This constant provides a predictable home directory path
 * for testing file path expansion operations.
 */
export const MOCK_HOME_DIR = '/test-home'

/**
 * Create a mock homedir function.
 *
 * Returns a function that always returns {@link MOCK_HOME_DIR},
 * useful for mocking `os.homedir()` in tests.
 *
 * @returns A mock homedir function
 *
 * @example
 * ```typescript
 * const mockHomedir = createMockHomedir();
 * mockHomedir(); // '/test-home'
 * ```
 */
export function createMockHomedir() {
  return () => MOCK_HOME_DIR
}

/**
 * Create a mock OpencodeClient for testing.
 *
 * Returns a minimal OpencodeClient mock with a mocked `tui.showToast`
 * method. Useful for testing ModeManager without actual OpenCode UI.
 *
 * @returns A mock OpencodeClient with mocked toast functionality
 *
 * @example
 * ```typescript
 * const mockClient = createMockOpencodeClient();
 * await mockClient.tui.showToast({
 *   body: { title: 'Test', message: 'Test message' }
 * });
 * // Toast call is captured by bun:test mock()
 * ```
 */
export function createMockOpencodeClient(): OpencodeClient {
  return {
    tui: {
      showToast: mock(() => Promise.resolve()),
    },
  } as unknown as OpencodeClient
}

/**
 * Helper to create a complete test setup.
 *
 * Creates a full testing environment including:
 * - Virtual file system
 * - Mocked Bun file I/O functions
 * - Mocked homedir function
 * - Mocked OpencodeClient
 *
 * @returns An object containing all test utilities and a cleanup function
 *
 * @example
 * ```typescript
 * const { fs, mockFile, mockWrite, cleanup } = createTestSetup();
 * // Use mocks in tests
 * fs.set('/test/config.json', '{}');
 * // ... test code ...
 * cleanup(); // Clean up after test
 * ```
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
 *
 * These samples reflect the actual hierarchical structure of opencode
 * and oh-my-opencode configuration files, including nested sections
 * like agents, categories, and custom properties.
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
          build: { model: 'anthropic/claude-sonnet-4', piyo: 'fuga' },
          plan: { model: 'anthropic/claude-sonnet-4' },
        },
        'oh-my-opencode': {
          agents: {
            sisyphus: {
              model: 'github-copilot/claude-sonnet-4.5',
              variant: 'high',
            },
            oracle: {
              model: 'github-copilot/gpt-5.2',
              variant: 'high',
              piyo: 'fuga',
            },
          },
          categories: {
            'visual-engineering': {
              model: 'github-copilot/gemini-3-pro',
              variant: 'max',
            },
            quick: { model: 'github-copilot/claude-haiku-4.5' },
          },
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
          agents: {
            sisyphus: { model: 'opencode/glm-4.7-free' },
            oracle: { model: 'opencode/glm-4.7-free' },
          },
          categories: {
            'visual-engineering': { model: 'opencode/glm-4.7-free' },
            quick: { model: 'opencode/glm-4.7-free' },
          },
        },
      },
    },
  },
  opencodeConfig: {
    model: 'anthropic/claude-sonnet-4',
    agent: {
      build: { model: 'anthropic/claude-sonnet-4', mode: 'auto', piyo: 'fuga' },
      plan: { model: 'anthropic/claude-sonnet-4' },
      summary: { model: 'anthropic/claude-haiku' },
    },
  },
  ohMyOpencodeConfig: {
    agents: {
      sisyphus: {
        model: 'github-copilot/claude-sonnet-4.5',
        variant: 'high',
        abc: 123,
      },
      oracle: { model: 'github-copilot/gpt-5.2', variant: 'high' },
    },
    categories: {
      'visual-engineering': {
        model: 'github-copilot/gemini-3-pro',
        variant: 'max',
      },
      quick: { model: 'github-copilot/claude-haiku-4.5' },
    },
  },
}
