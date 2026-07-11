import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const CLI_PATH = resolve(import.meta.dirname, "../../src/cli/index.ts");
const PACKAGE_ROOT = resolve(import.meta.dirname, "../..");
const TSX_LOADER = resolve(PACKAGE_ROOT, "node_modules/tsx/dist/loader.mjs");
const tempDirs: string[] = [];

describe("init command", () => {
  afterEach(() => {
    tempDirs.forEach((path) => {
      rmSync(path, { recursive: true, force: true });
    });
    tempDirs.length = 0;
  });

  it("creates a named handler scaffold that typechecks with tsc --noEmit", () => {
    const tempDir = mkdtempSync(resolve(tmpdir(), "typed-claude-hooks-init-"));
    tempDirs.push(tempDir);
    const configPath = resolve(tempDir, "hooks.config.ts");
    const tsconfigPath = resolve(tempDir, "tsconfig.json");
    writeFileSync(
      resolve(tempDir, "package.json"),
      JSON.stringify({ private: true, type: "module" }),
    );

    execFileSync(process.execPath, ["--import", TSX_LOADER, CLI_PATH, "init"], {
      cwd: tempDir,
    });

    const config = readFileSync(configPath, "utf8");
    expect(config).toMatch(
      /export const protectEnvFiles = defineHandler\("PreToolUse"/,
    );
    expect(config).not.toContain("export default");

    const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf8"));
    expect(tsconfig.compilerOptions.module).toBe("NodeNext");
    expect(tsconfig.compilerOptions.moduleResolution).toBe("NodeNext");
    tsconfig.compilerOptions.baseUrl = ".";
    tsconfig.compilerOptions.paths = {
      "typed-claude-hooks": [resolve(PACKAGE_ROOT, "src/index.ts")],
    };
    writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));

    execFileSync(
      process.execPath,
      [
        resolve(PACKAGE_ROOT, "node_modules/typescript/bin/tsc"),
        "--noEmit",
        "--project",
        tsconfigPath,
      ],
      { cwd: tempDir },
    );
  });
});
