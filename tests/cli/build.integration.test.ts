import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { build } from "../../src/cli/build.js";

const FIXTURE_CONFIG = resolve(import.meta.dirname, "../fixtures/sample-hooks.config.ts");
const TMP_DIR = resolve(import.meta.dirname, "../fixtures/.tmp-integration");
const SETTINGS_PATH = resolve(TMP_DIR, "settings.json");
const HOOKS_DIR = resolve(TMP_DIR, "hooks");
const MANAGED_DIR = resolve(HOOKS_DIR, "typed-claude-hooks");
const CLI_PATH = resolve(import.meta.dirname, "../../src/cli/index.ts");

function runCli(runtime?: "bun" | "deno"): string {
  const runtimeArgs = runtime ? ["--runtime", runtime] : [];
  execFileSync(
    process.execPath,
    ["--import", "tsx", CLI_PATH, FIXTURE_CONFIG, "--output", SETTINGS_PATH, "--hooks-dir", HOOKS_DIR, ...runtimeArgs],
    { cwd: process.cwd() },
  );
  return readFileSync(resolve(MANAGED_DIR, "PreToolUse/blockDangerous.sh"), "utf-8");
}

interface GeneratedSettings {
  hooks: Record<string, Array<{ hooks: Array<{ command: string }>; matcher?: string }>>;
  model: string;
}

describe("build command", () => {
  beforeEach(() => {
    rmSync(TMP_DIR, { recursive: true, force: true });
    mkdirSync(TMP_DIR, { recursive: true });
    writeFileSync(SETTINGS_PATH, JSON.stringify({ model: "claude-sonnet-4-6" }));
  });

  afterEach(() => {
    rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it("uses Node wrappers when --runtime is omitted", () => {
    const wrapper = runCli();

    expect(wrapper).toContain("command -v node");
    expect(wrapper).toContain('exec node "$SCRIPT_DIR/blockDangerous.mjs" "$@"');
  });

  it.each([
    ["deno", 'exec deno run --allow-all "$SCRIPT_DIR/blockDangerous.mjs" "$@"'],
    ["bun", 'exec bun "$SCRIPT_DIR/blockDangerous.mjs" "$@"'],
  ] as const)("uses %s wrappers for --runtime %s", (runtime, invocation) => {
    const wrapper = runCli(runtime);

    expect(wrapper).toContain(`command -v ${runtime}`);
    expect(wrapper).toContain(invocation);
  });

  it("compiles handlers and merges settings.json", async () => {
    await build({
      config: FIXTURE_CONFIG,
      output: SETTINGS_PATH,
      hooksDir: HOOKS_DIR,
    });

    expect(existsSync(resolve(MANAGED_DIR, "runtime.mjs"))).toBe(false);
    expect(existsSync(resolve(MANAGED_DIR, "PreToolUse/blockDangerous.mjs"))).toBe(true);
    expect(existsSync(resolve(MANAGED_DIR, "Stop/onStop.mjs"))).toBe(true);
    expect(existsSync(resolve(MANAGED_DIR, "PreToolUse/blockDangerous.sh"))).toBe(true);
    expect(existsSync(resolve(MANAGED_DIR, "Stop/onStop.sh"))).toBe(true);

    const settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8")) as GeneratedSettings;
    expect(settings.model).toBe("claude-sonnet-4-6");
    expect(settings.hooks.PreToolUse).toHaveLength(1);
    expect(settings.hooks.PreToolUse[0].matcher).toBe("Bash");
    expect(settings.hooks.PreToolUse[0].hooks[0]).not.toHaveProperty("__managed");
    expect(settings.hooks.Stop).toHaveLength(1);
    const commands = Object.values(settings.hooks).flatMap((matchers) =>
      matchers.flatMap((matcher) => matcher.hooks.map((hook) => hook.command)),
    );
    expect(commands).toEqual(
      expect.arrayContaining([expect.stringMatching(/^".*\.sh"$/), expect.stringMatching(/^".*\.sh"$/)]),
    );
    expect(commands.every((command: string) => !command.includes(".mjs"))).toBe(true);
    expect(commands.every((command: string) => !/^(node|bun|deno)(?:\s|$)/.test(command))).toBe(true);
  });

  it("removes stale managed hook files", async () => {
    const staleDir = resolve(MANAGED_DIR, "PreToolUse");
    mkdirSync(staleDir, { recursive: true });
    writeFileSync(resolve(staleDir, "oldHandler.mjs"), "console.log('stale');");
    writeFileSync(resolve(staleDir, "oldHandler.sh"), "#!/bin/sh\necho stale");
    writeFileSync(resolve(HOOKS_DIR, "my-custom-hook.mjs"), "console.log('keep me');");

    await build({
      config: FIXTURE_CONFIG,
      output: SETTINGS_PATH,
      hooksDir: HOOKS_DIR,
    });

    expect(existsSync(resolve(staleDir, "oldHandler.mjs"))).toBe(false);
    expect(existsSync(resolve(staleDir, "oldHandler.sh"))).toBe(false);
    expect(existsSync(resolve(HOOKS_DIR, "my-custom-hook.mjs"))).toBe(true);
    expect(existsSync(resolve(MANAGED_DIR, "PreToolUse/blockDangerous.mjs"))).toBe(true);
    expect(existsSync(resolve(MANAGED_DIR, "PreToolUse/blockDangerous.sh"))).toBe(true);
  });

  it("recursively removes every unexpected entry in the managed directory", async () => {
    const unexpectedPaths = [
      resolve(MANAGED_DIR, "stale.cjs"),
      resolve(MANAGED_DIR, "arbitrary"),
      resolve(MANAGED_DIR, "nested/deep/stale.txt"),
    ];
    mkdirSync(resolve(MANAGED_DIR, "nested/deep"), { recursive: true });
    writeFileSync(unexpectedPaths[0], "stale");
    mkdirSync(unexpectedPaths[1]);
    writeFileSync(unexpectedPaths[2], "stale");

    await build({
      config: FIXTURE_CONFIG,
      output: SETTINGS_PATH,
      hooksDir: HOOKS_DIR,
    });

    expect(unexpectedPaths.map((path) => existsSync(path))).toEqual([false, false, false]);
    expect(existsSync(resolve(MANAGED_DIR, "PreToolUse/blockDangerous.mjs"))).toBe(true);
  });

  it("never removes entries outside the exact managed directory", async () => {
    const outsidePath = resolve(HOOKS_DIR, "outside/nested/custom.cjs");
    mkdirSync(resolve(HOOKS_DIR, "outside/nested"), { recursive: true });
    writeFileSync(outsidePath, "preserve");
    mkdirSync(resolve(MANAGED_DIR, "nested"), { recursive: true });
    writeFileSync(resolve(MANAGED_DIR, "nested/stale.cjs"), "remove");

    await build({
      config: FIXTURE_CONFIG,
      output: SETTINGS_PATH,
      hooksDir: HOOKS_DIR,
    });

    expect(readFileSync(outsidePath, "utf-8")).toBe("preserve");
    expect(existsSync(resolve(MANAGED_DIR, "PreToolUse/blockDangerous.mjs"))).toBe(true);
  });

  it("preserves a similarly named directory outside the managed path", async () => {
    const outsidePath = resolve(HOOKS_DIR, "typed-claude-hooks-backup/preserve.cjs");
    mkdirSync(resolve(HOOKS_DIR, "typed-claude-hooks-backup"), {
      recursive: true,
    });
    writeFileSync(outsidePath, "preserve");

    await build({
      config: FIXTURE_CONFIG,
      output: SETTINGS_PATH,
      hooksDir: HOOKS_DIR,
    });

    expect(readFileSync(outsidePath, "utf-8")).toBe("preserve");
  });

  it("replaces a managed-directory symlink without touching its outside target", async () => {
    const outsideDir = resolve(TMP_DIR, "outside-target");
    const outsidePath = resolve(outsideDir, "preserve.txt");
    mkdirSync(HOOKS_DIR, { recursive: true });
    mkdirSync(outsideDir);
    writeFileSync(outsidePath, "preserve");
    symlinkSync(outsideDir, MANAGED_DIR, "dir");

    await build({
      config: FIXTURE_CONFIG,
      output: SETTINGS_PATH,
      hooksDir: HOOKS_DIR,
    });

    expect(readFileSync(outsidePath, "utf-8")).toBe("preserve");
    expect(lstatSync(MANAGED_DIR).isSymbolicLink()).toBe(false);
    expect(existsSync(resolve(MANAGED_DIR, "PreToolUse/blockDangerous.mjs"))).toBe(true);
  });

  it("writes identical settings on repeated builds", async () => {
    const options = {
      config: FIXTURE_CONFIG,
      output: SETTINGS_PATH,
      hooksDir: HOOKS_DIR,
    };

    await build(options);
    const firstSettings = readFileSync(SETTINGS_PATH, "utf-8");
    await build(options);

    expect(readFileSync(SETTINGS_PATH, "utf-8")).toBe(firstSettings);
  });

  it("rewrites valid generated artifacts on a successful rebuild", async () => {
    const options = {
      config: FIXTURE_CONFIG,
      output: SETTINGS_PATH,
      hooksDir: HOOKS_DIR,
    };
    await build(options);
    const artifactPath = resolve(MANAGED_DIR, "PreToolUse/blockDangerous.mjs");
    const originalArtifactPath = resolve(TMP_DIR, "original-artifact.mjs");
    linkSync(artifactPath, originalArtifactPath);

    await build(options);

    expect(statSync(artifactPath).ino).not.toBe(statSync(originalArtifactPath).ino);
    expect(lstatSync(resolve(MANAGED_DIR, "PreToolUse/blockDangerous.sh")).mode & 0o777).toBe(0o755);
  });

  it("does not mutate hooks when settings JSON is malformed", async () => {
    const stalePath = resolve(MANAGED_DIR, "nested/stale.cjs");
    mkdirSync(resolve(MANAGED_DIR, "nested"), { recursive: true });
    writeFileSync(stalePath, "preserve after parse failure");
    writeFileSync(SETTINGS_PATH, "{ malformed");

    await expect(
      build({
        config: FIXTURE_CONFIG,
        output: SETTINGS_PATH,
        hooksDir: HOOKS_DIR,
      }),
    ).rejects.toThrow(`Failed to parse ${SETTINGS_PATH}`);

    expect(readFileSync(stalePath, "utf-8")).toBe("preserve after parse failure");
    expect(readFileSync(SETTINGS_PATH, "utf-8")).toBe("{ malformed");
  });

  it("does not mutate hooks when config loading fails", async () => {
    const stalePath = resolve(MANAGED_DIR, "nested/stale.cjs");
    const malformedConfig = resolve(TMP_DIR, "malformed.config.ts");
    mkdirSync(resolve(MANAGED_DIR, "nested"), { recursive: true });
    writeFileSync(stalePath, "preserve after config failure");
    writeFileSync(malformedConfig, "export const broken = ;");

    await expect(
      build({
        config: malformedConfig,
        output: SETTINGS_PATH,
        hooksDir: HOOKS_DIR,
      }),
    ).rejects.toThrow();

    expect(readFileSync(stalePath, "utf-8")).toBe("preserve after config failure");
  });

  it.each(["--dry-run", "--clean"])("rejects removed %s option", (option) => {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", CLI_PATH, FIXTURE_CONFIG, "--output", SETTINGS_PATH, option],
      { cwd: process.cwd(), encoding: "utf-8" },
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(`unknown option '${option}'`);
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

    const result = execSync(`echo '${stdinPayload}' | node ${resolve(MANAGED_DIR, "PreToolUse/blockDangerous.mjs")}`, {
      encoding: "utf-8",
      cwd: MANAGED_DIR,
    });

    expect(result.trim()).toBe("");
  });

  it("builds by default and exposes only the init subcommand", () => {
    const result = spawnSync(process.execPath, ["--import", "tsx", CLI_PATH, "--help"], {
      cwd: process.cwd(),
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[config]");
    expect(result.stdout).toContain(".claude/settings.json");
    expect(result.stdout).toContain("init");
    expect(result.stdout).not.toContain("build [config]");
  });
});
