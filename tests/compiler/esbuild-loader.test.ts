import { describe, expect, it } from "vitest";
import { loaderForPath } from "../../src/compiler/esbuild-loader.js";

describe("loaderForPath", () => {
  it.each([
    ["config.ts", "ts"],
    ["config.tsx", "tsx"],
    ["config.mts", "ts"],
    ["config.cts", "ts"],
    ["config.js", "js"],
    ["config.jsx", "jsx"],
    ["config.mjs", "js"],
    ["config.cjs", "js"],
  ] as const)("maps %s to the %s loader", (filePath, expected) => {
    expect(loaderForPath(filePath)).toBe(expected);
  });

  it("rejects unsupported extensions", () => {
    expect(() => loaderForPath("config.txt")).toThrow(
      /unsupported config file extension/i,
    );
  });
});
