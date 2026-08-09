export const starterSource = `import { defineHandler } from "@typed-rocks/typed-claude-hooks"

export const blockRm = defineHandler(
  "PreToolUse",
  { matcher: "Bash" },
  async (input) => ({
    hookSpecificOutput: input.tool_input.command.includes("rm ")
      ? {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: "Blocked rm",
        }
      : undefined,
  }),
)
`;
