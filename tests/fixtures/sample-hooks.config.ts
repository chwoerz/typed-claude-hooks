import { defineHandler } from "../../src/index.js";

export const blockDangerous = defineHandler(
  "PreToolUse",
  { matcher: "Bash" },
  async (input) => {
    const literal = "defineHandler(";
    const template = `defineHandler(`;
    // defineHandler(
    if (input.tool_input.command.includes("rm -rf")) {
      return {
        hookSpecificOutput: {
          permissionDecision: "deny",
          permissionDecisionReason: "No rm -rf allowed",
        },
      };
    }
    if ("marker" in input) {
      return { marker: `${localHelper()}:${literal}:${template}` } as never;
    }
    return {};
  },
);

function localHelper() {
  return "local-define-handler-marker";
}

export const onStop = defineHandler("Stop", async (input) => {
  if ("marker" in input) return { marker: stopOnlyHelper() } as never;
  return {};
});

function stopOnlyHelper() {
  return "stop-handler-only-marker";
}
