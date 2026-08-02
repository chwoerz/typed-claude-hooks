import { relative, resolve } from "node:path";
import { ensureSandbox } from "./sandbox.js";
import { SANDBOX_DIR, SANDBOX_FILES } from "./sandbox-templates.js";

export function init(): void {
  const sandboxDir = resolve(SANDBOX_DIR);
  const created = ensureSandbox({ sandboxDir });
  const skipped = SANDBOX_FILES.filter((name) => !created.includes(name));

  for (const name of skipped) {
    console.log(`Skipped ${relative(process.cwd(), resolve(sandboxDir, name))} (exists)`);
  }

  console.log("\nBuild with: npx typed-claude-hooks");
}
