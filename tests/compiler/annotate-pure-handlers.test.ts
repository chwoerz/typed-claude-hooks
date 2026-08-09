import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { annotatePureHandlers } from "../../src/compiler/annotate-pure-handlers.js";

const CONFIG_PATH = resolve(import.meta.dirname, "../../.typed-claude-hooks/hooks.config.ts");

describe("annotatePureHandlers", () => {
  it("annotates package imports and aliases without touching strings or templates", async () => {
    const source = `import { defineHandler as handler } from "typed-claude-hooks";
const string = "handler(";
const template = \`handler(\`;
// handler(
export const hook = handler("Stop", async () => ({}));
`;

    const result = await annotatePureHandlers(source, CONFIG_PATH);

    expect(result).toContain('/* @__PURE__ */ handler("Stop"');
    expect(result).toContain('const string = "handler(";');
    expect(result).toContain("const template = `handler(`;");
    expect(result.match(/@__PURE__/g)).toHaveLength(1);
  });

  it.each([
    "./src/index.js",
    "./src/authoring/define-handler.js",
  ])("annotates defineHandler imported from repository module %s", async (moduleName) => {
    const source = `import { defineHandler } from "${moduleName}";\nexport const hook = defineHandler("Stop", async () => ({}));\n`;

    expect(await annotatePureHandlers(source, CONFIG_PATH)).toContain(
      'export const hook = /* @__PURE__ */ defineHandler("Stop"',
    );
  });

  it("leaves unrelated local and imported identifiers untouched", async () => {
    const source = `import { defineHandler as other } from "another-package";
const defineHandler = () => "local";
const local = defineHandler();
const imported = other();
const member = api.defineHandler();
`;

    expect(await annotatePureHandlers(source, CONFIG_PATH)).not.toContain("@__PURE__");
  });

  it("annotates every handler in a config with several exports", async () => {
    const source = `import { defineHandler } from "typed-claude-hooks";
export const first = defineHandler("Stop", async () => ({}));
export const second = defineHandler("Notification", async () => ({}));
export const third = defineHandler("PreToolUse", { matcher: "Bash" }, async () => ({}));
`;

    expect((await annotatePureHandlers(source, CONFIG_PATH)).match(/@__PURE__/g)).toHaveLength(3);
  });

  it("strips TypeScript syntax so the result can be loaded as JavaScript", async () => {
    const source = `import { defineHandler } from "typed-claude-hooks";
interface Context { note: string }
type Alias = Context | null;
export const hook = defineHandler("Stop", async (): Promise<Record<string, never>> => {
  const value = null as Alias;
  return {};
});
`;

    const result = await annotatePureHandlers(source, CONFIG_PATH);

    expect(result).toContain("/* @__PURE__ */ defineHandler(");
    expect(result).not.toContain("interface Context");
    expect(result).not.toContain("Promise<Record");
  });

  it("rejects config files with an unsupported extension", async () => {
    await expect(annotatePureHandlers("export const a = 1;", "/tmp/hooks.config.txt")).rejects.toThrow(
      /Unsupported config file extension/,
    );
  });
});
