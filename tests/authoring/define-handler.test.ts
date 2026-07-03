import { describe, expect, expectTypeOf, it } from "vitest";
import { defineHandler } from "../../src/authoring/define-handler.js";
import type {
  BashInput,
  FileEditInput,
  FileWriteInput,
} from "../../src/types/generated/tool-inputs.js";

describe("defineHandler", () => {
  it("creates a TypedHandler with the event and function", () => {
    const handler = defineHandler("PreToolUse", async (_input) => {
      return {};
    });

    expect(handler.event).toBe("PreToolUse");
    expect(handler.matcher).toBeUndefined();
    expect(typeof handler.handler).toBe("function");
  });

  it("works with different event types", () => {
    const handler = defineHandler("Stop", async (_input) => {
      return {};
    });

    expect(handler.event).toBe("Stop");
    expect(handler.matcher).toBeUndefined();
  });

  it("stores matcher from options for tool events", () => {
    const handler = defineHandler(
      "PreToolUse",
      { matcher: "Bash" },
      async (_input) => {
        return {};
      },
    );

    expect(handler.event).toBe("PreToolUse");
    expect(handler.matcher).toBe("Bash");
  });

  it("stores union matcher from options", () => {
    const handler = defineHandler(
      "PreToolUse",
      { matcher: "Write|Edit" },
      async (_input) => {
        return {};
      },
    );

    expect(handler.matcher).toBe("Write|Edit");
  });

  it("narrows tool_input type for single matcher", () => {
    defineHandler("PreToolUse", { matcher: "Bash" }, async (input) => {
      expectTypeOf(input.tool_input).toEqualTypeOf<BashInput>();
      return {};
    });
  });

  it("narrows tool_input type for union matcher", () => {
    defineHandler("PreToolUse", { matcher: "Write|Edit" }, async (input) => {
      expectTypeOf(input.tool_input).toEqualTypeOf<
        FileWriteInput | FileEditInput
      >();
      return {};
    });
  });

  it("accepts matcher for PostToolUse", () => {
    const handler = defineHandler(
      "PostToolUse",
      { matcher: "Bash" },
      async (input) => {
        expectTypeOf(input.tool_input).toEqualTypeOf<BashInput>();
        return {};
      },
    );

    expect(handler.matcher).toBe("Bash");
  });

  it("stores timeout from options without matcher", () => {
    const handler = defineHandler("Stop", { timeout: 5000 }, async () => ({}));

    expect(handler.event).toBe("Stop");
    expect(handler.matcher).toBeUndefined();
    expect(handler.timeout).toBe(5000);
  });

  it("stores timeout from options with matcher", () => {
    const handler = defineHandler(
      "PreToolUse",
      { matcher: "Bash", timeout: 10000 },
      async () => ({}),
    );

    expect(handler.event).toBe("PreToolUse");
    expect(handler.matcher).toBe("Bash");
    expect(handler.timeout).toBe(10000);
  });

  it("omits timeout when no options provided", () => {
    const handler = defineHandler("Stop", async () => ({}));

    expect(handler).not.toHaveProperty("timeout");
  });

  it("stores if from options", () => {
    const handler = defineHandler(
      "PreToolUse",
      { matcher: "Bash", if: "Bash(git *)" },
      async () => ({}),
    );

    expect(handler.if).toBe("Bash(git *)");
  });

  it("stores statusMessage from options", () => {
    const handler = defineHandler(
      "PreToolUse",
      { matcher: "Edit", statusMessage: "Checking style..." },
      async () => ({}),
    );

    expect(handler.statusMessage).toBe("Checking style...");
  });

  it("stores async from options", () => {
    const handler = defineHandler(
      "PostToolUse",
      { matcher: "Bash", async: true },
      async () => ({}),
    );

    expect(handler.async).toBe(true);
  });

  it("stores asyncRewake from options", () => {
    const handler = defineHandler(
      "PostToolUse",
      { matcher: "Bash", asyncRewake: true },
      async () => ({}),
    );

    expect(handler.asyncRewake).toBe(true);
  });

  it("omits optional fields when not provided", () => {
    const handler = defineHandler("Stop", async () => ({}));

    expect(handler).not.toHaveProperty("if");
    expect(handler).not.toHaveProperty("statusMessage");
    expect(handler).not.toHaveProperty("async");
    expect(handler).not.toHaveProperty("asyncRewake");
    expect(handler).not.toHaveProperty("timeout");
  });
});
