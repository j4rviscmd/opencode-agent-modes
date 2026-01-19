import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  parse as parseJsonc,
  modify,
  applyEdits,
  type ModificationOptions,
} from 'jsonc-parser'
import type {
  ModeSwitcherConfig,
  OpencodeConfig,
  OhMyOpencodeConfig,
} from './types.ts'

/**
 * Cache for original file content to preserve comments on save
 */
const originalContentCache = new Map<string, string>()

/**
 * Formatting options for jsonc-parser modify
 */
const modifyOptions: ModificationOptions = {
  formattingOptions: {
    tabSize: 2,
    insertSpaces: true,
    eol: '\n',
  },
}

/**
 * Expands tilde (~) notation to the user's home directory path.
 *
 * @param path - File path that may contain ~ prefix
 * @returns Expanded absolute path with ~ replaced by home directory
 * @example
 * ```typescript
 * expandPath('~/config/settings.json')
 * // Returns: '/Users/username/config/settings.json'
 * ```
 */
export function expandPath(path: string): string {
  if (path.startsWith('~/')) {
    return join(homedir(), path.slice(2))
  }
  return path
}

/**
 * Get the absolute path to the plugin configuration file.
 *
 * @returns Absolute path to agent-mode-switcher.json
 */
export function getPluginConfigPath(): string {
  return expandPath('~/.config/opencode/agent-mode-switcher.json')
}

/**
 * Get the absolute path to the opencode configuration file.
 *
 * @returns Absolute path to opencode.json
 */
export function getOpencodeConfigPath(): string {
  return expandPath('~/.config/opencode/opencode.json')
}

/**
 * Get the absolute path to the oh-my-opencode configuration file.
 *
 * @returns Absolute path to oh-my-opencode.json
 */
export function getOhMyOpencodeConfigPath(): string {
  return expandPath('~/.config/opencode/oh-my-opencode.json')
}

/**
 * JSON path represented as an array of property keys and array indices.
 */
type JsonPath = (string | number)[]

/**
 * Get a value at a specified JSON path from an object.
 *
 * @param obj - The object to traverse
 * @param path - Array of property keys/indices representing the path
 * @returns The value at the specified path, or undefined if not found
 * @example
 * ```typescript
 * const data = { user: { name: 'Alice', age: 30 } };
 * getValueAtPath(data, ['user', 'name']); // Returns: 'Alice'
 * ```
 */
function getValueAtPath(obj: unknown, path: JsonPath): unknown {
  let current = obj
  for (const key of path) {
    if (current === null || current === undefined) {
      return undefined
    }
    if (typeof current === 'object') {
      current = (current as Record<string | number, unknown>)[key]
    } else {
      return undefined
    }
  }
  return current
}

/**
 * Performs deep equality comparison of two JSON values.
 * Handles primitives, arrays, and objects recursively.
 *
 * @param a - First value to compare
 * @param b - Second value to compare
 * @returns True if values are deeply equal, false otherwise
 * @example
 * ```typescript
 * deepEqual({ a: 1, b: [2, 3] }, { a: 1, b: [2, 3] }); // Returns: true
 * deepEqual({ a: 1 }, { a: 2 }); // Returns: false
 * ```
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null) return a === b
  if (typeof a !== typeof b) return false
  if (typeof a !== 'object') return a === b

  if (Array.isArray(a) !== Array.isArray(b)) return false

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((item, index) => deepEqual(item, b[index]))
  }

  const aObj = a as Record<string, unknown>
  const bObj = b as Record<string, unknown>
  const aKeys = Object.keys(aObj)
  const bKeys = Object.keys(bObj)

  if (aKeys.length !== bKeys.length) return false
  return aKeys.every((key) => deepEqual(aObj[key], bObj[key]))
}

/**
 * Update leaf values recursively while preserving JSONC comments.
 *
 * This function traverses the new data structure and applies jsonc-parser's
 * modify() only to leaf values (primitives and arrays), keeping the original
 * file structure and comments intact. Unchanged values are skipped to preserve
 * their associated comments.
 *
 * @param content - Original JSONC file content with comments
 * @param basePath - Current JSON path being processed
 * @param newValue - New value to set at the path
 * @param originalData - Parsed original data for comparison
 * @returns Updated JSONC content with preserved comments
 * @example
 * ```typescript
 * const content = '{\n  // Important setting\n  "mode": "performance"\n}';
 * const original = { mode: 'performance' };
 * const result = updateLeafValues(content, ['mode'], 'economy', original);
 * // Preserves the comment while updating the value
 * ```
 */
function updateLeafValues(
  content: string,
  basePath: JsonPath,
  newValue: unknown,
  originalData: unknown
): string {
  const originalValue = getValueAtPath(originalData, basePath)

  // Skip if value hasn't changed (preserves comments for unchanged properties)
  if (deepEqual(originalValue, newValue)) {
    return content
  }

  // Null or primitive types are leaf values
  if (newValue === null || typeof newValue !== 'object') {
    const edits = modify(content, basePath, newValue, modifyOptions)
    return applyEdits(content, edits)
  }

  // Arrays: replace the entire array (only if changed)
  if (Array.isArray(newValue)) {
    const edits = modify(content, basePath, newValue, modifyOptions)
    return applyEdits(content, edits)
  }

  // Object: recursively update each property
  const obj = newValue as Record<string, unknown>
  let result = content

  for (const key of Object.keys(obj)) {
    result = updateLeafValues(
      result,
      [...basePath, key],
      obj[key],
      originalData
    )
  }

  return result
}

/**
 * Load a JSONC configuration file using Bun.file.
 *
 * Parses JSONC (JSON with comments) and caches the original content
 * for comment preservation during subsequent saves.
 *
 * @param filePath - Absolute path to the JSON/JSONC file
 * @returns Parsed configuration object, or null if file doesn't exist or fails to parse
 * @example
 * ```typescript
 * const config = await loadJsonFile<OpencodeConfig>('/path/to/config.json');
 * if (config) {
 *   console.log(config.agents);
 * }
 * ```
 */
async function loadJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const file = Bun.file(filePath)
    const exists = await file.exists()
    if (!exists) {
      return null
    }
    const content = await file.text()

    // Cache original content for later save
    originalContentCache.set(filePath, content)

    return parseJsonc(content) as T
  } catch {
    return null
  }
}

/**
 * Save a JSONC configuration file while preserving comments and formatting.
 *
 * Uses jsonc-parser's modify/applyEdits to intelligently update only changed
 * values, preserving existing comments and structure. If no cached content exists
 * (first save), creates new formatted JSON.
 *
 * @param filePath - Absolute path to the JSON/JSONC file
 * @param data - Configuration object to save
 * @throws {Error} If file write fails
 * @example
 * ```typescript
 * const config: OpencodeConfig = { agents: [...] };
 * await saveJsonFile('/path/to/config.json', config);
 * // Comments in the original file are preserved
 * ```
 */
async function saveJsonFile<T>(filePath: string, data: T): Promise<void> {
  const originalContent = originalContentCache.get(filePath)

  let content: string
  if (originalContent && data !== null && typeof data === 'object') {
    // Parse original content for comparison
    const originalData = parseJsonc(originalContent)

    // Update values while preserving comments (skips unchanged values)
    content = originalContent
    const obj = data as Record<string, unknown>
    for (const key of Object.keys(obj)) {
      content = updateLeafValues(content, [key], obj[key], originalData)
    }
    // Update cache with new content
    originalContentCache.set(filePath, content)
  } else {
    // No cached content, create new JSON
    content = JSON.stringify(data, null, 2)
    originalContentCache.set(filePath, content)
  }

  await Bun.write(filePath, content)
}

/**
 * Load the agent-mode-switcher plugin configuration.
 *
 * @returns Plugin configuration object, or null if file doesn't exist
 */
export async function loadPluginConfig(): Promise<ModeSwitcherConfig | null> {
  return loadJsonFile<ModeSwitcherConfig>(getPluginConfigPath())
}

/**
 * Save the agent-mode-switcher plugin configuration.
 *
 * @param config - Plugin configuration object to save
 */
export async function savePluginConfig(
  config: ModeSwitcherConfig
): Promise<void> {
  await saveJsonFile(getPluginConfigPath(), config)
}

/**
 * Load the opencode configuration file.
 *
 * @returns Opencode configuration object, or null if file doesn't exist
 */
export async function loadOpencodeConfig(): Promise<OpencodeConfig | null> {
  return loadJsonFile<OpencodeConfig>(getOpencodeConfigPath())
}

/**
 * Save the opencode configuration file.
 *
 * @param config - Opencode configuration object to save
 */
export async function saveOpencodeConfig(
  config: OpencodeConfig
): Promise<void> {
  await saveJsonFile(getOpencodeConfigPath(), config)
}

/**
 * Load the oh-my-opencode configuration file.
 *
 * @returns Oh-my-opencode configuration object, or null if file doesn't exist
 */
export async function loadOhMyOpencodeConfig(): Promise<OhMyOpencodeConfig | null> {
  return loadJsonFile<OhMyOpencodeConfig>(getOhMyOpencodeConfigPath())
}

/**
 * Save the oh-my-opencode configuration file.
 *
 * @param config - Oh-my-opencode configuration object to save
 */
export async function saveOhMyOpencodeConfig(
  config: OhMyOpencodeConfig
): Promise<void> {
  await saveJsonFile(getOhMyOpencodeConfigPath(), config)
}

/**
 * Check if the plugin configuration file exists.
 *
 * @returns True if agent-mode-switcher.json exists, false otherwise
 */
export async function pluginConfigExists(): Promise<boolean> {
  const file = Bun.file(getPluginConfigPath())
  return await file.exists()
}

/**
 * Clear the content cache for a specific file.
 * Exported for testing purposes.
 */
export function clearContentCache(filePath?: string): void {
  if (filePath) {
    originalContentCache.delete(filePath)
  } else {
    originalContentCache.clear()
  }
}

/**
 * Set cached content for a file.
 * Exported for testing purposes.
 */
export function setContentCache(filePath: string, content: string): void {
  originalContentCache.set(filePath, content)
}
