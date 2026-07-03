import { defineHandler } from "../../src/authoring/define-handler.js";

export const blockDangerous = defineHandler(
  "PreToolUse",
  { matcher: "Bash" },
  async (_input) => {
    const _u = aHelper();
    return {};
  },
);

function aHelper() {
  return "asdf";
}

export const onStop = defineHandler("Stop", async (_input) => {
  return {};
});
