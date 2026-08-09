import { describe, expect, it } from "vitest";
import { discoverHandlers } from "../src/playground/compiler/discover-handlers";
import { readFile } from "node:fs/promises";

function messages(source: string): string[] {
  return discoverHandlers(source).diagnostics.map(({ message }) => message);
}

describe("discoverHandlers", () => {
  it("uses the TypeScript namespace import required by browser worker bundling", async () => {
    const implementation = await readFile(
      new URL("../src/playground/compiler/discover-handlers.ts", import.meta.url),
      "utf8",
    );

    expect(implementation).toContain('import * as ts from "typescript"');
    expect(implementation).not.toContain('import ts from "typescript"');
    expect(implementation).not.toContain("ts.transpileModule(");
  });
  it.each(["UnknownEvent", "../escaped", "Stop/../../escaped"])(
    "rejects unsupported event %s before artifact planning",
    (event) => {
      const result = discoverHandlers(`
        import { defineHandler } from "@typed-rocks/typed-claude-hooks"
        export const invalid = defineHandler(${JSON.stringify(event)}, async () => ({}))
      `);

      expect(result.handlers).toEqual([]);
      expect(messagesFor(result)).toContainEqual(
        expect.stringContaining(`Unsupported hook event "${event}"`),
      );
    },
  );

  it("discovers direct named handlers through named and aliased imports", () => {
    const result = discoverHandlers(`
      import { defineHandler, defineHandler as hook } from "@typed-rocks/typed-claude-hooks"
      import type { HookEvent } from "@typed-rocks/typed-claude-hooks/types"
      import { readFile } from "node:fs/promises"

      export const before = defineHandler("PreToolUse", {
        matcher: "Bash",
        timeout: 5000,
        if: "Bash(git *)",
        statusMessage: "Checking command",
        shell: "powershell",
        once: true,
        async: false,
        asyncRewake: true,
      }, async () => ({}))
      export const stopped = hook("Stop", async () => ({}))
    `);

    expect(result.diagnostics).toEqual([]);
    expect(result.handlers).toEqual([
      {
        name: "before",
        event: "PreToolUse",
        matcher: "Bash",
        timeout: 5000,
        if: "Bash(git *)",
        statusMessage: "Checking command",
        shell: "powershell",
        once: true,
        async: false,
        asyncRewake: true,
      },
      { name: "stopped", event: "Stop" },
    ]);
  });

  it("reports unsupported imports, including actionable bare Node diagnostics", () => {
    const result = discoverHandlers(`
      import path from "path"
      import value from "other-package"
      import { defineHandler } from "@typed-rocks/typed-claude-hooks"
      export const stopped = defineHandler("Stop", async () => ({}))
    `);

    expect(messagesFor(result)).toEqual([
      expect.stringContaining(
        'Use "node:path" instead of the bare Node built-in "path"',
      ),
      expect.stringContaining(
        'playground bundler cannot resolve "other-package"',
      ),
    ]);
    expect(result.diagnostics[0].start.line).toBe(2);
    expect(result.diagnostics[0].start.column).toBeGreaterThan(0);
  });

  it.each([
    ["import equals", 'import fs = require("node:fs")'],
    ["dynamic import", 'const fs = await import("node:fs")'],
    ["require", 'const fs = require("node:fs")'],
  ])(
    "rejects %s module loading even for an approved module",
    (_name, moduleLoad) => {
      const result = discoverHandlers(`
      import { defineHandler } from "@typed-rocks/typed-claude-hooks"
      ${moduleLoad}
      export const stopped = defineHandler("Stop", async () => ({}))
    `);

      expect(result.handlers).toEqual([{ name: "stopped", event: "Stop" }]);
      expect(messagesFor(result)).toContainEqual(
        expect.stringContaining("Only static ESM imports are supported"),
      );
      expect(result.diagnostics[0].start.line).toBe(3);
    },
  );

  it.each([
    ["named", 'import { createRequire } from "node:module"'],
    ["aliased", 'import { createRequire as makeRequire } from "node:module"'],
    ["namespace", 'import * as nodeModule from "node:module"'],
    ["default", 'import nodeModule from "node:module"'],
  ])(
    "rejects %s node:module imports that expose createRequire",
    (_name, moduleImport) => {
      const result = discoverHandlers(`
      import { defineHandler } from "@typed-rocks/typed-claude-hooks"
      ${moduleImport}
      export const stopped = defineHandler("Stop", async () => ({}))
    `);

      expect(result.handlers).toEqual([{ name: "stopped", event: "Stop" }]);
      expect(messagesFor(result)).toContainEqual(
        expect.stringContaining(
          "playground supports statically resolved Node imports only",
        ),
      );
      expect(result.diagnostics[0].start.line).toBe(3);
    },
  );

  it.each([
    ["Module.createRequire", 'import { Module } from "node:module"'],
    ["ordinary named import", 'import { builtinModules } from "node:module"'],
  ])("rejects the %s node:module runtime bypass", (_name, moduleImport) => {
    const result = discoverHandlers(`
      import { defineHandler } from "@typed-rocks/typed-claude-hooks"
      ${moduleImport}
      export const stopped = defineHandler("Stop", async () => ({}))
    `);

    expect(result.handlers).toEqual([{ name: "stopped", event: "Stop" }]);
    expect(messagesFor(result)).toContainEqual(
      expect.stringContaining(
        "playground supports statically resolved Node imports only",
      ),
    );
    expect(result.diagnostics[0].start.line).toBe(3);
  });

  it("allows whole-clause and specifier type-only imports from node:module", () => {
    const result = discoverHandlers(`
      import type { Module } from "node:module"
      import { type createRequire } from "node:module"
      import { defineHandler } from "@typed-rocks/typed-claude-hooks"
      export const stopped = defineHandler("Stop", async () => ({}))
    `);

    expect(result).toEqual({
      handlers: [{ name: "stopped", event: "Stop" }],
      diagnostics: [],
    });
  });

  it.each([
    ["dynamic import", 'await import("node:fs")'],
    ["require", 'require("node:fs")'],
  ])("detects %s inside a handler body", (_name, moduleLoad) => {
    const result = discoverHandlers(`
      import { defineHandler } from "@typed-rocks/typed-claude-hooks"
      export const stopped = defineHandler("Stop", async () => {
        ${moduleLoad}
        return {}
      })
    `);

    expect(messagesFor(result)).toContainEqual(
      expect.stringContaining("Only static ESM imports are supported"),
    );
    expect(result.diagnostics[0].start.line).toBe(4);
  });

  it("does not treat type-only defineHandler imports as callable bindings", () => {
    const result = discoverHandlers(`
      import type { defineHandler } from "@typed-rocks/typed-claude-hooks"
      export const stopped = defineHandler("Stop", async () => ({}))
    `);

    expect(result.handlers).toEqual([]);
    expect(messagesFor(result)).toContainEqual(
      expect.stringContaining('imported from "@typed-rocks/typed-claude-hooks"'),
    );
  });

  it.each(["let", "var"])(
    "rejects an exported %s handler declaration",
    (declarationKind) => {
      const result = discoverHandlers(`
        import { defineHandler } from "@typed-rocks/typed-claude-hooks"
        export ${declarationKind} stopped = defineHandler("Stop", async () => ({}))
      `);

      expect(result.handlers).toEqual([]);
      expect(messagesFor(result)).toContainEqual(
        expect.stringContaining("must use export const"),
      );
      expect(result.diagnostics[0].start).toMatchObject({ line: 3, column: 9 });
    },
  );

  it.each([
    ["function", "export function helper() {}"],
    ["class", "export class Helper {}"],
    ["non-handler variable", "export const value = 1"],
  ])("rejects an exported runtime %s", (_name, runtimeExport) => {
    const result = discoverHandlers(`
      import { defineHandler } from "@typed-rocks/typed-claude-hooks"
      ${runtimeExport}
      export const stopped = defineHandler("Stop", async () => ({}))
    `);

    expect(result.handlers).toEqual([{ name: "stopped", event: "Stop" }]);
    expect(messagesFor(result)).toContainEqual(
      expect.stringContaining(
        "Only direct handler consts may be runtime exports",
      ),
    );
    expect(result.diagnostics[0].start.line).toBe(3);
  });

  it("allows exported type declarations because they emit no runtime code", () => {
    const result = discoverHandlers(`
      import { defineHandler } from "@typed-rocks/typed-claude-hooks"
      export interface HandlerContext { enabled: boolean }
      export type HandlerName = string
      export const stopped = defineHandler("Stop", async () => ({}))
    `);

    expect(result).toEqual({
      handlers: [{ name: "stopped", event: "Stop" }],
      diagnostics: [],
    });
  });

  it.each([
    ["type-only clause", "export type { HandlerContext }"],
    ["type-only specifier", "export { type HandlerContext }"],
  ])("allows a %s because it emits no runtime code", (_name, typeExport) => {
    const result = discoverHandlers(`
      import { defineHandler } from "@typed-rocks/typed-claude-hooks"
      interface HandlerContext { enabled: boolean }
      ${typeExport}
      export const stopped = defineHandler("Stop", async () => ({}))
    `);

    expect(result).toEqual({
      handlers: [{ name: "stopped", event: "Stop" }],
      diagnostics: [],
    });
  });

  it.each([
    ["runtime clause", "export { HandlerContext }"],
    ["mixed clause", "export { type HandlerContext, runtimeValue }"],
    ["export star", 'export * from "@typed-rocks/typed-claude-hooks/types"'],
  ])("rejects a %s export declaration", (_name, declaration) => {
    const result = discoverHandlers(`
      import { defineHandler } from "@typed-rocks/typed-claude-hooks"
      interface HandlerContext { enabled: boolean }
      const runtimeValue = 1
      ${declaration}
      export const stopped = defineHandler("Stop", async () => ({}))
    `);

    expect(result.handlers).toEqual([{ name: "stopped", event: "Stop" }]);
    expect(messagesFor(result)).toContainEqual(
      expect.stringContaining(
        "Runtime re-exports and export-star declarations are not supported",
      ),
    );
    expect(result.diagnostics[0].start.line).toBe(5);
  });

  it.each([
    [
      "default exports",
      `export default defineHandler("Stop", async () => ({}))`,
      "Default exports",
    ],
    [
      "default declarations",
      `export default function handler() {}`,
      "Default exports",
    ],
    ["re-exports", `export { handler } from "./handler"`, "Runtime re-exports"],
    [
      "indirect handlers",
      `import { defineHandler } from "@typed-rocks/typed-claude-hooks"\nconst handler = defineHandler("Stop", async () => ({}))\nexport { handler }`,
      "Runtime re-exports",
    ],
    [
      "dynamic construction",
      `import { defineHandler } from "@typed-rocks/typed-claude-hooks"\nconst make = defineHandler\nexport const handler = make("Stop", async () => ({}))`,
      "direct call",
    ],
    [
      "namespace calls",
      `import * as hooks from "@typed-rocks/typed-claude-hooks"\nexport const handler = hooks.defineHandler("Stop", async () => ({}))`,
      "Namespace calls",
    ],
    [
      "local lookalikes",
      `const defineHandler = () => ({})\nexport const handler = defineHandler("Stop", async () => ({}))`,
      'imported from "@typed-rocks/typed-claude-hooks"',
    ],
  ])("rejects %s", (_name, source, expected) => {
    expect(messages(source)).toEqual(
      expect.arrayContaining([expect.stringContaining(expected)]),
    );
  });

  it("rejects duplicate exported names and artifact-unsafe names", () => {
    const duplicate = discoverHandlers(`
      import { defineHandler } from "@typed-rocks/typed-claude-hooks"
      export const handler = defineHandler("Stop", async () => ({}))
      export const handler = defineHandler("Stop", async () => ({}))
    `);
    const unsafe = discoverHandlers(`
      import { defineHandler } from "@typed-rocks/typed-claude-hooks"
      export const $handler = defineHandler("Stop", async () => ({}))
    `);

    expect(messagesFor(duplicate)).toContainEqual(
      expect.stringContaining('Duplicate exported handler name "handler"'),
    );
    expect(messagesFor(unsafe)).toContainEqual(
      expect.stringContaining("not safe for an artifact file name"),
    );
  });

  it.each([
    [
      "event",
      `const event = "Stop"\nexport const handler = defineHandler(event, async () => ({}))`,
    ],
    [
      "options object",
      `const options = { timeout: 5 }\nexport const handler = defineHandler("Stop", options, async () => ({}))`,
    ],
    [
      "matcher",
      `const matcher = "Bash"\nexport const handler = defineHandler("PreToolUse", { matcher }, async () => ({}))`,
    ],
    [
      "timeout",
      `export const handler = defineHandler("Stop", { timeout: 1 + 2 }, async () => ({}))`,
    ],
    [
      "if",
      `export const handler = defineHandler("Stop", { if: condition }, async () => ({}))`,
    ],
    [
      "shell",
      `export const handler = defineHandler("Stop", { shell: "zsh" }, async () => ({}))`,
    ],
    [
      "once",
      `export const handler = defineHandler("Stop", { once: enabled }, async () => ({}))`,
    ],
    [
      "spread",
      `export const handler = defineHandler("Stop", { ...options }, async () => ({}))`,
    ],
    [
      "unknown option",
      `export const handler = defineHandler("Stop", { custom: "value" }, async () => ({}))`,
    ],
  ])("rejects a non-static or unsupported %s", (_name, declaration) => {
    const result = discoverHandlers(
      `import { defineHandler } from "@typed-rocks/typed-claude-hooks"\n${declaration}`,
    );

    expect(result.handlers).toEqual([]);
    expect(result.diagnostics).not.toEqual([]);
    expect(
      result.diagnostics.every(
        ({ start }) => start.line >= 1 && start.column >= 1,
      ),
    ).toBe(true);
  });

  it("accepts the largest finite timeout literal", () => {
    const result = discoverHandlers(`
      import { defineHandler } from "@typed-rocks/typed-claude-hooks"
      export const stopped = defineHandler("Stop", { timeout: 1.7976931348623157e308 }, async () => ({}))
    `);

    expect(result).toEqual({
      handlers: [{ name: "stopped", event: "Stop", timeout: Number.MAX_VALUE }],
      diagnostics: [],
    });
  });

  it("rejects a numeric timeout literal that evaluates to infinity", () => {
    const result = discoverHandlers(`
      import { defineHandler } from "@typed-rocks/typed-claude-hooks"
      export const stopped = defineHandler("Stop", { timeout: 1e999 }, async () => ({}))
    `);

    expect(result.handlers).toEqual([]);
    expect(messagesFor(result)).toContainEqual(
      expect.stringContaining(
        'Handler option "timeout" must be a finite numeric literal',
      ),
    );
    expect(result.diagnostics[0].start).toMatchObject({ line: 3 });
  });

  it("reports malformed TypeScript without throwing", () => {
    const result = discoverHandlers(`
      import { defineHandler } from "@typed-rocks/typed-claude-hooks"
      export const broken = defineHandler("Stop", async () => {
    `);

    expect(result.handlers).toEqual([]);
    expect(result.diagnostics.some(({ code }) => code.startsWith("TS"))).toBe(
      true,
    );
    expect(result.diagnostics[0]).toMatchObject({
      severity: "error",
      fileName: "hooks.config.ts",
      start: { line: 4, column: 5 },
    });
  });

  it("reports a clear diagnostic when no handlers are exported", () => {
    const result = discoverHandlers(
      `import type { HookEvent } from "@typed-rocks/typed-claude-hooks/types"`,
    );

    expect(result.handlers).toEqual([]);
    expect(messagesFor(result)).toContainEqual(
      expect.stringContaining("No handlers found"),
    );
  });
});

function messagesFor(result: ReturnType<typeof discoverHandlers>): string[] {
  return result.diagnostics.map(({ message }) => message);
}
