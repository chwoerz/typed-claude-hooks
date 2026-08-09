import { describe, expectTypeOf, it } from "vitest";
import { defineHandler } from "../../src/authoring/define-handler.js";
import { testHandler } from "../../src/testing/test-handler.js";
import type { BashInput, FileEditInput, FileWriteInput } from "../../src/types/generated/tool-inputs.js";
import type { NarrowedToolInput, ParseMatcher, ToolHookEvent } from "../../src/types/mapping.js";

describe("ParseMatcher", () => {
  it("parses a single tool name", () => {
    expectTypeOf<ParseMatcher<"Bash">>().toEqualTypeOf<"Bash">();
  });

  it("parses a union matcher", () => {
    expectTypeOf<ParseMatcher<"Write|Edit">>().toEqualTypeOf<"Write" | "Edit">();
  });

  it("parses triple union", () => {
    expectTypeOf<ParseMatcher<"Bash|Write|Edit">>().toEqualTypeOf<"Bash" | "Write" | "Edit">();
  });
});

describe("NarrowedToolInput", () => {
  it("narrows PreToolUse with Bash matcher", () => {
    type Result = NarrowedToolInput<"PreToolUse", "Bash">;
    expectTypeOf<Result["tool_input"]>().toEqualTypeOf<BashInput>();
    expectTypeOf<Result["tool_name"]>().toEqualTypeOf<"Bash">();
  });

  it("narrows PreToolUse with Write|Edit matcher", () => {
    type Result = NarrowedToolInput<"PreToolUse", "Write|Edit">;
    expectTypeOf<Result["tool_input"]>().toEqualTypeOf<FileWriteInput | FileEditInput>();
    expectTypeOf<Result["tool_name"]>().toEqualTypeOf<"Write" | "Edit">();
  });

  it("correlates tool_name with tool_input for union matchers", () => {
    const narrow = (input: NarrowedToolInput<"PreToolUse", "Write|Edit">) => {
      if (input.tool_name === "Write") {
        expectTypeOf(input.tool_input).toEqualTypeOf<FileWriteInput>();
      } else {
        expectTypeOf(input.tool_input).toEqualTypeOf<FileEditInput>();
      }
    };

    expectTypeOf(narrow).toBeFunction();
  });

  it("supports every hook input carrying tool_name and tool_input", () => {
    expectTypeOf<ToolHookEvent>().toEqualTypeOf<
      "PreToolUse" | "PostToolUse" | "PostToolUseFailure" | "PermissionRequest" | "PermissionDenied"
    >();

    type Events = ToolHookEvent;
    type Result = NarrowedToolInput<Events, "Bash">;
    expectTypeOf<Result["tool_input"]>().toEqualTypeOf<BashInput>();
    expectTypeOf<Result["tool_name"]>().toEqualTypeOf<"Bash">();
  });

  it("keeps unknown for non-builtin tool name", () => {
    type Result = NarrowedToolInput<"PreToolUse", "mcp__server__tool">;
    expectTypeOf<Result["tool_input"]>().toEqualTypeOf<unknown>();
  });
});

describe("matcher handler input retention", () => {
  const bashHandler = defineHandler("PreToolUse", { matcher: "Bash" }, async () => ({}));

  it("retains the narrowed input on the handler", () => {
    expectTypeOf(bashHandler.handler).parameter(0).toEqualTypeOf<NarrowedToolInput<"PreToolUse", "Bash">>();
  });

  it("accepts matching input in testHandler", () => {
    testHandler(bashHandler, {
      tool_name: "Bash",
      tool_input: { command: "npm test" },
      tool_use_id: "tool-use-id",
    });
  });

  it("rejects another tool input in testHandler", () => {
    const writeInput = {
      tool_name: "Write",
      tool_input: { file_path: "app.ts", content: "code" },
      tool_use_id: "tool-use-id",
    } as const;

    // @ts-expect-error Bash handlers only accept Bash inputs
    testHandler(bashHandler, writeInput);
  });

  it("requires matcher-specific fields in testHandler", () => {
    testHandler(bashHandler, {
      tool_name: "Bash",
      // @ts-expect-error Bash input requires command
      tool_input: {},
      tool_use_id: "tool-use-id",
    });
  });

  it("keeps normal handlers working", () => {
    const stopHandler = defineHandler("Stop", async () => ({}));
    testHandler(stopHandler, { stop_hook_active: false });
  });
});
