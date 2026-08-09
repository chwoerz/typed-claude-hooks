import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scaffoldSandbox } from "../../src/cli/sandbox-templates.js";
import { cliVersion } from "../../src/cli/version.js";

const PACKAGE_ROOT = resolve(import.meta.dirname, "../..");
const tempDirs: string[] = [];

function makeSandboxPath(): string {
  const tempDir = mkdtempSync(resolve(tmpdir(), "tch-scaffold-"));
  tempDirs.push(tempDir);
  return resolve(tempDir, ".typed-claude-hooks");
}

describe("cliVersion", () => {
  it("matches the package.json version", () => {
    const manifest = JSON.parse(readFileSync(resolve(PACKAGE_ROOT, "package.json"), "utf8")) as { version: string };

    expect(cliVersion).toBe(manifest.version);
  });
});

describe("scaffoldSandbox", () => {
  afterEach(() => {
    for (const path of tempDirs) {
      rmSync(path, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it("creates the four sandbox files pinned to the given version", () => {
    const sandboxDir = makeSandboxPath();

    const created = scaffoldSandbox(sandboxDir, "1.2.3");

    expect(created).toEqual(["package.json", "hooks.config.ts", "tsconfig.json", ".gitignore"]);

    const manifest = JSON.parse(readFileSync(resolve(sandboxDir, "package.json"), "utf8"));
    expect(manifest.dependencies["@typed-rocks/typed-claude-hooks"]).toBe("1.2.3");
    expect(manifest.private).toBe(true);
    expect(manifest.type).toBe("module");

    const config = readFileSync(resolve(sandboxDir, "hooks.config.ts"), "utf8");
    expect(config).toMatch(/export const protectEnvFiles = defineHandler\("PreToolUse"/);
    expect(config).not.toContain("export default");

    const tsconfig = JSON.parse(readFileSync(resolve(sandboxDir, "tsconfig.json"), "utf8"));
    expect(tsconfig.compilerOptions.module).toBe("NodeNext");
    expect(tsconfig.compilerOptions.moduleResolution).toBe("NodeNext");
    expect(tsconfig.compilerOptions.strict).toBe(true);
    expect(tsconfig.include).toEqual(["**/*.ts"]);

    expect(readFileSync(resolve(sandboxDir, ".gitignore"), "utf8")).toBe("node_modules/\n");
  });

  it("never overwrites an existing file", () => {
    const sandboxDir = makeSandboxPath();
    scaffoldSandbox(sandboxDir, "1.2.3");
    writeFileSync(resolve(sandboxDir, "hooks.config.ts"), "// mine\n");

    const created = scaffoldSandbox(sandboxDir, "1.2.3");

    expect(created).toEqual([]);
    expect(readFileSync(resolve(sandboxDir, "hooks.config.ts"), "utf8")).toBe("// mine\n");
  });
});
