import { defineHandler } from "typed-claude-hooks";

export const blockDangerous = defineHandler(
  "PreToolUse",
  { matcher: "Bash" },
  async (input) => {
    return {};
  },
);

export const onStop = defineHandler("Stop", async (input) => {
  return {};
});
