import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const PACKAGE_ROOT = resolve(import.meta.dirname, "../..");
const CLI_PATH = resolve(PACKAGE_ROOT, "src/cli/index.ts");
// An absolute path is required here (rather than the bare "tsx" specifier used
// elsewhere): Node resolves a bare --import specifier from the child process's cwd,
// which for this test is a temp project directory with no node_modules of its own.
const TSX_LOADER = resolve(PACKAGE_ROOT, "node_modules/tsx/dist/loader.mjs");
const tempDirs: string[] = [];

function makeProject(): string {
  const tempDir = mkdtempSync(resolve(tmpdir(), "tch-init-"));
  tempDirs.push(tempDir);

  const sandboxDir = resolve(tempDir, ".typed-claude-hooks");
  const modulesDir = resolve(sandboxDir, "node_modules");
  mkdirSync(modulesDir, { recursive: true });
  symlinkSync(PACKAGE_ROOT, resolve(modulesDir, "typed-claude-hooks"), "dir");
  writeFileSync(
    resolve(sandboxDir, "package.json"),
    JSON.stringify({
      name: "typed-claude-hooks-config",
      private: true,
      type: "module",
      dependencies: { "typed-claude-hooks": `file:${PACKAGE_ROOT}` },
    }),
  );
  return tempDir;
}

function runInit(cwd: string): string {
  return execFileSync(process.execPath, ["--import", TSX_LOADER, CLI_PATH, "init"], { cwd, encoding: "utf-8" });
}

describe("init command", () => {
  afterEach(() => {
    for (const path of tempDirs) {
      rmSync(path, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it("scaffolds the sandbox without building", () => {
    const projectDir = makeProject();

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
    const projectDir = makeProject();
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
    const projectDir = makeProject();
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
