import { describe, expect, it } from "vitest";
import { defineHandler } from "../../src/authoring/define-handler.js";
import { testHandler } from "../../src/testing/test-handler.js";

const blockEnv = defineHandler("PreToolUse", { matcher: "Write" }, async (input) => {
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
});

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

  it("injects the handler event into hook-specific output", async () => {
    const handler = defineHandler("PreToolUse", { matcher: "Write" }, async () => ({
      hookSpecificOutput: { permissionDecision: "deny" as const },
    }));
    const result = await testHandler(handler, {
      tool_name: "Write",
      tool_input: { file_path: ".env", content: "SECRET=1" },
      tool_use_id: "tu_4",
    });

    expect(result.hookSpecificOutput?.hookEventName).toBe("PreToolUse");
  });

  it("preserves a supplied hook event name", async () => {
    const authorResult = {
      hookSpecificOutput: {
        hookEventName: "PreToolUse" as const,
        permissionDecision: "deny" as const,
      },
    };
    const handler = defineHandler("PreToolUse", { matcher: "Write" }, async () => authorResult);
    const result = await testHandler(handler, {
      tool_name: "Write",
      tool_input: { file_path: ".env", content: "SECRET=1" },
      tool_use_id: "tu_5",
    });

    expect(result).toBe(authorResult);
    expect(result.hookSpecificOutput?.hookEventName).toBe("PreToolUse");
  });

  it("does not mutate the object returned by the handler", async () => {
    const authorResult = {
      hookSpecificOutput: { permissionDecision: "deny" as const },
    };
    const handler = defineHandler("PreToolUse", { matcher: "Write" }, async () => authorResult);

    const result = await testHandler(handler, {
      tool_name: "Write",
      tool_input: { file_path: ".env", content: "SECRET=1" },
      tool_use_id: "tu_6",
    });

    expect(result).not.toBe(authorResult);
    expect(result.hookSpecificOutput).not.toBe(authorResult.hookSpecificOutput);
    expect(authorResult).toEqual({
      hookSpecificOutput: { permissionDecision: "deny" },
    });
  });

  it("returns an empty object unchanged", async () => {
    const result = await testHandler(blockEnv, {
      tool_name: "Write",
      tool_input: { file_path: "app.ts", content: "code" },
      tool_use_id: "tu_7",
    });

    expect(result).toEqual({});
  });
});
