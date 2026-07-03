import { describe, expect, it } from "vitest";
import { generateRuntime } from "../../src/compiler/runtime-template.js";

describe("generateRuntime", () => {
  it("produces valid JS with stdin/stdout handling", () => {
    const code = generateRuntime("myHandler");
    expect(code).toContain("process.stdin");
    expect(code).toContain("process.stdout");
    expect(code).toContain("JSON.parse");
    expect(code).toContain("process.exit(0)");
    expect(code).toContain("process.exit(2)");
  });

  it("injects the handler expression", () => {
    const code = generateRuntime("blockRm.handler");
    expect(code).toContain("blockRm.handler(");
  });

  it("produces code that can be evaluated", () => {
    const code = generateRuntime("function(){}");
    expect(() => new Function(code)).not.toThrow();
  });
});
