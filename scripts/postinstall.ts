#!/usr/bin/env node

/**
 * Postinstall script for opencode-agent-modes
 *
 * Copies command files to ~/.config/opencode/command/
 * Uses Node.js standard APIs only for Bun/Node compatibility.
 */

import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Directory path constants for command file installation
 *
 * - __dirname: Resolves to the directory containing this script
 * - COMMANDS_SRC: Source directory containing command markdown files
 * - COMMANDS_DEST: Target directory in user's OpenCode config
 */
const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMANDS_SRC = join(__dirname, "..", "commands");
const COMMANDS_DEST = join(homedir(), ".config", "opencode", "command");

try {
  // Ensure destination directory exists, creating parent directories if needed
  mkdirSync(COMMANDS_DEST, { recursive: true });

  // Find all markdown files in the commands directory
  const files = readdirSync(COMMANDS_SRC).filter((f) => f.endsWith(".md"));

  // Copy each command file to the OpenCode config directory
  for (const file of files) {
    copyFileSync(join(COMMANDS_SRC, file), join(COMMANDS_DEST, file));
  }

  console.log(
    `[opencode-agent-modes] Copied ${files.length} command files to ${COMMANDS_DEST}`,
  );
} catch (error) {
  // Non-fatal: do not block npm install on copy failure
  console.warn(
    "[opencode-agent-modes] Warning: Could not copy command files:",
    error,
  );
}
