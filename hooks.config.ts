import { defineHandler } from "typed-claude-hooks";

export const blockDangerous = defineHandler("PreToolUse", { matcher: "Bash" }, async (_input) => {
  return {};
});

export const onStop = defineHandler("Stop", async (_input) => {
  return {};
});
