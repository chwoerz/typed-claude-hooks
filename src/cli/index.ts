#!/usr/bin/env node
import { Command, Option } from "commander";
import type { Runtime } from "../types/mapping.js";
import { init } from "./init.js";
import { run } from "./run.js";
import { cliVersion } from "./version.js";

interface ActionOptions {
  output: string;
  hooksDir?: string;
  runtime: Runtime;
}

function fail(err: unknown): never {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Error: ${message}`);
  process.exit(1);
}

const program = new Command();

program
  .name("typed-claude-hooks")
  .description("Type-safe Claude Code hooks in TypeScript")
  .version(cliVersion)
  .argument("[config]", "Path to config file (defaults to the .typed-claude-hooks sandbox)")
  .option("-o, --output <path>", "Path to output settings.json", ".claude/settings.json")
  .option("--hooks-dir <dir>", "Where to write compiled JS files")
  .addOption(
    new Option("--runtime <runtime>", "JavaScript runtime to use").choices(["node", "bun", "deno"]).default("node"),
  )
  .action((config: string | undefined, options: ActionOptions) => {
    run({ config, ...options }).catch(fail);
  });

program
  .command("init")
  .description("Scaffold the sandbox and install its dependency, without building")
  .action(() => {
    try {
      init();
    } catch (err) {
      fail(err);
    }
  });

program.parse();
