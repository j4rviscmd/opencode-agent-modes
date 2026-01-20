import { copyFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Target directory for OpenCode command files
 */
const COMMANDS_DEST = join(homedir(), ".config", "opencode", "command");

/**
 * Copies slash command markdown files to OpenCode's command directory.
 *
 * This function is called during plugin initialization to ensure
 * command files are available without manual postinstall execution.
 *
 * @returns Number of files copied, or -1 if source directory not found
 */
export function copyCommandFiles(): number {
  // Resolve the commands directory relative to this file
  // In dist: dist/config/command-installer.js -> dist/../commands = commands/
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const commandsSrc = join(__dirname, "..", "..", "commands");

  // Skip if commands directory doesn't exist (shouldn't happen in production)
  if (!existsSync(commandsSrc)) {
    console.warn(
      "[agent-mode-switcher] Commands directory not found:",
      commandsSrc
    );
    return -1;
  }

  try {
    // Ensure destination directory exists
    mkdirSync(COMMANDS_DEST, { recursive: true });

    // Find all markdown files in the commands directory
    const files = readdirSync(commandsSrc).filter((f) => f.endsWith(".md"));

    // Copy each command file to the OpenCode config directory
    for (const file of files) {
      copyFileSync(join(commandsSrc, file), join(COMMANDS_DEST, file));
    }

    return files.length;
  } catch (error) {
    // Non-fatal: log warning but don't block plugin initialization
    console.warn(
      "[agent-mode-switcher] Warning: Could not copy command files:",
      error instanceof Error ? error.message : String(error)
    );
    return -1;
  }
}
