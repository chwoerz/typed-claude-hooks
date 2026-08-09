import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { build } from "../../src/cli/build.js";
import { bundleHandlers } from "../../src/compiler/bundle-handlers.js";

vi.mock("../../src/compiler/bundle-handlers.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/compiler/bundle-handlers.js")>();
  return { ...original, bundleHandlers: vi.fn(original.bundleHandlers) };
});

const TMP_DIR = resolve(import.meta.dirname, "../fixtures/.tmp-build-unit");
const SETTINGS_PATH = resolve(TMP_DIR, "settings.json");
const MANAGED_DIR = resolve(TMP_DIR, "hooks/typed-claude-hooks");
const CONFIG_PATH = resolve(import.meta.dirname, "../fixtures/sample-hooks.config.ts");
const MISSING_CONFIG_PATH = resolve(TMP_DIR, "missing.config.ts");

const unsafePathCharacters = [
  ["double quote", '"'],
  ["backslash", "\\"],
  ["carriage return", "\r"],
  ["line feed", "\n"],
] as const;

describe("build", () => {
  afterEach(() => {
    vi.mocked(bundleHandlers).mockReset();
    rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it("preserves existing output when bundling fails", async () => {
    const stalePath = resolve(MANAGED_DIR, "stale.cjs");
    const settingsContents = JSON.stringify({ model: "before" });
    mkdirSync(MANAGED_DIR, { recursive: true });
    writeFileSync(stalePath, "preserve");
    writeFileSync(SETTINGS_PATH, settingsContents);
    vi.mocked(bundleHandlers).mockRejectedValueOnce(new Error("bundle failed"));

    await expect(
      build({
        config: CONFIG_PATH,
        output: SETTINGS_PATH,
        hooksDir: resolve(TMP_DIR, "hooks"),
      }),
    ).rejects.toThrow("bundle failed");

    expect(readFileSync(stalePath, "utf-8")).toBe("preserve");
    expect(readFileSync(SETTINGS_PATH, "utf-8")).toBe(settingsContents);
  });

  it.each(
    unsafePathCharacters,
  )("rejects a %s in the output-derived managed command path before loading config or mutating output", async (_, character) => {
    const settingsPath = resolve(TMP_DIR, `unsafe${character}output/settings.json`);
    const settingsContents = JSON.stringify({ model: "before" });
    const managedDir = resolve(dirname(settingsPath), "hooks/typed-claude-hooks");
    const managedLogicalPath = relative(process.cwd(), managedDir);
    mkdirSync(dirname(settingsPath), { recursive: true });
    writeFileSync(settingsPath, settingsContents);

    await expect(build({ config: MISSING_CONFIG_PATH, output: settingsPath })).rejects.toThrow(
      `Generated hook command path cannot contain double quotes, backslashes or line breaks: ${JSON.stringify(managedLogicalPath)}`,
    );

    expect(readFileSync(settingsPath, "utf-8")).toBe(settingsContents);
    expect(bundleHandlers).not.toHaveBeenCalled();
  });

  it.each(
    unsafePathCharacters,
  )("rejects a %s in an explicit hooksDir managed command path before loading config or mutating output", async (_, character) => {
    const hooksDir = resolve(TMP_DIR, `unsafe${character}hooks`);
    const settingsContents = JSON.stringify({ model: "before" });
    const managedDir = resolve(hooksDir, "typed-claude-hooks");
    const managedLogicalPath = relative(process.cwd(), managedDir);
    mkdirSync(dirname(SETTINGS_PATH), { recursive: true });
    writeFileSync(SETTINGS_PATH, settingsContents);

    await expect(build({ config: MISSING_CONFIG_PATH, output: SETTINGS_PATH, hooksDir })).rejects.toThrow(
      `Generated hook command path cannot contain double quotes, backslashes or line breaks: ${JSON.stringify(managedLogicalPath)}`,
    );

    expect(readFileSync(SETTINGS_PATH, "utf-8")).toBe(settingsContents);
    expect(bundleHandlers).not.toHaveBeenCalled();
  });
});
