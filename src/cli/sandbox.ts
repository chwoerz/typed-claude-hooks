import { relative, resolve } from "node:path";
import {
  type DependencyPlan,
  missingDependencies,
  npmInstall,
  planDependencySync,
  readDependencyState,
  writeDeclaredSpec,
} from "./sandbox-deps.js";
import { scaffoldSandbox } from "./sandbox-templates.js";
import { cliVersion } from "./version.js";

export interface EnsureSandboxOptions {
  sandboxDir: string;
  version?: string;
  install?: (sandboxDir: string) => void;
}

function installMessage(plan: DependencyPlan, missing: string[]): string {
  if (plan.action === "install") return `Installing typed-claude-hooks@${plan.spec}...`;
  return `Installing missing sandbox dependencies: ${missing.join(", ")}...`;
}

export function ensureSandbox(options: EnsureSandboxOptions): string[] {
  const { sandboxDir, version = cliVersion, install = npmInstall } = options;
  const created = scaffoldSandbox(sandboxDir, version);

  for (const name of created) {
    console.log(`Created ${relative(process.cwd(), resolve(sandboxDir, name))}`);
  }

  const plan = planDependencySync(readDependencyState(sandboxDir), version);
  const missing = missingDependencies(sandboxDir);
  if (plan.action === "skip" && missing.length === 0) return created;

  if (plan.action === "install") writeDeclaredSpec(sandboxDir, plan.spec);
  console.log(installMessage(plan, missing));
  install(sandboxDir);
  return created;
}
