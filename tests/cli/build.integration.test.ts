import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { build } from "../../src/cli/build.js";

const FIXTURE_CONFIG = resolve(
  import.meta.dirname,
  "../fixtures/sample-hooks.config.ts",
);
const TMP_DIR = resolve(import.meta.dirname, "../fixtures/.tmp-integration");
const SETTINGS_PATH = resolve(TMP_DIR, "settings.json");
const HOOKS_DIR = resolve(TMP_DIR, "hooks");
const MANAGED_DIR = resolve(HOOKS_DIR, "typed-claude-hooks");

describe("build command", () => {
  beforeEach(() => {
    rmSync(TMP_DIR, { recursive: true, force: true });
    mkdirSync(TMP_DIR, { recursive: true });
    writeFileSync(
      SETTINGS_PATH,
      JSON.stringify({ model: "claude-sonnet-4-6" }),
    );
  });

  afterEach(() => {
    rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it("compiles handlers and merges settings.json", async () => {
    await build({
      config: FIXTURE_CONFIG,
      output: SETTINGS_PATH,
      hooksDir: HOOKS_DIR,
    });

    expect(existsSync(resolve(MANAGED_DIR, "runtime.mjs"))).toBe(false);
    expect(
      existsSync(resolve(MANAGED_DIR, "PreToolUse/blockDangerous.mjs")),
    ).toBe(true);
    expect(existsSync(resolve(MANAGED_DIR, "Stop/onStop.mjs"))).toBe(true);
    expect(
      existsSync(resolve(MANAGED_DIR, "PreToolUse/blockDangerous.sh")),
    ).toBe(true);
    expect(existsSync(resolve(MANAGED_DIR, "Stop/onStop.sh"))).toBe(true);

    const settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
    expect(settings.model).toBe("claude-sonnet-4-6");
    expect(settings.hooks.PreToolUse).toHaveLength(1);
    expect(settings.hooks.PreToolUse[0].matcher).toBe("Bash");
    expect(settings.hooks.PreToolUse[0].hooks[0]).not.toHaveProperty(
      "__managed",
    );
    expect(settings.hooks.Stop).toHaveLength(1);
  });

  it("removes stale managed hook files", async () => {
    const staleDir = resolve(MANAGED_DIR, "PreToolUse");
    mkdirSync(staleDir, { recursive: true });
    writeFileSync(resolve(staleDir, "oldHandler.mjs"), "console.log('stale');");
    writeFileSync(resolve(staleDir, "oldHandler.sh"), "#!/bin/sh\necho stale");
    writeFileSync(
      resolve(HOOKS_DIR, "my-custom-hook.mjs"),
      "console.log('keep me');",
    );

    await build({
      config: FIXTURE_CONFIG,
      output: SETTINGS_PATH,
      hooksDir: HOOKS_DIR,
    });

    expect(existsSync(resolve(staleDir, "oldHandler.mjs"))).toBe(false);
    expect(existsSync(resolve(staleDir, "oldHandler.sh"))).toBe(false);
    expect(existsSync(resolve(HOOKS_DIR, "my-custom-hook.mjs"))).toBe(true);
    expect(
      existsSync(resolve(MANAGED_DIR, "PreToolUse/blockDangerous.mjs")),
    ).toBe(true);
    expect(
      existsSync(resolve(MANAGED_DIR, "PreToolUse/blockDangerous.sh")),
    ).toBe(true);
  });

  it("compiled handler executes correctly via Node.js", async () => {
    await build({
      config: FIXTURE_CONFIG,
      output: SETTINGS_PATH,
      hooksDir: HOOKS_DIR,
    });

    const { execSync } = await import("node:child_process");
    const stdinPayload = JSON.stringify({
      session_id: "test",
      transcript_path: "/tmp/test.jsonl",
      cwd: "/tmp",
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "ls" },
      tool_use_id: "tu_1",
    });

    const result = execSync(
      `echo '${stdinPayload}' | node ${resolve(MANAGED_DIR, "PreToolUse/blockDangerous.mjs")}`,
      { encoding: "utf-8", cwd: MANAGED_DIR },
    );

    expect(result.trim()).toBe("");
  });
});
