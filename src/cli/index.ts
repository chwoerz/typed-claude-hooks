#!/usr/bin/env node
import { Command, Option } from "commander";
import type { Runtime } from "../compiler/bundle-handlers.js";
import { build } from "./build.js";
import { init } from "./init.js";

function run(
  fn: (...args: unknown[]) => Promise<void>,
): (...args: unknown[]) => void {
  return (...args) => {
    fn(...args).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${message}`);
      process.exit(1);
    });
  };
}

const program = new Command();

program
  .name("typed-claude-hooks")
  .description("Type-safe Claude Code hooks in TypeScript")
  .version("0.1.0");

program
  .command("build")
  .description("Compile hooks and merge into settings.json")
  .argument("[config]", "Path to config file", "hooks.config.ts")
  .requiredOption("-o, --output <path>", "Path to output settings.json")
  .option("--hooks-dir <dir>", "Where to write compiled JS files")
  .addOption(
    new Option("--runtime <runtime>", "JavaScript runtime to use")
      .choices(["node", "bun", "deno"])
      .default("node"),
  )
  .option("--dry-run", "Print output without writing", false)
  .option("--clean", "Remove generated files before building", false)
  .action(
    run((config: unknown, opts: unknown) => {
      const { output, hooksDir, runtime, dryRun, clean } = opts as Record<
        string,
        unknown
      >;
      return build({
        config: config as string,
        output: output as string,
        hooksDir: hooksDir as string | undefined,
        runtime: runtime as Runtime | undefined,
        dryRun: dryRun as boolean | undefined,
        clean: clean as boolean | undefined,
      });
    }),
  );

program
  .command("init")
  .description("Create a starter hooks config")
  .option("-o, --output <path>", "Target settings.json path")
  .action(
    run((opts: unknown) => {
      const { output } = opts as Record<string, unknown>;
      return init({ output: output as string | undefined });
    }),
  );

program.parse();
