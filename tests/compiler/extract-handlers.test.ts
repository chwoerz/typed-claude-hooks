import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { extractHandlers } from "../../src/compiler/extract-handlers.js";
import { loadConfig } from "../../src/compiler/load-config.js";

const FIXTURE_PATH = resolve(
  import.meta.dirname,
  "../fixtures/sample-hooks.config.ts",
);

describe("extractHandlers", () => {
  it("extracts handler metadata from loaded config", async () => {
    const loaded = await loadConfig(FIXTURE_PATH);
    const handlers = extractHandlers(loaded);

    expect(handlers).toHaveLength(2);

    const preToolUse = handlers.find((h) => h.event === "PreToolUse");
    const stop = handlers.find((h) => h.event === "Stop");

    expect(preToolUse).toEqual({
      event: "PreToolUse",
      name: "blockDangerous",
      matcher: "Bash",
      timeout: undefined,
      if: undefined,
      shell: undefined,
      statusMessage: undefined,
      once: undefined,
      async: undefined,
      asyncRewake: undefined,
    });
    expect(stop).toEqual({
      event: "Stop",
      name: "onStop",
      matcher: undefined,
      timeout: undefined,
      if: undefined,
      shell: undefined,
      statusMessage: undefined,
      once: undefined,
      async: undefined,
      asyncRewake: undefined,
    });
  });

  it("returns empty array for empty exports", () => {
    const handlers = extractHandlers({ handlerExports: {} });
    expect(handlers).toEqual([]);
  });
});
