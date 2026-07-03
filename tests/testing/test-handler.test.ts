import { describe, expect, it } from "vitest";
import { defineHandler } from "../../src/authoring/define-handler.js";
import { testHandler } from "../../src/testing/test-handler.js";

const blockEnv = defineHandler(
  "PreToolUse",
  { matcher: "Write" },
  async (input) => {
    if (input.tool_input.file_path.endsWith(".env")) {
      return {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny" as const,
          permissionDecisionReason: "blocked",
        },
      };
    }
    return {};
  },
);

describe("testHandler", () => {
  it("calls the handler with auto-filled base fields", async () => {
    const result = await testHandler(blockEnv, {
      tool_name: "Write",
      tool_input: { file_path: ".env", content: "SECRET=1" },
      tool_use_id: "tu_1",
    });

    expect(result.hookSpecificOutput?.permissionDecision).toBe("deny");
  });

  it("returns empty object for non-matching input", async () => {
    const result = await testHandler(blockEnv, {
      tool_name: "Write",
      tool_input: { file_path: "app.ts", content: "code" },
      tool_use_id: "tu_2",
    });

    expect(result).toEqual({});
  });

  it("allows overriding base fields", async () => {
    const result = await testHandler(blockEnv, {
      session_id: "custom-session",
      cwd: "/custom/dir",
      tool_name: "Write",
      tool_input: { file_path: "app.ts", content: "code" },
      tool_use_id: "tu_3",
    });

    expect(result).toEqual({});
  });
});
