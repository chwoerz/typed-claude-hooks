import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanupProjects, ensureBuilt, makeProject, runCli } from "./sandbox-fixture.js";

interface GeneratedSettings {
  hooks: Record<string, Array<{ hooks: Array<{ command: string }>; matcher?: string }>>;
}

describe("first run", () => {
  beforeAll(ensureBuilt);

  afterEach(cleanupProjects);

  it("scaffolds the sandbox and builds it with no arguments", () => {
    const projectDir = makeProject("tch-first-run-");
    const sandboxDir = resolve(projectDir, ".typed-claude-hooks");

    const output = runCli(projectDir);

    expect(output).toContain("Created .typed-claude-hooks/hooks.config.ts");
    expect(output).not.toContain("Installing");

    expect(existsSync(resolve(sandboxDir, "tsconfig.json"))).toBe(true);
    expect(readFileSync(resolve(sandboxDir, ".gitignore"), "utf8")).toBe("node_modules/\n");

    const managedDir = resolve(projectDir, ".claude/hooks/typed-claude-hooks/PreToolUse");
    expect(existsSync(resolve(managedDir, "protectEnvFiles.mjs"))).toBe(true);
    expect(existsSync(resolve(managedDir, "protectEnvFiles.sh"))).toBe(true);

    const settings = JSON.parse(
      readFileSync(resolve(projectDir, ".claude/settings.json"), "utf-8"),
    ) as GeneratedSettings;
    expect(settings.hooks.PreToolUse).toHaveLength(1);
    expect(settings.hooks.PreToolUse[0].matcher).toBe("Write|Edit");
    expect(settings.hooks.PreToolUse[0].hooks[0].command).toContain("protectEnvFiles.sh");
  });

  it("is idempotent — a second run creates nothing new", () => {
    const projectDir = makeProject("tch-first-run-");
    writeFileSync(resolve(projectDir, ".typed-claude-hooks/marker.txt"), "keep");

    runCli(projectDir);
    const firstSettings = readFileSync(resolve(projectDir, ".claude/settings.json"), "utf-8");
    const secondOutput = runCli(projectDir);

    expect(secondOutput).not.toContain("Created");
    expect(readFileSync(resolve(projectDir, ".claude/settings.json"), "utf-8")).toBe(firstSettings);
    expect(readFileSync(resolve(projectDir, ".typed-claude-hooks/marker.txt"), "utf8")).toBe("keep");
  });
});
