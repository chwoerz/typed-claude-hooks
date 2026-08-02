import { relative, resolve } from "node:path";
import { npmInstall, planDependencySync, readDependencyState, writeDeclaredSpec } from "./sandbox-deps.js";
import { scaffoldSandbox } from "./sandbox-templates.js";
import { cliVersion } from "./version.js";

export interface EnsureSandboxOptions {
  sandboxDir: string;
  version?: string;
  install?: (sandboxDir: string) => void;
}

export function ensureSandbox(options: EnsureSandboxOptions): void {
  const { sandboxDir, version = cliVersion, install = npmInstall } = options;
  const created = scaffoldSandbox(sandboxDir, version);

  for (const name of created) {
    console.log(`Created ${relative(process.cwd(), resolve(sandboxDir, name))}`);
  }

  const plan = planDependencySync(readDependencyState(sandboxDir), version);
  if (plan.action === "skip") return;

  writeDeclaredSpec(sandboxDir, plan.spec);
  console.log(`Installing typed-claude-hooks@${plan.spec}...`);
  install(sandboxDir);
}
