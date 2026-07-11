import { describe, expect, it } from "vitest";
import {
  generateBashWrapper,
  generatePowerShellWrapper,
  runtimeArgs,
  runtimeCommand,
} from "../../src/compiler/wrapper-template.js";

describe("runtime commands", () => {
  it.each([
    ["node", "node", []],
    ["bun", "bun", []],
    ["deno", "deno", ["run", "--allow-all"]],
  ] as const)("maps %s to its command and arguments", (runtime, command, args) => {
    expect(runtimeCommand(runtime)).toBe(command);
    expect(runtimeArgs(runtime)).toEqual(args);
  });
});

describe("generateBashWrapper", () => {
  it.each([
    "node",
    "bun",
    "deno",
  ] as const)("checks that %s is installed with a clear error", (runtime) => {
    const code = generateBashWrapper("handler.mjs", runtime);

    expect(code).toContain(`command -v ${runtime}`);
    expect(code).toContain(`${runtime} is required but not installed`);
    expect(code).toContain("exit 2");
  });

  it("resolves the script directory, forwards arguments, and execs node", () => {
    const code = generateBashWrapper("blockRm.mjs", "node");

    expect(code).toMatch(/^#!\/usr\/bin\/env bash\n/);
    expect(code).toContain('SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"');
    expect(code).toContain('exec node "$SCRIPT_DIR/blockRm.mjs" "$@"');
  });

  it("includes Deno execution arguments", () => {
    const code = generateBashWrapper("blockRm.mjs", "deno");

    expect(code).toContain(
      'exec deno run --allow-all "$SCRIPT_DIR/blockRm.mjs" "$@"',
    );
  });
});

describe("generatePowerShellWrapper", () => {
  it.each([
    "node",
    "bun",
    "deno",
  ] as const)("checks that %s is installed with a clear error", (runtime) => {
    const code = generatePowerShellWrapper("handler.mjs", runtime);

    expect(code).toContain(`Get-Command ${runtime}`);
    expect(code).toContain(`${runtime} is required but not installed`);
    expect(code).toContain("exit 2");
  });

  it("resolves the script directory, forwards arguments, and propagates exit", () => {
    const code = generatePowerShellWrapper("blockRm.mjs", "node");

    expect(code).toContain(
      "$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path",
    );
    expect(code).toContain("& node $scriptPath @args");
    expect(code).toContain("exit $LASTEXITCODE");
  });

  it("includes Deno execution arguments", () => {
    const code = generatePowerShellWrapper("blockRm.mjs", "deno");

    expect(code).toContain("& deno run --allow-all $scriptPath @args");
  });
});
