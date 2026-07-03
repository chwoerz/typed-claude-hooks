import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/compiler/load-config.js";

const FIXTURE_PATH = resolve(
  import.meta.dirname,
  "../fixtures/sample-hooks.config.ts",
);

describe("loadConfig", () => {
  it("collects named handler exports", async () => {
    const result = await loadConfig(FIXTURE_PATH);

    expect(result.handlerExports).toHaveProperty("blockDangerous");
    expect(result.handlerExports).toHaveProperty("onStop");
    expect(result.handlerExports.blockDangerous.event).toBe("PreToolUse");
    expect(result.handlerExports.onStop.event).toBe("Stop");
  });

  it("throws for non-existent config file", async () => {
    await expect(loadConfig("/tmp/nonexistent.ts")).rejects.toThrow();
  });
});
