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

import { copyFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Target directory for OpenCode command files.
 *
 * This is the standard location where OpenCode looks for slash command
 * markdown files: `~/.config/opencode/command/`
 *
 * @constant
 */
const COMMANDS_DEST = join(homedir(), '.config', 'opencode', 'command')

/**
 * Finds the commands source directory.
 *
 * Tries multiple candidate paths to support both production and development
 * environments by checking relative paths from the current module location:
 * - Production: bundled dist/index.js -> ../commands
 * - Development: src/config/command-installer.ts -> ../../commands
 *
 * The function checks each candidate path in order and returns the first
 * one that exists on the filesystem.
 *
 * @returns Absolute path to commands directory if found, or null if none
 *          of the candidate paths exist
 *
 * @example
 * ```typescript
 * const commandsDir = findCommandsDir();
 * if (commandsDir) {
 *   console.log(`Commands found at: ${commandsDir}`);
 * } else {
 *   console.log('Commands directory not found');
 * }
 * ```
 */
function findCommandsDir(): string | null {
  const __dirname = dirname(fileURLToPath(import.meta.url))

  // Try multiple paths to support different build outputs
  const candidates = [
    join(__dirname, '..', 'commands'),       // Production: dist/ -> commands/
    join(__dirname, '..', '..', 'commands'), // Development: src/config/ -> commands/
  ]

  return candidates.find(existsSync) ?? null
}

/**
 * Copies slash command markdown files to OpenCode's command directory.
 *
 * This function is called during plugin initialization to ensure
 * command files are available without manual postinstall execution.
 * It creates the destination directory if it doesn't exist and copies
 * all `.md` files from the source commands directory.
 *
 * The function is designed to be non-fatal: if copying fails (e.g., due to
 * permission issues), it logs a warning but doesn't throw an error,
 * allowing the plugin to continue initializing.
 *
 * @returns Number of files successfully copied, or -1 if source directory
 *          not found or an error occurred during copying
 *
 * @example
 * ```typescript
 * const copied = copyCommandFiles();
 * if (copied > 0) {
 *   console.log(`Copied ${copied} command files`);
 * }
 * ```
 */
export function copyCommandFiles(): number {
  const commandsSrc = findCommandsDir()

  // Skip if commands directory doesn't exist
  if (!commandsSrc) {
    return -1
  }

  try {
    // Create destination directory with parents if needed
    mkdirSync(COMMANDS_DEST, { recursive: true })

    // Filter only markdown files
    const files = readdirSync(commandsSrc).filter((f) => f.endsWith('.md'))

    // Copy each command file to the destination
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
