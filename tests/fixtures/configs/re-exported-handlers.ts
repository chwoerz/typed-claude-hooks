import { defineHandler } from "../../../src/index.js";

const unrelatedString = "defineHandler(";
// defineHandler( in an unrelated comment must remain untouched.

export const reExportedPreToolUse = defineHandler(
  "PreToolUse",
  { matcher: "Bash" },
  async (input) => {
    if ("marker" in input) {
      return {
        marker: `re-exported-pre-tool-use-marker:${unrelatedString}`,
      } as never;
    }
    return {};
  },
);

export const reExportedStop = defineHandler("Stop", async (input) => {
  if ("marker" in input) {
    return { marker: "re-exported-stop-marker" } as never;
  }
  return {};
});
