import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { annotatePureHandlers } from "../../src/compiler/annotate-pure-handlers.js";

const CONFIG_PATH = resolve(import.meta.dirname, "../../.typed-claude-hooks/hooks.config.ts");

describe("annotatePureHandlers", () => {
  it("annotates package imports and aliases without changing lexical text", () => {
    const source = `import { defineHandler as handler } from "typed-claude-hooks";
const string = "handler(";
const template = \`handler(\`;
// handler(
export const hook = handler("Stop", async () => ({}));
`;

    expect(annotatePureHandlers(source, CONFIG_PATH)).toBe(
      source.replace('handler("Stop"', '/* @__PURE__ */ handler("Stop"'),
    );
  });

  it.each([
    "./src/index.js",
    "./src/authoring/define-handler.js",
  ])("annotates defineHandler imported from repository module %s", (moduleName) => {
    const source = `import { defineHandler } from "${moduleName}";\nexport const hook = defineHandler("Stop", async () => ({}));\n`;

    expect(annotatePureHandlers(source, CONFIG_PATH)).toContain(
      'export const hook = /* @__PURE__ */ defineHandler("Stop"',
    );
  });

  it("leaves unrelated local and imported identifiers untouched", () => {
    const source = `import { defineHandler as other } from "another-package";
const defineHandler = () => "local";
const local = defineHandler();
const imported = other();
const member = api.defineHandler();
`;

    expect(annotatePureHandlers(source, CONFIG_PATH)).toBe(source);
  });
});
