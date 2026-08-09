import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

export const PACKAGE_ROOT = resolve(import.meta.dirname, "../..");
export const CLI_PATH = resolve(PACKAGE_ROOT, "src/cli/index.ts");

// An absolute path is required here (rather than the bare "tsx" specifier used elsewhere):
// Node resolves a bare --import specifier from the child process's cwd, which for these
// tests is a temp project directory with no node_modules of its own.
const TSX_LOADER = resolve(PACKAGE_ROOT, "node_modules/tsx/dist/loader.mjs");
const NPM = process.platform === "win32" ? "npm.cmd" : "npm";

const tempDirs: string[] = [];

/**
 * A temp project whose sandbox already has the repo linked in as its
 * @typed-rocks/typed-claude-hooks dependency, declared with a file: specifier. planDependencySync therefore returns "skip",
 * so these tests never shell out to a real npm install.
 */
export function makeProject(prefix: string): string {
  const tempDir = mkdtempSync(resolve(tmpdir(), prefix));
  tempDirs.push(tempDir);

  const sandboxDir = resolve(tempDir, ".typed-claude-hooks");
  const modulesDir = resolve(sandboxDir, "node_modules");
  const typesDir = resolve(modulesDir, "@types");
  const scopeDir = resolve(modulesDir, "@typed-rocks");
  mkdirSync(typesDir, { recursive: true });
  mkdirSync(scopeDir, { recursive: true });
  symlinkSync(PACKAGE_ROOT, resolve(scopeDir, "typed-claude-hooks"), "dir");
  // tsconfig.json's "types": ["node"] requires @types/node to be resolvable from the
  // sandbox's own node_modules. This mirrors what a real npm install produces without
  // actually running one.
  symlinkSync(resolve(PACKAGE_ROOT, "node_modules/@types/node"), resolve(typesDir, "node"), "dir");
  writeFileSync(
    resolve(sandboxDir, "package.json"),
    JSON.stringify({
      name: "typed-claude-hooks-config",
      private: true,
      type: "module",
      dependencies: { "@typed-rocks/typed-claude-hooks": `file:${PACKAGE_ROOT}` },
      devDependencies: { "@types/node": "^22" },
    }),
  );
  return tempDir;
}

export function cleanupProjects(): void {
  for (const path of tempDirs) {
    rmSync(path, { recursive: true, force: true });
  }
  tempDirs.length = 0;
}

export function runCli(cwd: string, args: string[] = []): string {
  return execFileSync(process.execPath, ["--import", TSX_LOADER, CLI_PATH, ...args], { cwd, encoding: "utf-8" });
}

/**
 * The sandbox resolves @typed-rocks/typed-claude-hooks through the root package main/types fields, which
 * point into dist/. Build once if it is missing so a clean clone can run these tests.
 */
export function ensureBuilt(): void {
  if (existsSync(resolve(PACKAGE_ROOT, "dist/index.d.ts"))) return;
  execFileSync(NPM, ["run", "build"], { cwd: PACKAGE_ROOT, stdio: "inherit" });
}
