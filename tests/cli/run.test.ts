import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { run } from "../../src/cli/run.js";

const PACKAGE_ROOT = resolve(import.meta.dirname, "../..");
const FIXTURE_CONFIG = resolve(import.meta.dirname, "../fixtures/sample-hooks.config.ts");
const tempDirs: string[] = [];
const originalCwd = process.cwd();

function makeTempDir(): string {
  const tempDir = mkdtempSync(resolve(tmpdir(), "tch-run-"));
  tempDirs.push(tempDir);
  return tempDir;
}

describe("run", () => {
  beforeEach(() => {
    process.chdir(makeTempDir());
  });

  afterEach(() => {
    process.chdir(originalCwd);
    for (const path of tempDirs) {
      rmSync(path, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it("skips the sandbox when an explicit config path is given", async () => {
    const ensure = vi.fn();

    await run({ config: FIXTURE_CONFIG, output: ".claude/settings.json", ensure });

    expect(ensure).not.toHaveBeenCalled();
    expect(existsSync(resolve(process.cwd(), ".typed-claude-hooks"))).toBe(false);
    expect(existsSync(resolve(process.cwd(), ".claude/settings.json"))).toBe(true);
  });

  it("ensures the sandbox and builds its config when no config path is given", async () => {
    const sandboxDir = resolve(process.cwd(), ".typed-claude-hooks");
    const ensure = vi.fn(() => {
      mkdirSync(sandboxDir, { recursive: true });
      // Reuse the fixture so the build has real handlers without a real npm install.
      // The fixture's relative import to "../../src/index.js" only resolves from its
      // original location (tests/fixtures/), so rewrite it to an absolute path that
      // resolves correctly from the temp sandbox directory this test writes into.
      const fixture = readFileSync(FIXTURE_CONFIG, "utf8").replace(
        '"../../src/index.js"',
        JSON.stringify(resolve(PACKAGE_ROOT, "src/index.js")),
      );
      writeFileSync(resolve(sandboxDir, "hooks.config.ts"), fixture);
    });

    await run({ output: ".claude/settings.json", ensure });

    expect(ensure).toHaveBeenCalledWith(sandboxDir);
    expect(existsSync(resolve(process.cwd(), ".claude/settings.json"))).toBe(true);
  });
});
