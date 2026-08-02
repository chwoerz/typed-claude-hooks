import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";
import { generateRuntime } from "../../src/compiler/runtime-template.js";

function executeRuntime(handlerExpression: string) {
  const child = spawn(process.execPath, ["--input-type=module", "--eval", generateRuntime(handlerExpression)]);
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];

  child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
  child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
  child.stdin.end(JSON.stringify({ hook_event_name: "PreToolUse" }));

  return new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve) => {
    child.on("close", (status) => {
      resolve({
        status,
        stdout: Buffer.concat(stdout).toString(),
        stderr: Buffer.concat(stderr).toString(),
      });
    });
  });
}

describe("generateRuntime", () => {
  it("produces valid JS with stdin/stdout handling", () => {
    const code = generateRuntime("myHandler");
    expect(code).toContain("process.stdin");
    expect(code).toContain("process.stdout");
    expect(code).toContain("JSON.parse");
    expect(code).not.toContain("process.exit(0)");
    expect(code).toContain("process.exitCode = 2");
  });

  it("injects the handler expression", () => {
    const code = generateRuntime("blockRm.handler");
    expect(code).toContain("blockRm.handler(");
  });

  it("produces code that can be evaluated", () => {
    const code = generateRuntime("function(){}");
    expect(() => new Function(code)).not.toThrow();
  });

  it("injects the input event without mutating frozen handler output", async () => {
    const execution = await executeRuntime(
      "function() { return Object.freeze({ hookSpecificOutput: Object.freeze({ permissionDecision: 'deny' }) }); }",
    );

    expect(execution).toEqual({
      status: 0,
      stdout: JSON.stringify({
        hookSpecificOutput: {
          permissionDecision: "deny",
          hookEventName: "PreToolUse",
        },
      }),
      stderr: "",
    });
  });

  it("preserves a supplied hook event name", async () => {
    const execution = await executeRuntime(
      "function() { return { hookSpecificOutput: { hookEventName: 'PostToolUse' } }; }",
    );

    expect(JSON.parse(execution.stdout)).toEqual({
      hookSpecificOutput: { hookEventName: "PostToolUse" },
    });
  });

  it("does not write an empty result", async () => {
    const execution = await executeRuntime("function() { return {}; }");

    expect(execution).toEqual({ status: 0, stdout: "", stderr: "" });
  });

  it("reports handler errors without writing output", async () => {
    const execution = await executeRuntime("function() { throw new Error('handler failed'); }");

    expect(execution.status).toBe(2);
    expect(execution.stdout).toBe("");
    expect(execution.stderr).toContain("Error: handler failed");
  });
});
