# Auto-Init Sandbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `typed-claude-hooks` a zero-argument command that scaffolds and installs a self-contained `.typed-claude-hooks/` npm project on first run, then builds. The `build` subcommand goes away (building is the default action); `init` is retained as the one subcommand, doing the same scaffold and install without the build.

**Architecture:** Three new small modules under `src/cli/` — `version.ts` (reads the CLI's own version), `sandbox-templates.ts` (file templates + scaffolding), `sandbox-deps.ts` (dependency state, sync planning, npm invocation) — composed by `sandbox.ts` (`ensureSandbox`) and `run.ts` (`ensureSandbox` then `build`). `src/cli/index.ts` becomes a default action plus a single `init` subcommand. `src/cli/init.ts` shrinks to a thin wrapper over `ensureSandbox`. `src/cli/build.ts` is not modified at all.

**Tech Stack:** TypeScript (ESM, NodeNext), commander, esbuild, vitest, Biome.

## Global Constraints

- Sandbox directory name: `.typed-claude-hooks` — exactly this string.
- Config file name inside it: `hooks.config.ts`.
- Default settings output: `.claude/settings.json`.
- Scaffolded files: `package.json`, `hooks.config.ts`, `tsconfig.json`, `.gitignore`. Never overwrite an existing file. `package-lock.json` and `node_modules/` come from npm, not from scaffolding.
- A `file:` or `link:` dependency specifier in the sandbox `package.json` is never rewritten.
- Only the `typed-claude-hooks` entry in the sandbox `package.json` `dependencies` may be modified; every other key and dependency is preserved.
- Scaffolding and dependency sync run **only** when the user passes no `[config]` argument. An explicit config path builds that file and touches nothing else.
- `init` is the single subcommand. It runs the same scaffold and dependency sync as the bare command and then stops — no build, no `settings.json`, no hook artifacts. It never overwrites, and it reports skipped files.
- The `build` subcommand is gone; building is the bare command's default action.
- No backwards compatibility with a root-level `hooks.config.ts`.
- Code style (from `CLAUDE.md`): `const` over `let`; extract repeated property accesses into consts; `map`/`filter`/`flatMap` over loops, `for...of` only for side effects or early exits; never `reduce`.
- Every task ends with `npm run check` and `npm test` passing.

---

### Task 1: CLI version + sandbox templates

**Files:**
- Create: `src/cli/version.ts`
- Create: `src/cli/sandbox-templates.ts`
- Test: `tests/cli/sandbox-templates.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `cliVersion: string` (from `src/cli/version.ts`)
  - `SANDBOX_DIR: string` = `".typed-claude-hooks"`, `CONFIG_FILE_NAME: string` = `"hooks.config.ts"`
  - `scaffoldSandbox(sandboxDir: string, version: string): string[]` — creates the directory and any missing files, returns the file names it created, in the order `["package.json", "hooks.config.ts", "tsconfig.json", ".gitignore"]`.

- [ ] **Step 1: Write the failing test**

Create `tests/cli/sandbox-templates.test.ts`:

```ts
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scaffoldSandbox } from "../../src/cli/sandbox-templates.js";
import { cliVersion } from "../../src/cli/version.js";

const PACKAGE_ROOT = resolve(import.meta.dirname, "../..");
const tempDirs: string[] = [];

function makeSandboxPath(): string {
  const tempDir = mkdtempSync(resolve(tmpdir(), "tch-scaffold-"));
  tempDirs.push(tempDir);
  return resolve(tempDir, ".typed-claude-hooks");
}

describe("cliVersion", () => {
  it("matches the package.json version", () => {
    const manifest = JSON.parse(readFileSync(resolve(PACKAGE_ROOT, "package.json"), "utf8")) as { version: string };

    expect(cliVersion).toBe(manifest.version);
  });
});

describe("scaffoldSandbox", () => {
  afterEach(() => {
    tempDirs.forEach((path) => rmSync(path, { recursive: true, force: true }));
    tempDirs.length = 0;
  });

  it("creates the four sandbox files pinned to the given version", () => {
    const sandboxDir = makeSandboxPath();

    const created = scaffoldSandbox(sandboxDir, "1.2.3");

    expect(created).toEqual(["package.json", "hooks.config.ts", "tsconfig.json", ".gitignore"]);

    const manifest = JSON.parse(readFileSync(resolve(sandboxDir, "package.json"), "utf8"));
    expect(manifest.dependencies["typed-claude-hooks"]).toBe("1.2.3");
    expect(manifest.private).toBe(true);
    expect(manifest.type).toBe("module");

    const config = readFileSync(resolve(sandboxDir, "hooks.config.ts"), "utf8");
    expect(config).toMatch(/export const protectEnvFiles = defineHandler\("PreToolUse"/);
    expect(config).not.toContain("export default");

    const tsconfig = JSON.parse(readFileSync(resolve(sandboxDir, "tsconfig.json"), "utf8"));
    expect(tsconfig.compilerOptions.module).toBe("NodeNext");
    expect(tsconfig.compilerOptions.moduleResolution).toBe("NodeNext");
    expect(tsconfig.compilerOptions.strict).toBe(true);
    expect(tsconfig.include).toEqual(["**/*.ts"]);

    expect(readFileSync(resolve(sandboxDir, ".gitignore"), "utf8")).toBe("node_modules/\n");
  });

  it("never overwrites an existing file", () => {
    const sandboxDir = makeSandboxPath();
    scaffoldSandbox(sandboxDir, "1.2.3");
    writeFileSync(resolve(sandboxDir, "hooks.config.ts"), "// mine\n");

    const created = scaffoldSandbox(sandboxDir, "1.2.3");

    expect(created).toEqual([]);
    expect(readFileSync(resolve(sandboxDir, "hooks.config.ts"), "utf8")).toBe("// mine\n");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cli/sandbox-templates.test.ts`
Expected: FAIL — cannot resolve `../../src/cli/sandbox-templates.js` and `../../src/cli/version.js`.

- [ ] **Step 3: Write `src/cli/version.ts`**

`import.meta.url` points at `src/cli/version.ts` under tsx and at `dist/cli/version.js` after `tsc`. Three `..` segments reach the package root from either location.

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageJsonPath = resolve(fileURLToPath(import.meta.url), "../../../package.json");

export const cliVersion = (JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version: string }).version;
```

- [ ] **Step 4: Write `src/cli/sandbox-templates.ts`**

```ts
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const SANDBOX_DIR = ".typed-claude-hooks";
export const CONFIG_FILE_NAME = "hooks.config.ts";

const CONFIG_TEMPLATE = `import { defineHandler } from "typed-claude-hooks"

export const protectEnvFiles = defineHandler("PreToolUse", { matcher: "Write|Edit" }, async (input) => {
  if (input.tool_input.file_path.endsWith(".env")) {
    return {
      hookSpecificOutput: {
        permissionDecision: "deny" as const,
        permissionDecisionReason: "Cannot modify .env files",
      },
    }
  }
  return {}
})
`;

const TSCONFIG_TEMPLATE = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["**/*.ts"]
}
`;

const GITIGNORE_TEMPLATE = "node_modules/\n";

function packageJsonTemplate(version: string): string {
  const manifest = {
    name: "typed-claude-hooks-config",
    private: true,
    type: "module",
    dependencies: { "typed-claude-hooks": version },
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function scaffoldSandbox(sandboxDir: string, version: string): string[] {
  mkdirSync(sandboxDir, { recursive: true });

  const files: Array<[string, string]> = [
    ["package.json", packageJsonTemplate(version)],
    [CONFIG_FILE_NAME, CONFIG_TEMPLATE],
    ["tsconfig.json", TSCONFIG_TEMPLATE],
    [".gitignore", GITIGNORE_TEMPLATE],
  ];

  return files
    .filter(([name]) => !existsSync(resolve(sandboxDir, name)))
    .map(([name, contents]) => {
      writeFileSync(resolve(sandboxDir, name), contents);
      return name;
    });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/cli/sandbox-templates.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 6: Check formatting and lint**

Run: `npm run check`
Expected: no errors. If formatting complains, run `npm run format` and re-run.

- [ ] **Step 7: Commit**

```bash
git add src/cli/version.ts src/cli/sandbox-templates.ts tests/cli/sandbox-templates.test.ts
git commit -m "feat: add sandbox templates and CLI version resolution"
```

---

### Task 2: Dependency state and sync planning

**Files:**
- Create: `src/cli/sandbox-deps.ts`
- Test: `tests/cli/sandbox-deps.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces:
  - `interface DependencyState { declaredSpec: string | undefined; installedVersion: string | undefined }`
  - `interface DependencyPlan { action: "skip" | "install"; spec: string }`
  - `planDependencySync(state: DependencyState, cliVersion: string): DependencyPlan`
  - `readDependencyState(sandboxDir: string): DependencyState`
  - `writeDeclaredSpec(sandboxDir: string, spec: string): void`
  - `npmInstall(sandboxDir: string): void`

- [ ] **Step 1: Write the failing test**

Create `tests/cli/sandbox-deps.test.ts`:

```ts
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  type DependencyState,
  planDependencySync,
  readDependencyState,
  writeDeclaredSpec,
} from "../../src/cli/sandbox-deps.js";

const tempDirs: string[] = [];

function makeSandbox(): string {
  const tempDir = mkdtempSync(resolve(tmpdir(), "tch-deps-"));
  tempDirs.push(tempDir);
  const sandboxDir = resolve(tempDir, ".typed-claude-hooks");
  mkdirSync(sandboxDir, { recursive: true });
  return sandboxDir;
}

function writeInstalled(sandboxDir: string, version: string): void {
  const dir = resolve(sandboxDir, "node_modules/typed-claude-hooks");
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, "package.json"), JSON.stringify({ name: "typed-claude-hooks", version }));
}

afterEach(() => {
  tempDirs.forEach((path) => rmSync(path, { recursive: true, force: true }));
  tempDirs.length = 0;
});

describe("planDependencySync", () => {
  const cases: Array<[DependencyState, "skip" | "install", string]> = [
    [{ declaredSpec: undefined, installedVersion: undefined }, "install", "1.2.3"],
    [{ declaredSpec: "1.2.3", installedVersion: undefined }, "install", "1.2.3"],
    [{ declaredSpec: "1.2.3", installedVersion: "1.0.0" }, "install", "1.2.3"],
    [{ declaredSpec: "^1.2.3", installedVersion: "1.2.3" }, "install", "1.2.3"],
    [{ declaredSpec: "1.2.3", installedVersion: "1.2.3" }, "skip", "1.2.3"],
    [{ declaredSpec: "file:..", installedVersion: "0.9.0" }, "skip", "file:.."],
    [{ declaredSpec: "file:..", installedVersion: undefined }, "install", "file:.."],
    [{ declaredSpec: "link:../pkg", installedVersion: "0.9.0" }, "skip", "link:../pkg"],
  ];

  it.each(cases)("plans %o as %s", (state, action, spec) => {
    expect(planDependencySync(state, "1.2.3")).toEqual({ action, spec });
  });
});

describe("readDependencyState", () => {
  it("reads the declared spec and the installed version", () => {
    const sandboxDir = makeSandbox();
    writeFileSync(
      resolve(sandboxDir, "package.json"),
      JSON.stringify({ dependencies: { "typed-claude-hooks": "1.2.3", zod: "^3.24.0" } }),
    );
    writeInstalled(sandboxDir, "1.0.0");

    expect(readDependencyState(sandboxDir)).toEqual({ declaredSpec: "1.2.3", installedVersion: "1.0.0" });
  });

  it("reports undefined for a missing manifest and a missing install", () => {
    expect(readDependencyState(makeSandbox())).toEqual({ declaredSpec: undefined, installedVersion: undefined });
  });

  it("throws a readable error for malformed JSON", () => {
    const sandboxDir = makeSandbox();
    const manifestPath = resolve(sandboxDir, "package.json");
    writeFileSync(manifestPath, "{ malformed");

    expect(() => readDependencyState(sandboxDir)).toThrow(`Failed to parse ${manifestPath}`);
  });
});

describe("writeDeclaredSpec", () => {
  it("updates only the typed-claude-hooks entry", () => {
    const sandboxDir = makeSandbox();
    writeFileSync(
      resolve(sandboxDir, "package.json"),
      JSON.stringify({
        name: "typed-claude-hooks-config",
        private: true,
        type: "module",
        dependencies: { "typed-claude-hooks": "1.0.0", zod: "^3.24.0" },
      }),
    );

    writeDeclaredSpec(sandboxDir, "1.2.3");

    const manifest = JSON.parse(readFileSync(resolve(sandboxDir, "package.json"), "utf8"));
    expect(manifest.dependencies).toEqual({ "typed-claude-hooks": "1.2.3", zod: "^3.24.0" });
    expect(manifest.name).toBe("typed-claude-hooks-config");
    expect(manifest.private).toBe(true);
    expect(manifest.type).toBe("module");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cli/sandbox-deps.test.ts`
Expected: FAIL — cannot resolve `../../src/cli/sandbox-deps.js`.

- [ ] **Step 3: Write `src/cli/sandbox-deps.ts`**

```ts
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

export function writeDeclaredSpec(sandboxDir: string, spec: string): void {
  const manifestPath = resolve(sandboxDir, "package.json");
  const manifest = readJson(manifestPath) ?? {};
  const dependencies = { ...readDependencies(manifest), [PACKAGE_NAME]: spec };

  writeFileSync(manifestPath, `${JSON.stringify({ ...manifest, dependencies }, null, 2)}\n`);
}

export function npmInstall(sandboxDir: string): void {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  try {
    execFileSync(npm, ["install", "--prefix", sandboxDir], { stdio: "inherit" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`npm install failed in ${sandboxDir}: ${message}`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/cli/sandbox-deps.test.ts`
Expected: PASS — 12 tests (8 parameterised + 4).

- [ ] **Step 5: Check formatting and lint**

Run: `npm run check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/cli/sandbox-deps.ts tests/cli/sandbox-deps.test.ts
git commit -m "feat: add sandbox dependency state and sync planning"
```

---

### Task 3: `ensureSandbox` orchestration

**Files:**
- Create: `src/cli/sandbox.ts`
- Test: `tests/cli/sandbox.test.ts`

**Interfaces:**
- Consumes: `scaffoldSandbox`, `CONFIG_FILE_NAME`, `SANDBOX_DIR` (Task 1); `cliVersion` (Task 1); `planDependencySync`, `readDependencyState`, `writeDeclaredSpec`, `npmInstall` (Task 2).
- Produces: `ensureSandbox(options: EnsureSandboxOptions): void` where
  `interface EnsureSandboxOptions { sandboxDir: string; version?: string; install?: (sandboxDir: string) => void }`.
  `version` defaults to `cliVersion`; `install` defaults to `npmInstall` and exists so tests can inject a spy.

- [ ] **Step 1: Write the failing test**

Create `tests/cli/sandbox.test.ts`:

```ts
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureSandbox } from "../../src/cli/sandbox.js";

const tempDirs: string[] = [];

function makeSandboxPath(): string {
  const tempDir = mkdtempSync(resolve(tmpdir(), "tch-ensure-"));
  tempDirs.push(tempDir);
  return resolve(tempDir, ".typed-claude-hooks");
}

function writeInstalled(sandboxDir: string, version: string): void {
  const dir = resolve(sandboxDir, "node_modules/typed-claude-hooks");
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, "package.json"), JSON.stringify({ name: "typed-claude-hooks", version }));
}

describe("ensureSandbox", () => {
  afterEach(() => {
    tempDirs.forEach((path) => rmSync(path, { recursive: true, force: true }));
    tempDirs.length = 0;
  });

  it("scaffolds and installs on a first run", () => {
    const sandboxDir = makeSandboxPath();
    const install = vi.fn();

    ensureSandbox({ sandboxDir, version: "1.2.3", install });

    expect(existsSync(resolve(sandboxDir, "hooks.config.ts"))).toBe(true);
    expect(existsSync(resolve(sandboxDir, "tsconfig.json"))).toBe(true);
    expect(existsSync(resolve(sandboxDir, ".gitignore"))).toBe(true);
    expect(install).toHaveBeenCalledWith(sandboxDir);
    expect(install).toHaveBeenCalledTimes(1);
  });

  it("does not install again when the sandbox already matches", () => {
    const sandboxDir = makeSandboxPath();
    ensureSandbox({ sandboxDir, version: "1.2.3", install: vi.fn() });
    writeInstalled(sandboxDir, "1.2.3");
    const install = vi.fn();

    ensureSandbox({ sandboxDir, version: "1.2.3", install });

    expect(install).not.toHaveBeenCalled();
  });

  it("reinstalls and repins when the installed version drifts", () => {
    const sandboxDir = makeSandboxPath();
    ensureSandbox({ sandboxDir, version: "1.0.0", install: vi.fn() });
    writeInstalled(sandboxDir, "1.0.0");
    const install = vi.fn();

    ensureSandbox({ sandboxDir, version: "1.2.3", install });

    const manifest = JSON.parse(readFileSync(resolve(sandboxDir, "package.json"), "utf8"));
    expect(manifest.dependencies["typed-claude-hooks"]).toBe("1.2.3");
    expect(install).toHaveBeenCalledTimes(1);
  });

  it("propagates an install failure instead of continuing", () => {
    const sandboxDir = makeSandboxPath();
    const install = vi.fn(() => {
      throw new Error("npm install failed in /tmp/x: exit 1");
    });

    expect(() => ensureSandbox({ sandboxDir, version: "1.2.3", install })).toThrow("npm install failed");
  });

  it("leaves a file: specifier alone when it is already installed", () => {
    const sandboxDir = makeSandboxPath();
    ensureSandbox({ sandboxDir, version: "1.0.0", install: vi.fn() });
    writeFileSync(
      resolve(sandboxDir, "package.json"),
      JSON.stringify({ dependencies: { "typed-claude-hooks": "file:.." } }),
    );
    writeInstalled(sandboxDir, "9.9.9");
    const install = vi.fn();

    ensureSandbox({ sandboxDir, version: "1.2.3", install });

    const manifest = JSON.parse(readFileSync(resolve(sandboxDir, "package.json"), "utf8"));
    expect(manifest.dependencies["typed-claude-hooks"]).toBe("file:..");
    expect(install).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cli/sandbox.test.ts`
Expected: FAIL — cannot resolve `../../src/cli/sandbox.js`.

- [ ] **Step 3: Write `src/cli/sandbox.ts`**

`for...of` is used for the log loop because printing is a side effect.

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/cli/sandbox.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Check formatting and lint**

Run: `npm run check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/cli/sandbox.ts tests/cli/sandbox.test.ts
git commit -m "feat: add ensureSandbox scaffold and dependency sync orchestration"
```

---

### Task 4: Wire the CLI, rewrite `init`

**Files:**
- Create: `src/cli/run.ts`
- Create: `tests/cli/run.test.ts`
- Rewrite: `src/cli/index.ts`
- Rewrite: `src/cli/init.ts`
- Rewrite: `tests/cli/init.integration.test.ts`
- Modify: `src/cli/sandbox-templates.ts` (export `SANDBOX_FILES`, use it to build the scaffold list)
- Modify: `src/cli/sandbox.ts` (`ensureSandbox` returns the created file names)
- Modify: `tests/cli/build.integration.test.ts:32` and `tests/cli/build.integration.test.ts:270` (drop the `"build"` argument)

**Interfaces:**
- Consumes: `ensureSandbox` (Task 3); `SANDBOX_DIR`, `CONFIG_FILE_NAME`, `scaffoldSandbox` (Task 1); `build` from `src/cli/build.ts` (unchanged, signature `build(options: { config: string; output: string; hooksDir?: string; runtime?: Runtime }): Promise<void>`); `cliVersion` (Task 1).
- Produces:
  - `SANDBOX_FILES: readonly string[]` — the four scaffolded file names in scaffold order.
  - `ensureSandbox(options): string[]` — now returns the names it created (was `void`).
  - `init(): void` — scaffolds, syncs the dependency, reports created and skipped files, prints the follow-up command. Does not build.
  - `run(options: RunOptions): Promise<void>` where
    `interface RunOptions { config?: string; output: string; hooksDir?: string; runtime?: Runtime; ensure?: (sandboxDir: string) => void }`.
    `ensure` defaults to a call into `ensureSandbox` and exists so tests can assert the sandbox is skipped for an explicit config.

- [ ] **Step 1: Write the failing test**

Create `tests/cli/run.test.ts`. It uses `process.chdir` because `run` resolves the sandbox
relative to the working directory. That requires Vitest's default `forks` pool — `process.chdir`
throws inside worker threads. `vitest.config.ts` sets no `pool`, so the default applies; if this
test throws `chdir() is not supported in workers`, a `pool` was added and this file needs
`poolOptions` or its own `// @vitest-environment` override rather than a change to `run`.

```ts
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { run } from "../../src/cli/run.js";

const FIXTURE_CONFIG = resolve(import.meta.dirname, "../fixtures/sample-hooks.config.ts");
const tempDirs: string[] = [];
const originalCwd = process.cwd();

function makeTempDir(): string {
  const tempDir = mkdtempSync(resolve(tmpdir(), "tch-run-"));
  tempDirs.push(tempDir);
  return tempDir;
}

describe("run", () => {
  beforeEach(() => {
    process.chdir(makeTempDir());
  });

  afterEach(() => {
    process.chdir(originalCwd);
    tempDirs.forEach((path) => rmSync(path, { recursive: true, force: true }));
    tempDirs.length = 0;
  });

  it("skips the sandbox when an explicit config path is given", async () => {
    const ensure = vi.fn();

    await run({ config: FIXTURE_CONFIG, output: ".claude/settings.json", ensure });

    expect(ensure).not.toHaveBeenCalled();
    expect(existsSync(resolve(process.cwd(), ".typed-claude-hooks"))).toBe(false);
    expect(existsSync(resolve(process.cwd(), ".claude/settings.json"))).toBe(true);
  });

  it("ensures the sandbox and builds its config when no config path is given", async () => {
    const sandboxDir = resolve(process.cwd(), ".typed-claude-hooks");
    const ensure = vi.fn(() => {
      mkdirSync(sandboxDir, { recursive: true });
      // Reuse the fixture so the build has real handlers without a real npm install.
      const fixture = readFileSync(FIXTURE_CONFIG, "utf8");
      writeFileSync(resolve(sandboxDir, "hooks.config.ts"), fixture);
    });

    await run({ output: ".claude/settings.json", ensure });

    expect(ensure).toHaveBeenCalledWith(sandboxDir);
    expect(existsSync(resolve(process.cwd(), ".claude/settings.json"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cli/run.test.ts`
Expected: FAIL — cannot resolve `../../src/cli/run.js`.

- [ ] **Step 3: Write `src/cli/run.ts`**

```ts
import { resolve } from "node:path";
import type { Runtime } from "../types/mapping.js";
import { build } from "./build.js";
import { ensureSandbox } from "./sandbox.js";
import { CONFIG_FILE_NAME, SANDBOX_DIR } from "./sandbox-templates.js";

export interface RunOptions {
  config?: string;
  output: string;
  hooksDir?: string;
  runtime?: Runtime;
  ensure?: (sandboxDir: string) => void;
}

export async function run(options: RunOptions): Promise<void> {
  const { config, ensure = (sandboxDir: string) => ensureSandbox({ sandboxDir }), ...buildOptions } = options;

  if (config) {
    await build({ ...buildOptions, config: resolve(config) });
    return;
  }

  const sandboxDir = resolve(SANDBOX_DIR);
  ensure(sandboxDir);
  await build({ ...buildOptions, config: resolve(sandboxDir, CONFIG_FILE_NAME) });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/cli/run.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Rewrite `src/cli/index.ts`**

Replace the entire file:

```ts
#!/usr/bin/env node
import { Command, Option } from "commander";
import type { Runtime } from "../types/mapping.js";
import { init } from "./init.js";
import { run } from "./run.js";
import { cliVersion } from "./version.js";

interface ActionOptions {
  output: string;
  hooksDir?: string;
  runtime: Runtime;
}

function fail(err: unknown): never {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Error: ${message}`);
  process.exit(1);
}

const program = new Command();

program
  .name("typed-claude-hooks")
  .description("Type-safe Claude Code hooks in TypeScript")
  .version(cliVersion)
  .argument("[config]", "Path to config file (defaults to the .typed-claude-hooks sandbox)")
  .option("-o, --output <path>", "Path to output settings.json", ".claude/settings.json")
  .option("--hooks-dir <dir>", "Where to write compiled JS files")
  .addOption(
    new Option("--runtime <runtime>", "JavaScript runtime to use").choices(["node", "bun", "deno"]).default("node"),
  )
  .action((config: string | undefined, options: ActionOptions) => {
    run({ config, ...options }).catch(fail);
  });

program
  .command("init")
  .description("Scaffold the sandbox and install its dependency, without building")
  .action(() => {
    try {
      init();
    } catch (err) {
      fail(err);
    }
  });

program.parse();
```

**Commander caveat — verify, do not assume.** A program that has both its own
`[config]` argument with an action AND a subcommand must still route the literal
word `init` to the subcommand rather than treating it as a config path. Step 6's
test covers this; if commander v13 resolves it the other way, stop and report it
rather than working around it.

- [ ] **Step 6: Rewrite `src/cli/init.ts` and its test**

`init` is the same scaffold-and-sync as the bare command, minus the build. To
report skipped files it needs the full file list and the created subset, so two
earlier modules gain a small amount of surface.

In `src/cli/sandbox-templates.ts`, export the file-name list and build the
scaffold array from it (replacing the inline names in `files`):

```ts
export const SANDBOX_FILES = ["package.json", CONFIG_FILE_NAME, "tsconfig.json", ".gitignore"] as const;
```

In `src/cli/sandbox.ts`, change `ensureSandbox` to return the created names —
the existing body already has them in `created`:

```ts
export function ensureSandbox(options: EnsureSandboxOptions): string[] {
  // ...unchanged body...
  const plan = planDependencySync(readDependencyState(sandboxDir), version);
  if (plan.action === "skip") return created;

  writeDeclaredSpec(sandboxDir, plan.spec);
  console.log(`Installing typed-claude-hooks@${plan.spec}...`);
  install(sandboxDir);
  return created;
}
```

Then replace `src/cli/init.ts` entirely:

```ts
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
```

Replace `tests/cli/init.integration.test.ts` entirely. It uses the same
no-network sandbox setup as Task 5 — a `file:` specifier plus a symlink to the
repo — so `planDependencySync` returns `skip` and no npm install runs:

```ts
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const PACKAGE_ROOT = resolve(import.meta.dirname, "../..");
const CLI_PATH = resolve(PACKAGE_ROOT, "src/cli/index.ts");
const tempDirs: string[] = [];

function makeProject(): string {
  const tempDir = mkdtempSync(resolve(tmpdir(), "tch-init-"));
  tempDirs.push(tempDir);

  const sandboxDir = resolve(tempDir, ".typed-claude-hooks");
  const modulesDir = resolve(sandboxDir, "node_modules");
  mkdirSync(modulesDir, { recursive: true });
  symlinkSync(PACKAGE_ROOT, resolve(modulesDir, "typed-claude-hooks"), "dir");
  writeFileSync(
    resolve(sandboxDir, "package.json"),
    JSON.stringify({
      name: "typed-claude-hooks-config",
      private: true,
      type: "module",
      dependencies: { "typed-claude-hooks": `file:${PACKAGE_ROOT}` },
    }),
  );
  return tempDir;
}

function runInit(cwd: string): string {
  return execFileSync(process.execPath, ["--import", "tsx", CLI_PATH, "init"], { cwd, encoding: "utf-8" });
}

describe("init command", () => {
  afterEach(() => {
    for (const path of tempDirs) {
      rmSync(path, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it("scaffolds the sandbox without building", () => {
    const projectDir = makeProject();

    const output = runInit(projectDir);

    expect(output).toContain("Created .typed-claude-hooks/hooks.config.ts");
    expect(output).toContain("Build with: npx typed-claude-hooks");

    const sandboxDir = resolve(projectDir, ".typed-claude-hooks");
    const config = readFileSync(resolve(sandboxDir, "hooks.config.ts"), "utf8");
    expect(config).toMatch(/export const protectEnvFiles = defineHandler\("PreToolUse"/);
    expect(existsSync(resolve(sandboxDir, "tsconfig.json"))).toBe(true);
    expect(existsSync(resolve(sandboxDir, ".gitignore"))).toBe(true);

    expect(existsSync(resolve(projectDir, ".claude"))).toBe(false);
  });

  it("reports skipped files and overwrites nothing on a second run", () => {
    const projectDir = makeProject();
    runInit(projectDir);
    const configPath = resolve(projectDir, ".typed-claude-hooks/hooks.config.ts");
    writeFileSync(configPath, "// mine\n");

    const output = runInit(projectDir);

    expect(output).toContain("Skipped .typed-claude-hooks/hooks.config.ts (exists)");
    expect(output).toContain("Skipped .typed-claude-hooks/tsconfig.json (exists)");
    expect(output).not.toContain("Created");
    expect(readFileSync(configPath, "utf8")).toBe("// mine\n");
  });

  it("scaffolds a config that typechecks against the installed package", () => {
    const projectDir = makeProject();
    runInit(projectDir);

    execFileSync(
      process.execPath,
      [
        resolve(PACKAGE_ROOT, "node_modules/typescript/bin/tsc"),
        "--noEmit",
        "--project",
        resolve(projectDir, ".typed-claude-hooks"),
      ],
      { cwd: projectDir },
    );
  });
});
```

The typecheck test resolves `typed-claude-hooks` through the symlink to the repo
root, whose `package.json` points `types` at `dist/index.d.ts`. Run
`npm run build` once before running this file, or the type resolution fails.

- [ ] **Step 7: Update the existing build integration test**

In `tests/cli/build.integration.test.ts`, the CLI is spawned with a `"build"` subcommand that no longer exists. Remove that argument in both places.

At line 32, inside `runCli`, the array becomes:

```ts
    [
      "--import",
      "tsx",
      CLI_PATH,
      FIXTURE_CONFIG,
      "--output",
      SETTINGS_PATH,
      "--hooks-dir",
      HOOKS_DIR,
      ...runtimeArgs,
    ],
```

At line 270, the removed-options test becomes:

```ts
      ["--import", "tsx", CLI_PATH, FIXTURE_CONFIG, "--output", SETTINGS_PATH, option],
```

- [ ] **Step 8: Add a CLI surface test**

Append to `tests/cli/build.integration.test.ts`, inside the existing `describe("build command", ...)` block:

```ts
  it("builds by default and exposes only the init subcommand", () => {
    const result = spawnSync(process.execPath, ["--import", "tsx", CLI_PATH, "--help"], {
      cwd: process.cwd(),
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[config]");
    expect(result.stdout).toContain(".claude/settings.json");
    expect(result.stdout).toContain("init");
    expect(result.stdout).not.toContain("build [config]");
  });
```

- [ ] **Step 9: Run the full suite**

Run: `npm test`
Expected: PASS. Every test file passes; `tests/cli/init.integration.test.ts` is gone.

- [ ] **Step 10: Check formatting and lint**

Run: `npm run check`
Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add -A src/cli tests/cli
git commit -m "feat: replace init subcommand with zero-argument auto-init run"
```

---

### Task 5: Shared sandbox fixture + first-run end-to-end test

**Files:**
- Create: `tests/cli/sandbox-fixture.ts`
- Modify: `tests/cli/init.integration.test.ts` (use the shared fixture instead of its private helpers)
- Create: `tests/cli/first-run.integration.test.ts`

**Interfaces:**
- Consumes: the CLI entry point at `src/cli/index.ts` (Task 4).
- Produces (from `tests/cli/sandbox-fixture.ts`):
  - `PACKAGE_ROOT: string`, `CLI_PATH: string`
  - `makeProject(prefix: string): string` — temp project whose sandbox already has the repo linked in
  - `cleanupProjects(): void`
  - `runCli(cwd: string, args?: string[]): string`
  - `ensureBuilt(): void`

Task 4 gave `tests/cli/init.integration.test.ts` a private `makeProject()` helper. The
first-run test needs exactly the same setup, so this task extracts it once rather than
copying it. Both integration tests then exercise the real CLI against a real temp project.

The fixture pre-creates the sandbox `package.json` with a `file:` specifier and symlinks the
repo into the sandbox's `node_modules`. `planDependencySync` therefore returns `skip` and no
`npm install` runs — the tests need no network. The repo must be compiled first, because the
sandbox resolves `typed-claude-hooks` through the root `package.json` `main`/`types` fields,
which point into `dist/`.

- [ ] **Step 1: Write the shared fixture**

Create `tests/cli/sandbox-fixture.ts`:

```ts
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

export const PACKAGE_ROOT = resolve(import.meta.dirname, "../..");
export const CLI_PATH = resolve(PACKAGE_ROOT, "src/cli/index.ts");

// An absolute path is required here (rather than the bare "tsx" specifier used elsewhere):
// Node resolves a bare --import specifier from the child process's cwd, which for these
// tests is a temp project directory with no node_modules of its own.
const TSX_LOADER = resolve(PACKAGE_ROOT, "node_modules/tsx/dist/loader.mjs");
const NPM = process.platform === "win32" ? "npm.cmd" : "npm";

const tempDirs: string[] = [];

/**
 * A temp project whose sandbox already has the repo linked in as its typed-claude-hooks
 * dependency, declared with a file: specifier. planDependencySync therefore returns "skip",
 * so these tests never shell out to a real npm install.
 */
export function makeProject(prefix: string): string {
  const tempDir = mkdtempSync(resolve(tmpdir(), prefix));
  tempDirs.push(tempDir);

  const sandboxDir = resolve(tempDir, ".typed-claude-hooks");
  const modulesDir = resolve(sandboxDir, "node_modules");
  mkdirSync(modulesDir, { recursive: true });
  symlinkSync(PACKAGE_ROOT, resolve(modulesDir, "typed-claude-hooks"), "dir");
  writeFileSync(
    resolve(sandboxDir, "package.json"),
    JSON.stringify({
      name: "typed-claude-hooks-config",
      private: true,
      type: "module",
      dependencies: { "typed-claude-hooks": `file:${PACKAGE_ROOT}` },
    }),
  );
  return tempDir;
}

export function cleanupProjects(): void {
  for (const path of tempDirs) {
    rmSync(path, { recursive: true, force: true });
  }
  tempDirs.length = 0;
}

export function runCli(cwd: string, args: string[] = []): string {
  return execFileSync(process.execPath, ["--import", TSX_LOADER, CLI_PATH, ...args], { cwd, encoding: "utf-8" });
}

/**
 * The sandbox resolves typed-claude-hooks through the root package main/types fields, which
 * point into dist/. Build once if it is missing so a clean clone can run these tests.
 */
export function ensureBuilt(): void {
  if (existsSync(resolve(PACKAGE_ROOT, "dist/index.d.ts"))) return;
  execFileSync(NPM, ["run", "build"], { cwd: PACKAGE_ROOT, stdio: "inherit" });
}
```

- [ ] **Step 2: Point the init test at the fixture**

In `tests/cli/init.integration.test.ts`, delete the local `PACKAGE_ROOT`, `CLI_PATH`,
`TSX_LOADER`, `tempDirs`, `makeProject`, and `runInit` definitions along with the now-unused
`node:child_process`, `node:os`, and `node:fs` imports it only needed for them, and import
from the fixture instead. Keep every existing assertion exactly as it is.

The header becomes:

```ts
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { CLI_PATH, PACKAGE_ROOT, cleanupProjects, ensureBuilt, makeProject, runCli } from "./sandbox-fixture.js";

function runInit(cwd: string): string {
  return runCli(cwd, ["init"]);
}
```

`CLI_PATH` stays imported only if the file still references it; drop it from the import list
if nothing uses it. Replace the `afterEach` body with `cleanupProjects()`, add
`beforeAll(ensureBuilt)` inside the `describe`, and change each `makeProject()` call to
`makeProject("tch-init-")`. `execFileSync` and `PACKAGE_ROOT` remain needed by the
`tsc --noEmit` typecheck test.

- [ ] **Step 3: Run the init test to confirm the refactor is behavior-neutral**

Run: `npx vitest run tests/cli/init.integration.test.ts`
Expected: PASS — the same 3 tests as before.

- [ ] **Step 4: Write the first-run test**

Create `tests/cli/first-run.integration.test.ts`:

```ts
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanupProjects, ensureBuilt, makeProject, runCli } from "./sandbox-fixture.js";

interface GeneratedSettings {
  hooks: Record<string, Array<{ hooks: Array<{ command: string }>; matcher?: string }>>;
}

describe("first run", () => {
  beforeAll(ensureBuilt);

  afterEach(cleanupProjects);

  it("scaffolds the sandbox and builds it with no arguments", () => {
    const projectDir = makeProject("tch-first-run-");
    const sandboxDir = resolve(projectDir, ".typed-claude-hooks");

    const output = runCli(projectDir);

    expect(output).toContain("Created .typed-claude-hooks/hooks.config.ts");
    expect(output).not.toContain("Installing");

    expect(existsSync(resolve(sandboxDir, "tsconfig.json"))).toBe(true);
    expect(readFileSync(resolve(sandboxDir, ".gitignore"), "utf8")).toBe("node_modules/\n");

    const managedDir = resolve(projectDir, ".claude/hooks/typed-claude-hooks/PreToolUse");
    expect(existsSync(resolve(managedDir, "protectEnvFiles.mjs"))).toBe(true);
    expect(existsSync(resolve(managedDir, "protectEnvFiles.sh"))).toBe(true);

    const settings = JSON.parse(
      readFileSync(resolve(projectDir, ".claude/settings.json"), "utf-8"),
    ) as GeneratedSettings;
    expect(settings.hooks.PreToolUse).toHaveLength(1);
    expect(settings.hooks.PreToolUse[0].matcher).toBe("Write|Edit");
    expect(settings.hooks.PreToolUse[0].hooks[0].command).toContain("protectEnvFiles.sh");
  });

  it("is idempotent — a second run creates nothing new", () => {
    const projectDir = makeProject("tch-first-run-");
    writeFileSync(resolve(projectDir, ".typed-claude-hooks/marker.txt"), "keep");

    runCli(projectDir);
    const firstSettings = readFileSync(resolve(projectDir, ".claude/settings.json"), "utf-8");
    const secondOutput = runCli(projectDir);

    expect(secondOutput).not.toContain("Created");
    expect(readFileSync(resolve(projectDir, ".claude/settings.json"), "utf-8")).toBe(firstSettings);
    expect(readFileSync(resolve(projectDir, ".typed-claude-hooks/marker.txt"), "utf8")).toBe("keep");
  });
});
```

- [ ] **Step 5: Run the first-run test**

Run: `npx vitest run tests/cli/first-run.integration.test.ts`
Expected: PASS — 2 tests. Tasks 1–4 already implement this behavior, so this test verifies
the composition rather than driving new code. If an assertion fails, the defect is in
Tasks 1–4; report it rather than weakening the assertion.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS, with no failures.

- [ ] **Step 7: Check formatting and lint**

Run: `npm run check`
Expected: no errors in the files you touched. Do NOT run the repo-wide `npm run format`; if
formatting needs fixing, run `npx biome format --write` on your files only.

- [ ] **Step 8: Commit**

```bash
git add tests/cli/sandbox-fixture.ts tests/cli/first-run.integration.test.ts tests/cli/init.integration.test.ts
git commit -m "test: cover the zero-argument first-run path end to end"
```

---

### Task 6: Move this repo's own dogfooding config into the sandbox

**Files:**
- Delete: `hooks.config.ts` (repo root)
- Create: `.typed-claude-hooks/hooks.config.ts`
- Create: `.typed-claude-hooks/package.json`
- Create: `.typed-claude-hooks/tsconfig.json`
- Create: `.typed-claude-hooks/.gitignore`
- Modify: `tests/compiler/annotate-pure-handlers.test.ts:5`

**Interfaces:**
- Consumes: the sandbox layout from Tasks 1–4.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Move the config**

```bash
mkdir -p .typed-claude-hooks
git mv hooks.config.ts .typed-claude-hooks/hooks.config.ts
```

The file's contents are unchanged:

```ts
import { defineHandler } from "typed-claude-hooks";

export const blockDangerous = defineHandler("PreToolUse", { matcher: "Bash" }, async (_input) => {
  return {};
});

export const onStop = defineHandler("Stop", async (_input) => {
  return {};
});
```

- [ ] **Step 2: Write the sandbox manifest with a local specifier**

Create `.typed-claude-hooks/package.json`. The `file:..` specifier points at the repo root, so the sandbox resolves the package under development rather than a published version, and `planDependencySync` never rewrites it.

```json
{
  "name": "typed-claude-hooks-config",
  "private": true,
  "type": "module",
  "dependencies": {
    "typed-claude-hooks": "file:.."
  }
}
```

- [ ] **Step 3: Write the sandbox tsconfig and gitignore**

Create `.typed-claude-hooks/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["**/*.ts"]
}
```

Create `.typed-claude-hooks/.gitignore`:

```
node_modules/
```

- [ ] **Step 4: Fix the test that references the old path**

In `tests/compiler/annotate-pure-handlers.test.ts` line 5, change:

```ts
const CONFIG_PATH = resolve(import.meta.dirname, "../../hooks.config.ts");
```

to:

```ts
const CONFIG_PATH = resolve(import.meta.dirname, "../../.typed-claude-hooks/hooks.config.ts");
```

- [ ] **Step 5: Install the sandbox and dogfood a real build**

```bash
npm run build
npm install --prefix .typed-claude-hooks
node dist/cli/index.js
```

Expected: no `Created` lines (all four files already exist), no `Installing` line (the `file:` specifier is already installed), then the build summary listing `PreToolUse: blockDangerous` and `Stop: onStop`. `.claude/settings.json` should be unchanged from its committed state.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Check formatting and lint**

Run: `npm run check`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add -A .typed-claude-hooks hooks.config.ts tests/compiler/annotate-pure-handlers.test.ts .claude/settings.json
git commit -m "chore: move this repo's dogfooding config into the sandbox"
```

---

### Task 7: Update the README and the Astro site

**Files:**
- Modify: `README.md` (Quick Start around line 45–55, CLI section around line 140–170)
- Modify: `site/src/components/Hero.astro:9-11`
- Modify: `site/src/components/QuickStart.astro:2-10`
- Modify: `site/src/components/Docs.astro:41`, `:76-81`, `:115`, `:124-125`

**Interfaces:**
- Consumes: the final CLI surface from Task 4.
- Produces: nothing.

- [ ] **Step 1: Update the README Quick Start**

Replace the Quick Start block that currently reads:

````markdown
```bash
npm install -D typed-claude-hooks
npx typed-claude-hooks init
```

This creates a `hooks.config.ts` with an example hook. Edit it, then build:

```bash
npx typed-claude-hooks build -o .claude/settings.json
```

Done. Your hooks are compiled and ready.
````

with:

````markdown
```bash
npx typed-claude-hooks
```

That is the whole setup. On first run it creates a self-contained
`.typed-claude-hooks/` project, installs itself into it, compiles the example
hook, and writes `.claude/settings.json`:

```text
.typed-claude-hooks/
|-- package.json
|-- hooks.config.ts     <- edit this
|-- tsconfig.json
`-- node_modules/
```

Nothing is added to your project root, so this works the same in a Python or Go
repository as it does in a TypeScript one. Edit `hooks.config.ts` and run the
command again to rebuild.
````

- [ ] **Step 2: Update the README CLI section**

Replace the `### typed-claude-hooks build [config] -o <target>` heading and its table, and delete the `### typed-claude-hooks init` section entirely. The new section:

````markdown
### `typed-claude-hooks [config]`

Scaffolds the sandbox if needed, then compiles hooks and merges them into the target `settings.json`.

| Flag           | Default                                | Description                               |
|----------------|----------------------------------------|-------------------------------------------|
| `[config]`     | `.typed-claude-hooks/hooks.config.ts`  | Path to the config file                   |
| `-o, --output` | `.claude/settings.json`                | Path to the output `settings.json`        |
| `--hooks-dir`  | `hooks/` next to target                | Where to write compiled JS files          |
| `--runtime`    | `node`                                 | Wrapper runtime: `node`, `bun`, or `deno` |

Passing an explicit `[config]` builds that file and skips the sandbox entirely — nothing is scaffolded and no dependency is installed.

Each run checks that the `typed-claude-hooks` version installed in the sandbox matches the CLI's own. On a mismatch it repins that one dependency and reinstalls; any dependencies you added for your own hooks are preserved. A `file:` or `link:` specifier is never rewritten.

### `typed-claude-hooks init`

Scaffolds the sandbox and installs its dependency, then stops. No `settings.json` is written and no hook artifacts are generated — use it when you want the config and its types in place before wiring anything into Claude Code. Existing files are never overwritten; `init` reports them as skipped.
````

- [ ] **Step 3: Update the README "How It Works" and "Local Development" sections**

In "How It Works", change the opening line from `` `typed-claude-hooks build` does three things: `` to `` `typed-claude-hooks` does three things: ``.

In "Local Development", replace the two commands:

```bash
npm run build
node dist/cli/index.js build -o .claude/settings.json
```

with:

```bash
npm run build
node dist/cli/index.js
```

and replace `typed-claude-hooks build -o .claude/settings.json` with `typed-claude-hooks` in the `npm link` example.

- [ ] **Step 4: Update `site/src/components/Hero.astro`**

Lines 9–11 currently render the install button with `npx typed-claude-hooks init`. Change both the `data-copy` attribute and the `<code>` text to `npx typed-claude-hooks`:

```astro
        <button class="hero__install" data-copy="npx typed-claude-hooks">
```

and the `<code>npx typed-claude-hooks init</code>` on line 11 to `<code>npx typed-claude-hooks</code>`.

- [ ] **Step 5: Update `site/src/components/QuickStart.astro`**

The `steps` array in the frontmatter (lines 2–10) currently has two entries, which collapse into one now that `init` is gone. Replace the whole array:

```ts
const steps = [
  {
    command: "npx typed-claude-hooks",
    label:
      "Creates a self-contained .typed-claude-hooks/ project on first run, installs itself into it, then validates and replaces the managed generated directory with each .mjs bundle and mandatory .sh or .ps1 wrapper. Node is the default runtime.",
  },
  {
    command: "",
    label:
      "Edit .typed-claude-hooks/hooks.config.ts and run the command again. Your project root is never touched, so this works the same in a Python or Go repository.",
  },
];
```

The template already guards on `{step.command && ...}`, so the second entry renders as a label-only step.

- [ ] **Step 6: Update the Docs install section**

In `site/src/components/Docs.astro` line 41, change the nav label:

```ts
  ["install", "Install and build"],
```

Then replace lines 76–81 — the `<h2>` and everything through the `init -o` paragraph:

```astro
      <h2>Install and build</h2>
      <p>Run the command. On first run it creates a self-contained <code>.typed-claude-hooks/</code> project — <code>package.json</code>, <code>hooks.config.ts</code>, a strict <code>tsconfig.json</code>, and a <code>.gitignore</code> — installs itself into it, and builds. Your project root is never touched, so this works the same in a Python or Go repository.</p>
      <div class="docs__command"><span>$</span><code>npx typed-claude-hooks</code></div>
      <p>Existing files are never overwritten. Each run repins and reinstalls the sandbox dependency when its version drifts from the CLI's, leaving any dependencies you added for your own hooks alone. A <code>file:</code> or <code>link:</code> specifier is never rewritten.</p>
      <p>To scaffold and install without building — no <code>settings.json</code>, no generated hooks — run <code>init</code> instead. It is the same setup step the command above performs on its own, stopped before the build.</p>
      <div class="docs__command"><span>$</span><code>npx typed-claude-hooks init</code></div>
```

Note that the `npm install -D typed-claude-hooks` command line above it is deleted along with the rest — the package installs itself into the sandbox. The `initializerHtml` snippet below is unchanged; its source constant at lines 3–15 already matches the scaffolded template exactly.

- [ ] **Step 7: Update the Docs CLI section**

At line 115, replace the intro sentence:

```astro
      <p>Build with <code>npx typed-claude-hooks [config]</code>. Passing an explicit config path builds that file and skips the sandbox entirely. The command has four inputs:</p>
```

At lines 124–125, replace the first two table rows:

```astro
            <tr><td><code>[config]</code></td><td><code>.typed-claude-hooks/hooks.config.ts</code></td><td>Config path</td></tr>
            <tr><td><code>-o, --output</code></td><td><code>.claude/settings.json</code></td><td>Target settings file</td></tr>
```

- [ ] **Step 8: Verify the site builds**

```bash
cd site && npm install && npm run build
```

Expected: Astro build completes with no errors.

- [ ] **Step 9: Confirm no stale references remain**

Run: `grep -rn "typed-claude-hooks build" README.md site/src src tests`
Expected: no matches. (`typed-claude-hooks init` is still a real command and may appear.)

- [ ] **Step 10: Check formatting and lint**

Run: `npm run check && npm test`
Expected: no errors, all tests pass.

- [ ] **Step 11: Commit**

```bash
git add README.md site/src
git commit -m "docs: document the zero-argument sandbox workflow"
```
