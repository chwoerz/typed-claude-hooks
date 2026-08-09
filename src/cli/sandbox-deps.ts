import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const PACKAGE_NAME = "typed-claude-hooks";
const LOCAL_SPEC = /^(file|link):/;

export interface DependencyState {
  declaredSpec: string | undefined;
  installedVersion: string | undefined;
}

export interface DependencyPlan {
  action: "skip" | "install";
  spec: string;
}

export function planDependencySync(state: DependencyState, cliVersion: string): DependencyPlan {
  const { declaredSpec, installedVersion } = state;

  if (declaredSpec && LOCAL_SPEC.test(declaredSpec)) {
    return { action: installedVersion ? "skip" : "install", spec: declaredSpec };
  }
  if (declaredSpec === cliVersion && installedVersion === cliVersion) {
    return { action: "skip", spec: cliVersion };
  }
  return { action: "install", spec: cliVersion };
}

function readJson(path: string): Record<string, unknown> | undefined {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch {
    throw new Error(`Failed to parse ${path} — is it valid JSON?`);
  }
}

function readDependencies(manifest: Record<string, unknown> | undefined): Record<string, string> {
  const dependencies = manifest?.dependencies;
  return dependencies && typeof dependencies === "object" ? (dependencies as Record<string, string>) : {};
}

export function readDependencyState(sandboxDir: string): DependencyState {
  const manifest = readJson(resolve(sandboxDir, "package.json"));
  const installed = readJson(resolve(sandboxDir, "node_modules", PACKAGE_NAME, "package.json"));
  const installedVersion = installed?.version;

  return {
    declaredSpec: readDependencies(manifest)[PACKAGE_NAME],
    installedVersion: typeof installedVersion === "string" ? installedVersion : undefined,
  };
}

function readDevDependencies(manifest: Record<string, unknown> | undefined): Record<string, string> {
  const devDependencies = manifest?.devDependencies;
  return devDependencies && typeof devDependencies === "object" ? (devDependencies as Record<string, string>) : {};
}

export function missingDependencies(sandboxDir: string): string[] {
  const manifest = readJson(resolve(sandboxDir, "package.json"));
  const names = [...Object.keys(readDependencies(manifest)), ...Object.keys(readDevDependencies(manifest))];
  return names.filter((name) => !existsSync(resolve(sandboxDir, "node_modules", name, "package.json")));
}

export function writeDeclaredSpec(sandboxDir: string, spec: string): void {
  const manifestPath = resolve(sandboxDir, "package.json");
  const manifest = readJson(manifestPath) ?? {};
  const dependencies = { ...readDependencies(manifest), [PACKAGE_NAME]: spec };

  writeFileSync(manifestPath, `${JSON.stringify({ ...manifest, dependencies }, null, 2)}\n`);
}

export function npmInstall(sandboxDir: string): void {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  try {
    // --include=dev overrides an omit=dev coming from NODE_ENV=production or the user's .npmrc.
    // Without it @types/node never lands in the sandbox and every run reinstalls it.
    execFileSync(npm, ["install", "--include=dev", "--prefix", sandboxDir], { stdio: "inherit" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`npm install failed in ${sandboxDir}: ${message}`);
  }
}
