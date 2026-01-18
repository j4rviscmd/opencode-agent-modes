import { homedir } from "node:os";
import { join } from "node:path";
import type {
  ModeSwitcherConfig,
  OpencodeConfig,
  OhMyOpencodeConfig,
} from "./types.ts";

/**
 * Expands ~ to home directory
 */
export function expandPath(path: string): string {
  if (path.startsWith("~/")) {
    return join(homedir(), path.slice(2));
  }
  return path;
}

/**
 * Get the plugin configuration file path
 */
export function getPluginConfigPath(): string {
  return expandPath("~/.config/opencode/agent-mode-switcher.json");
}

/**
 * Get the opencode configuration file path
 */
export function getOpencodeConfigPath(): string {
  return expandPath("~/.config/opencode/opencode.json");
}

/**
 * Get the oh-my-opencode configuration file path
 */
export function getOhMyOpencodeConfigPath(): string {
  return expandPath("~/.config/opencode/oh-my-opencode.json");
}

/**
 * Load a JSON configuration file using Bun.file
 */
async function loadJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const file = Bun.file(filePath);
    const exists = await file.exists();
    if (!exists) {
      return null;
    }
    const content = await file.text();
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Save a JSON configuration file using Bun.write
 */
async function saveJsonFile<T>(filePath: string, data: T): Promise<void> {
  const content = JSON.stringify(data, null, 2);
  await Bun.write(filePath, content);
}

/**
 * Load the plugin configuration
 */
export async function loadPluginConfig(): Promise<ModeSwitcherConfig | null> {
  return loadJsonFile<ModeSwitcherConfig>(getPluginConfigPath());
}

/**
 * Save the plugin configuration
 */
export async function savePluginConfig(
  config: ModeSwitcherConfig
): Promise<void> {
  await saveJsonFile(getPluginConfigPath(), config);
}

/**
 * Load the opencode configuration
 */
export async function loadOpencodeConfig(): Promise<OpencodeConfig | null> {
  return loadJsonFile<OpencodeConfig>(getOpencodeConfigPath());
}

/**
 * Load the oh-my-opencode configuration
 */
export async function loadOhMyOpencodeConfig(): Promise<OhMyOpencodeConfig | null> {
  return loadJsonFile<OhMyOpencodeConfig>(getOhMyOpencodeConfigPath());
}

/**
 * Save the oh-my-opencode configuration
 */
export async function saveOhMyOpencodeConfig(
  config: OhMyOpencodeConfig
): Promise<void> {
  await saveJsonFile(getOhMyOpencodeConfigPath(), config);
}

/**
 * Check if the plugin configuration exists
 */
export async function pluginConfigExists(): Promise<boolean> {
  const file = Bun.file(getPluginConfigPath());
  return await file.exists();
}
