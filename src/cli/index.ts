#!/usr/bin/env node
import { Command, Option } from "commander";
import type { Runtime } from "../types/mapping.js";
import { build } from "./build.js";
import { init } from "./init.js";

interface BuildActionOptions {
  output: string;
  hooksDir?: string;
  runtime: Runtime;
}

interface InitActionOptions {
  output?: string;
}

function run<Args extends unknown[]>(fn: (...args: Args) => Promise<void>): (...args: Args) => void {
  return (...args) => {
    fn(...args).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${message}`);
      process.exit(1);
    });
  };
}

const program = new Command();

program.name("typed-claude-hooks").description("Type-safe Claude Code hooks in TypeScript").version("0.1.0");

program
  .command("build")
  .description("Compile hooks and merge into settings.json")
  .argument("[config]", "Path to config file", "hooks.config.ts")
  .requiredOption("-o, --output <path>", "Path to output settings.json")
  .option("--hooks-dir <dir>", "Where to write compiled JS files")
  .addOption(
    new Option("--runtime <runtime>", "JavaScript runtime to use").choices(["node", "bun", "deno"]).default("node"),
  )
  .action(run((config: string, options: BuildActionOptions) => build({ config, ...options })));

program
  .command("init")
  .description("Create a starter hooks config")
  .option("-o, --output <path>", "Target settings.json path")
  .action(run((options: InitActionOptions) => init(options)));

program.parse();
