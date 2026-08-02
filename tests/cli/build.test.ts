import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
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
});
