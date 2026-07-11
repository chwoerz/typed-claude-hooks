import { defineHandler } from "../../../src/index.js";

export const powerShellHandler = defineHandler(
  "PreToolUse",
  { matcher: "Bash", shell: "powershell" },
  async () => ({}),
);
