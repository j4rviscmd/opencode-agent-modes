/**
 * Type guard utilities for configuration processing.
 */

/**
 * Checks if a value is a plain object (not null, not array).
 *
 * This is used throughout the codebase to distinguish between
 * hierarchical structures and leaf values when processing
 * configurations.
 *
 * @param obj - Value to check
 * @returns True if the value is a plain object
 */
export function isObject(obj: unknown): obj is Record<string, unknown> {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj)
}
