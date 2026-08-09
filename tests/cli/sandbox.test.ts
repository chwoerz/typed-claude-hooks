import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureSandbox } from "../../src/cli/sandbox.js";

const tempDirs: string[] = [];

function makeSandboxPath(): string {
  const tempDir = mkdtempSync(resolve(tmpdir(), "tch-ensure-"));
  tempDirs.push(tempDir);
  return resolve(tempDir, ".typed-claude-hooks");
}

function writeInstalled(sandboxDir: string, version: string): void {
  const dir = resolve(sandboxDir, "node_modules/@typed-rocks/typed-claude-hooks");
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, "package.json"), JSON.stringify({ name: "@typed-rocks/typed-claude-hooks", version }));
}

function writeInstalledPackage(sandboxDir: string, name: string): void {
  const dir = resolve(sandboxDir, "node_modules", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, "package.json"), JSON.stringify({ name }));
}

describe("ensureSandbox", () => {
  afterEach(() => {
    for (const path of tempDirs) {
      rmSync(path, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it("scaffolds and installs on a first run", () => {
    const sandboxDir = makeSandboxPath();
    const install = vi.fn();

    ensureSandbox({ sandboxDir, version: "1.2.3", install });

    expect(existsSync(resolve(sandboxDir, "hooks.config.ts"))).toBe(true);
    expect(existsSync(resolve(sandboxDir, "tsconfig.json"))).toBe(true);
    expect(existsSync(resolve(sandboxDir, ".gitignore"))).toBe(true);
    expect(install).toHaveBeenCalledWith(sandboxDir);
    expect(install).toHaveBeenCalledTimes(1);
  });

  it("does not install again when the sandbox already matches", () => {
    const sandboxDir = makeSandboxPath();
    ensureSandbox({ sandboxDir, version: "1.2.3", install: vi.fn() });
    writeInstalled(sandboxDir, "1.2.3");
    writeInstalledPackage(sandboxDir, "@types/node");
    const install = vi.fn();

    ensureSandbox({ sandboxDir, version: "1.2.3", install });

    expect(install).not.toHaveBeenCalled();
  });

  it.each([
    "dependencies",
    "devDependencies",
  ] as const)("installs when a declared %s package is missing", (dependencySection) => {
    const sandboxDir = makeSandboxPath();
    ensureSandbox({ sandboxDir, version: "1.2.3", install: vi.fn() });
    writeFileSync(
      resolve(sandboxDir, "package.json"),
      JSON.stringify({
        dependencies: {
          "@typed-rocks/typed-claude-hooks": "1.2.3",
          ...(dependencySection === "dependencies" ? { zod: "^3.0.0" } : {}),
        },
        ...(dependencySection === "devDependencies" ? { devDependencies: { zod: "^3.0.0" } } : {}),
      }),
    );
    writeInstalled(sandboxDir, "1.2.3");
    const install = vi.fn();

    ensureSandbox({ sandboxDir, version: "1.2.3", install });

    const manifest = JSON.parse(readFileSync(resolve(sandboxDir, "package.json"), "utf8"));
    expect(manifest.dependencies["@typed-rocks/typed-claude-hooks"]).toBe("1.2.3");
    expect(install).toHaveBeenCalledWith(sandboxDir);
    expect(install).toHaveBeenCalledTimes(1);
  });

  it.each(["file:..", "link:.."])("preserves a %s spec when only a secondary dependency is missing", (spec) => {
    const sandboxDir = makeSandboxPath();
    ensureSandbox({ sandboxDir, version: "1.0.0", install: vi.fn() });
    writeFileSync(
      resolve(sandboxDir, "package.json"),
      JSON.stringify({ dependencies: { "@typed-rocks/typed-claude-hooks": spec, zod: "^3.0.0" } }),
    );
    writeInstalled(sandboxDir, "9.9.9");
    const install = vi.fn();

    ensureSandbox({ sandboxDir, version: "1.2.3", install });

    const manifest = JSON.parse(readFileSync(resolve(sandboxDir, "package.json"), "utf8"));
    expect(manifest.dependencies["@typed-rocks/typed-claude-hooks"]).toBe(spec);
    expect(install).toHaveBeenCalledTimes(1);
  });

  it("reinstalls and repins when the installed version drifts", () => {
    const sandboxDir = makeSandboxPath();
    ensureSandbox({ sandboxDir, version: "1.0.0", install: vi.fn() });
    writeInstalled(sandboxDir, "1.0.0");
    const install = vi.fn((dir: string) => {
      const manifest = JSON.parse(readFileSync(resolve(dir, "package.json"), "utf8"));
      expect(manifest.dependencies["@typed-rocks/typed-claude-hooks"]).toBe("1.2.3");
    });

    ensureSandbox({ sandboxDir, version: "1.2.3", install });

    const manifest = JSON.parse(readFileSync(resolve(sandboxDir, "package.json"), "utf8"));
    expect(manifest.dependencies["@typed-rocks/typed-claude-hooks"]).toBe("1.2.3");
    expect(install).toHaveBeenCalledTimes(1);
  });

  it("propagates an install failure instead of continuing", () => {
    const sandboxDir = makeSandboxPath();
    const install = vi.fn(() => {
      throw new Error("npm install failed in /tmp/x: exit 1");
    });

    expect(() => ensureSandbox({ sandboxDir, version: "1.2.3", install })).toThrow("npm install failed");
  });

  it("leaves a file: specifier alone when it is already installed", () => {
    const sandboxDir = makeSandboxPath();
    ensureSandbox({ sandboxDir, version: "1.0.0", install: vi.fn() });
    writeFileSync(
      resolve(sandboxDir, "package.json"),
      JSON.stringify({ dependencies: { "@typed-rocks/typed-claude-hooks": "file:.." } }),
    );
    writeInstalled(sandboxDir, "9.9.9");
    const install = vi.fn();

    ensureSandbox({ sandboxDir, version: "1.2.3", install });

    const manifest = JSON.parse(readFileSync(resolve(sandboxDir, "package.json"), "utf8"));
    expect(manifest.dependencies["@typed-rocks/typed-claude-hooks"]).toBe("file:..");
    expect(install).not.toHaveBeenCalled();
  });
});
