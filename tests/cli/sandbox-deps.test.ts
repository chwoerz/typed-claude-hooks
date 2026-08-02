import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  type DependencyState,
  planDependencySync,
  readDependencyState,
  writeDeclaredSpec,
} from "../../src/cli/sandbox-deps.js";

const tempDirs: string[] = [];

function makeSandbox(): string {
  const tempDir = mkdtempSync(resolve(tmpdir(), "tch-deps-"));
  tempDirs.push(tempDir);
  const sandboxDir = resolve(tempDir, ".typed-claude-hooks");
  mkdirSync(sandboxDir, { recursive: true });
  return sandboxDir;
}

function writeInstalled(sandboxDir: string, version: string): void {
  const dir = resolve(sandboxDir, "node_modules/typed-claude-hooks");
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, "package.json"), JSON.stringify({ name: "typed-claude-hooks", version }));
}

afterEach(() => {
  for (const path of tempDirs) {
    rmSync(path, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

describe("planDependencySync", () => {
  const cases: Array<[DependencyState, "skip" | "install", string]> = [
    [{ declaredSpec: undefined, installedVersion: undefined }, "install", "1.2.3"],
    [{ declaredSpec: "1.2.3", installedVersion: undefined }, "install", "1.2.3"],
    [{ declaredSpec: "1.2.3", installedVersion: "1.0.0" }, "install", "1.2.3"],
    [{ declaredSpec: "^1.2.3", installedVersion: "1.2.3" }, "install", "1.2.3"],
    [{ declaredSpec: "1.2.3", installedVersion: "1.2.3" }, "skip", "1.2.3"],
    [{ declaredSpec: "file:..", installedVersion: "0.9.0" }, "skip", "file:.."],
    [{ declaredSpec: "file:..", installedVersion: undefined }, "install", "file:.."],
    [{ declaredSpec: "link:../pkg", installedVersion: "0.9.0" }, "skip", "link:../pkg"],
  ];

  it.each(cases)("plans %o as %s", (state, action, spec) => {
    expect(planDependencySync(state, "1.2.3")).toEqual({ action, spec });
  });
});

describe("readDependencyState", () => {
  it("reads the declared spec and the installed version", () => {
    const sandboxDir = makeSandbox();
    writeFileSync(
      resolve(sandboxDir, "package.json"),
      JSON.stringify({ dependencies: { "typed-claude-hooks": "1.2.3", zod: "^3.24.0" } }),
    );
    writeInstalled(sandboxDir, "1.0.0");

    expect(readDependencyState(sandboxDir)).toEqual({ declaredSpec: "1.2.3", installedVersion: "1.0.0" });
  });

  it("reports undefined for a missing manifest and a missing install", () => {
    expect(readDependencyState(makeSandbox())).toEqual({ declaredSpec: undefined, installedVersion: undefined });
  });

  it("throws a readable error for malformed JSON", () => {
    const sandboxDir = makeSandbox();
    const manifestPath = resolve(sandboxDir, "package.json");
    writeFileSync(manifestPath, "{ malformed");

    expect(() => readDependencyState(sandboxDir)).toThrow(`Failed to parse ${manifestPath}`);
  });
});

describe("writeDeclaredSpec", () => {
  it("updates only the typed-claude-hooks entry", () => {
    const sandboxDir = makeSandbox();
    writeFileSync(
      resolve(sandboxDir, "package.json"),
      JSON.stringify({
        name: "typed-claude-hooks-config",
        private: true,
        type: "module",
        dependencies: { "typed-claude-hooks": "1.0.0", zod: "^3.24.0" },
      }),
    );

    writeDeclaredSpec(sandboxDir, "1.2.3");

    const manifest = JSON.parse(readFileSync(resolve(sandboxDir, "package.json"), "utf8"));
    expect(manifest.dependencies).toEqual({ "typed-claude-hooks": "1.2.3", zod: "^3.24.0" });
    expect(manifest.name).toBe("typed-claude-hooks-config");
    expect(manifest.private).toBe(true);
    expect(manifest.type).toBe("module");
  });
});
