import { isObject } from '../config/guards.ts'
import type { HierarchicalPreset } from '../config/types.ts'

/**
 * Checks if a value is a leaf node (has a model field).
 *
 * A leaf node represents an actual agent configuration with a `model` field,
 * as opposed to a branch node which contains nested configurations.
 *
 * @param value - The object value to check
 * @returns True if the value has a string `model` property
 */
function isLeafNode(
  value: Record<string, unknown>
): value is Record<string, unknown> & { model: string; variant?: string } {
  return 'model' in value && typeof value.model === 'string'
}

/**
 * Recursively merges model settings from preset into target config.
 *
 * This is a test utility that mirrors the logic in manager.ts for
 * testing purposes without exposing internal implementation.
 *
 * The merge strategy:
 * - Leaf nodes (with `model` field): Merges all preset properties while preserving existing ones
 * - Branch nodes: Recursively merges into nested structures
 * - Non-object values: Skipped
 *
 * @param target - The target configuration object to modify (in-place)
 * @param preset - The hierarchical preset containing model values to apply
 *
 * @example
 * ```typescript
 * const target = { agent: { build: { model: 'old', temp: 0.5 } } };
 * const preset = { agent: { build: { model: 'new', color: 'blue' } } };
 * deepMergeModel(target, preset);
 * // target.agent.build is now { model: 'new', temp: 0.5, color: 'blue' }
 * ```
 */
export function deepMergeModel(
  target: Record<string, unknown>,
  preset: HierarchicalPreset
): void {
  for (const [key, value] of Object.entries(preset)) {
    if (!isObject(value)) continue

    const actualValue = target[key]

    if (isLeafNode(value as Record<string, unknown>)) {
      const valueRecord = value as Record<string, unknown>
      const existing = (actualValue as Record<string, unknown>) ?? {}

      // Merge all preset properties (model, variant, and any future properties)
      // Existing properties are preserved, preset properties override/add them
      const merged: Record<string, unknown> = {
        ...existing,
        ...valueRecord,
      }

      target[key] = merged
    } else {
      const childTarget = (actualValue as Record<string, unknown>) ?? {}
      target[key] = childTarget
      deepMergeModel(childTarget, value as HierarchicalPreset)
    }
  }
}

/**
 * Recursively checks if actual configuration differs from expected preset.
 *
 * This is a test utility that mirrors the logic in manager.ts for
 * testing purposes without exposing internal implementation.
 *
 * Drift is detected when any preset property differs from the actual config.
 * This includes model, variant, and any future properties.
 *
 * @param actual - The actual configuration to check
 * @param expected - The expected preset configuration
 * @returns True if any preset property differs from expected
 *
 * @example
 * ```typescript
 * const actual = { agent: { build: { model: 'old' } } };
 * const expected = { agent: { build: { model: 'new' } } };
 * hasDriftRecursive(actual, expected); // true
 * ```
 */
export function hasDriftRecursive(
  actual: Record<string, unknown>,
  expected: HierarchicalPreset
): boolean {
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (!isObject(expectedValue)) continue

    const actualValue = actual[key]

    if (isLeafNode(expectedValue as Record<string, unknown>)) {
      const actualObj = actualValue as Record<string, unknown> | undefined
      if (!actualObj) {
        // Actual config missing this leaf node - drift detected
        return true
      }

      // Check all properties in the expected preset
      for (const [propKey, expectedPropValue] of Object.entries(
        expectedValue as Record<string, unknown>
      )) {
        if (actualObj[propKey] !== expectedPropValue) {
          return true
        }
      }
    } else if (
      hasDriftRecursive(
        (actualValue || {}) as Record<string, unknown>,
        expectedValue as HierarchicalPreset
      )
    ) {
      return true
    }
  }

  return false
}

/**
 * Recursively formats hierarchical configuration as a tree string.
 *
 * This is a test utility that mirrors the logic in manager.ts for
 * testing purposes without exposing internal implementation.
 *
 * Output format:
 * - Branch nodes: Display as `key:` with nested children indented
 * - Leaf nodes: Display as `key: model (variant) [otherProps]`
 *
 * @param preset - The hierarchical preset to format
 * @param indent - Indentation string for current depth (default: '  ')
 * @returns Multi-line string representation of the configuration tree
 *
 * @example
 * ```typescript
 * const preset = {
 *   agent: {
 *     build: { model: 'claude-4', temp: 0.5 },
 *     plan: { model: 'haiku', variant: 'fast' }
 *   }
 * };
 * const tree = formatHierarchicalTree(preset);
 * // Returns:
 * // agent:
 * //   build: claude-4 [temp: 0.5]
 * //   plan: haiku (fast)
 * ```
 */
export function formatHierarchicalTree(
  preset: HierarchicalPreset,
  indent = '  '
): string {
  const lines: string[] = []

  for (const [key, value] of Object.entries(preset)) {
    if (!isObject(value)) continue

    if (isLeafNode(value as Record<string, unknown>)) {
      const variant = value.variant ? ` (${value.variant})` : ''
      const otherProps = Object.keys(value)
        .filter((k) => k !== 'model' && k !== 'variant')
        .map((k) => `${k}: ${JSON.stringify(value[k])}`)
        .join(', ')
      const extra = otherProps ? ` [${otherProps}]` : ''
      lines.push(`${indent}${key}: ${value.model}${variant}${extra}`)
    } else {
      lines.push(`${indent}${key}:`)
      lines.push(
        formatHierarchicalTree(value as HierarchicalPreset, `${indent}  `)
      )
    }
  }

  return lines.join('\n')
}
