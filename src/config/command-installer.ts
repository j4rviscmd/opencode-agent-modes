/**
 * @fileoverview Command file installer for OpenCode slash commands.
 *
 * This module handles copying slash command markdown files from the plugin's
 * commands directory to OpenCode's configuration directory during plugin
 * initialization. This ensures command files are available without requiring
 * manual postinstall script execution.
 *
 * @module config/command-installer
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Target directory for OpenCode command files.
 *
 * This is the standard location where OpenCode looks for slash command
 * markdown files: `~/.config/opencode/commands/`
 *
 * @constant
 */
const COMMANDS_DEST = join(homedir(), '.config', 'opencode', 'commands')

/**
 * Finds the commands source directory.
 *
 * Tries multiple candidate paths to support both production and development
 * environments:
 * - Production: dist/index.js -> ../commands
 * - Development: src/config/command-installer.ts -> ../../commands
 *
 * @returns Absolute path to commands directory if found, or null if not found
 */
function findCommandsDir(): string | null {
  const __dirname = dirname(fileURLToPath(import.meta.url))

  // Try multiple paths to support different build outputs
  const candidates = [
    join(__dirname, '..', 'commands'), // Production: dist/ -> commands/
    join(__dirname, '..', '..', 'commands'), // Development: src/config/ -> commands/
  ]

  return candidates.find(existsSync) ?? null
}

/**
 * Copies slash command markdown files to OpenCode's command directory.
 *
 * Creates the destination directory if needed and copies all `.md` files.
 * Non-fatal: logs warnings on failure without blocking plugin initialization.
 *
 * @returns Number of files copied, or -1 if source not found or error occurred
 */
export function copyCommandFiles(): number {
  const commandsSrc = findCommandsDir()

  // Skip if commands directory doesn't exist
  if (!commandsSrc) {
    return -1
  }

  try {
    mkdirSync(COMMANDS_DEST, { recursive: true })

    const files = readdirSync(commandsSrc).filter((f) => f.endsWith('.md'))

    for (const file of files) {
      copyFileSync(join(commandsSrc, file), join(COMMANDS_DEST, file))
    }

    return files.length
  } catch (error) {
    // Non-fatal: log warning but don't block plugin initialization
    console.warn(
      '[agent-mode-switcher] Warning: Could not copy command files:',
      error instanceof Error ? error.message : String(error)
    )
    return -1
  }
}
