import { statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/compiler/load-config.js";

const FIXTURE_PATH = resolve(import.meta.dirname, "../fixtures/sample-hooks.config.ts");

describe("loadConfig", () => {
  it("loads named handler exports", async () => {
    const result = await loadConfig(FIXTURE_PATH);

    expect(result.handlerExports).toHaveProperty("blockDangerous");
    expect(result.handlerExports).toHaveProperty("onStop");
    expect(result.handlerExports.blockDangerous.event).toBe("PreToolUse");
    expect(result.handlerExports.onStop.event).toBe("Stop");
  });

  it.each([
    ["at least one named handler", "no-handlers.ts", /no named handlers/i],
    ["valid handler values", "invalid-handler.ts", /invalid.*handler/i],
    ["valid hook events", "invalid-event.ts", /invalid.*handler/i],
    ["own hook event values", "inherited-event-name.ts", /invalid.*handler/i],
    ["a valid shell", "invalid-shell.ts", /invalid.*shell/i],
    ["typed options", "invalid-option-type.ts", /invalid.*timeout/i],
    ["known options", "unknown-option.ts", /unknown.*option/i],
    ["own option validators", "inherited-option-name.ts", /unknown.*option/i],
    ["unique handler instances", "duplicate-handler.ts", /same handler instance/i],
    ["identifier export names", "invalid-export-name.mts", /handler export name.*valid javascript identifier/i],
  ])("requires %s", async (_requirement, fixture, message) => {
    const configPath = resolve(import.meta.dirname, "../fixtures/configs", fixture);

    await expect(loadConfig(configPath)).rejects.toThrow(message);
  });

  it("ignores default and unrelated named exports", async () => {
    const result = await loadConfig(resolve(import.meta.dirname, "../fixtures/configs/ignored-exports.ts"));

    expect(Object.keys(result.handlerExports)).toEqual(["onStop"]);
  });

  it("loads indirect named exports", async () => {
    const result = await loadConfig(resolve(import.meta.dirname, "../fixtures/configs/indirect-handler.ts"));

    expect(Object.keys(result.handlerExports)).toEqual(["onStop"]);
  });

  it("does not mutate the config directory", async () => {
    const fixtureDir = dirname(FIXTURE_PATH);
    const mtimeBefore = statSync(fixtureDir, { bigint: true }).mtimeNs;

    await loadConfig(FIXTURE_PATH);

    expect(statSync(fixtureDir, { bigint: true }).mtimeNs).toBe(mtimeBefore);
  });

  it("throws for non-existent config file", async () => {
    await expect(loadConfig("/tmp/nonexistent.ts")).rejects.toThrow();
  });
});
