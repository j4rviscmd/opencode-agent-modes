import { tool } from "@opencode-ai/plugin";
import type { Plugin } from "@opencode-ai/plugin";
import { ModeManager } from "./modes/index.ts";

/**
 * OpenCode Agent Mode Switcher Plugin
 *
 * Allows switching between different agent mode presets (e.g., performance vs economy)
 * that configure which AI models are used for each agent type.
 */
const modeSwitcherPlugin: Plugin = async ({ client }) => {
  // Lazy initialization - don't block plugin load
  let modeManager: ModeManager | null = null;

  const getManager = async (): Promise<ModeManager> => {
    if (!modeManager) {
      modeManager = new ModeManager(client);
      await modeManager.initialize();
    }
    return modeManager;
  };

  return {
    tool: {
      /**
       * Switch to a different agent mode preset
       */
      mode_switch: tool({
        description: "Switch agent mode to a specified preset",
        args: {
          mode: tool.schema
            .string()
            .describe("Name of the mode preset to switch to"),
        },
        async execute({ mode }) {
          const manager = await getManager();
          return await manager.switchMode(mode);
        },
      }),

      /**
       * Display current agent mode and configuration
       */
      mode_status: tool({
        description: "Show current agent mode and its configuration",
        args: {},
        async execute() {
          const manager = await getManager();
          return await manager.getStatus();
        },
      }),

      /**
       * List all available mode presets
       */
      mode_list: tool({
        description: "List all available mode presets",
        args: {},
        async execute() {
          const manager = await getManager();
          return await manager.listModes();
        },
      }),
    },
  };
};

export default modeSwitcherPlugin;
