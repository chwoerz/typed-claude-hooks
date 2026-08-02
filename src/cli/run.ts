import { resolve } from "node:path";
import type { Runtime } from "../types/mapping.js";
import { build } from "./build.js";
import { ensureSandbox } from "./sandbox.js";
import { CONFIG_FILE_NAME, SANDBOX_DIR } from "./sandbox-templates.js";

export interface RunOptions {
  config?: string;
  output: string;
  hooksDir?: string;
  runtime?: Runtime;
  ensure?: (sandboxDir: string) => void;
}

export async function run(options: RunOptions): Promise<void> {
  const { config, ensure = (sandboxDir: string) => ensureSandbox({ sandboxDir }), ...buildOptions } = options;

  if (config) {
    await build({ ...buildOptions, config: resolve(config) });
    return;
  }

  const sandboxDir = resolve(SANDBOX_DIR);
  ensure(sandboxDir);
  await build({ ...buildOptions, config: resolve(sandboxDir, CONFIG_FILE_NAME) });
}
