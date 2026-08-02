import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanupProjects, ensureBuilt, makeProject, PACKAGE_ROOT, runCli } from "./sandbox-fixture.js";

function runInit(cwd: string): string {
  return runCli(cwd, ["init"]);
}

describe("init command", () => {
  beforeAll(ensureBuilt);

  afterEach(cleanupProjects);

  it("scaffolds the sandbox without building", () => {
    const projectDir = makeProject("tch-init-");

    const output = runInit(projectDir);

    expect(output).toContain("Created .typed-claude-hooks/hooks.config.ts");
    expect(output).toContain("Build with: npx typed-claude-hooks");

    const sandboxDir = resolve(projectDir, ".typed-claude-hooks");
    const config = readFileSync(resolve(sandboxDir, "hooks.config.ts"), "utf8");
    expect(config).toMatch(/export const protectEnvFiles = defineHandler\("PreToolUse"/);
    expect(existsSync(resolve(sandboxDir, "tsconfig.json"))).toBe(true);
    expect(existsSync(resolve(sandboxDir, ".gitignore"))).toBe(true);

    expect(existsSync(resolve(projectDir, ".claude"))).toBe(false);
  });

  it("reports skipped files and overwrites nothing on a second run", () => {
    const projectDir = makeProject("tch-init-");
    runInit(projectDir);
    const configPath = resolve(projectDir, ".typed-claude-hooks/hooks.config.ts");
    writeFileSync(configPath, "// mine\n");

    const output = runInit(projectDir);

    expect(output).toContain("Skipped .typed-claude-hooks/hooks.config.ts (exists)");
    expect(output).toContain("Skipped .typed-claude-hooks/tsconfig.json (exists)");
    expect(output).not.toContain("Created");
    expect(readFileSync(configPath, "utf8")).toBe("// mine\n");
  });

  it("scaffolds a config that typechecks against the installed package", () => {
    const projectDir = makeProject("tch-init-");
    runInit(projectDir);

    execFileSync(
      process.execPath,
      [
        resolve(PACKAGE_ROOT, "node_modules/typescript/bin/tsc"),
        "--noEmit",
        "--project",
        resolve(projectDir, ".typed-claude-hooks"),
      ],
      { cwd: projectDir },
    );
  });
});
