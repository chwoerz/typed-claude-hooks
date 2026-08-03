# Repository Findings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement every confirmed bug, API/type recommendation, efficiency improvement, and cleanup item documented in `findings.md`.

**Architecture:** Introduce a typed `defineConfig` root, derive hook types from SDK unions, and replace mutation-first compilation with an in-memory artifact plan. Preserve one command per handler, use direct runtime commands by default, and generate shell-specific wrappers only when requested.

**Tech Stack:** TypeScript 5.7, Node.js, esbuild, Commander, Vitest, ts-morph, Biome, Astro

---

## File Structure

- `src/authoring/define-config.ts`: typed project configuration constructor.
- `src/types/mapping.ts`: derived hook mappings, handler/config/runtime types, distributive matcher narrowing.
- `src/compiler/load-config.ts`: in-memory config evaluation and runtime/handler validation.
- `src/compiler/bundle-handlers.ts`: one-pass in-memory handler bundles and artifact metadata.
- `src/compiler/wrapper-template.ts`: direct runtime arguments and Bash/PowerShell wrapper templates.
- `src/compiler/merge-hooks.ts`: precise managed-command replacement and matcher merging.
- `src/cli/build.ts`: pure build planning followed by guarded filesystem application.
- `scripts/extract-types.ts`: exhaustive deterministic SDK hook/tool extraction.
- Existing unit/integration/type tests: specify observable behavior at each boundary.
- `README.md`, `CLAUDE.md`, `src/cli/init.ts`, and current Astro components: synchronized public examples and contributor guidance.

### Task 1: Typed Configuration Root

**Files:**
- Create: `src/authoring/define-config.ts`
- Modify: `src/types/mapping.ts`
- Modify: `src/index.ts`
- Test: `tests/authoring/define-config.test.ts`

- [ ] **Step 1: Write failing API tests**

Add tests proving `defineConfig` preserves handler keys, accepts `node | bun | deno`, defaults runtime later rather than in the constructor, and rejects invalid runtime/handler values at compile time. Use this target API:

```ts
const handler = defineHandler("Stop", async () => ({}));
const config = defineConfig({ runtime: "deno", handlers: { handler } });
expect(config).toEqual({ runtime: "deno", handlers: { handler } });
```

Include `@ts-expect-error` checks for `runtime: "other"` and a non-handler map value.

- [ ] **Step 2: Verify the tests fail**

Run: `npx vitest run tests/authoring/define-config.test.ts`

Expected: FAIL because `defineConfig` is not exported.

- [ ] **Step 3: Implement the minimal typed API**

Define shared types in `mapping.ts` and return the input unchanged:

```ts
export type Runtime = "node" | "bun" | "deno";

export interface HooksConfig<
  H extends Record<string, TypedHandler<HookEvent>> = Record<
    string,
    TypedHandler<HookEvent>
  >,
> {
  runtime?: Runtime;
  handlers: H;
}

export function defineConfig<
  const H extends Record<string, TypedHandler<HookEvent>>,
>(config: HooksConfig<H>): HooksConfig<H> {
  return config;
}
```

Export `defineConfig`, `HooksConfig`, and `Runtime` from `src/index.ts`.

- [ ] **Step 4: Verify the API tests pass**

Run: `npx vitest run tests/authoring/define-config.test.ts && npm run build`

Expected: PASS.

### Task 2: Config Loading and Handler Extraction

**Files:**
- Modify: `src/compiler/load-config.ts`
- Modify: `src/compiler/extract-handlers.ts`
- Modify: `tests/compiler/load-config.test.ts`
- Modify: `tests/compiler/extract-handlers.test.ts`
- Modify: `tests/fixtures/sample-hooks.config.ts`
- Modify: `hooks.config.ts`

- [ ] **Step 1: Write failing loader tests**

Cover default-export config loading, Node default, explicit runtime, empty handlers, missing/invalid default export, invalid runtime, non-handler values, and duplicate handler instances. Assert this result:

```ts
interface LoadedConfig {
  runtime: Runtime;
  handlerExports: Record<string, TypedHandler<HookEvent>>;
}
```

Also assert config evaluation creates no temporary directory beside the fixture.

- [ ] **Step 2: Verify loader tests fail**

Run: `npx vitest run tests/compiler/load-config.test.ts tests/compiler/extract-handlers.test.ts`

Expected: FAIL because the loader still discovers named exports and writes a temporary bundle.

- [ ] **Step 3: Load config entirely in memory**

Use `esbuild.build({ bundle: true, write: false, format: "esm", platform: "node" })`, import its JavaScript through a base64 `data:` URL, validate `module.default`, and return `runtime: config.runtime ?? "node"`. Reject malformed configs with messages naming the invalid field. Keep duplicate-instance detection over `Object.entries(config.handlers)`.

- [ ] **Step 4: Simplify extraction and migrate fixtures**

Replace grouping with direct mapping:

```ts
return Object.entries(loaded.handlerExports).map(([name, handler]) => {
  const { event, handler: _handler, ...options } = handler;
  return { ...options, event, name };
});
```

Convert root and fixture configs to `export default defineConfig({ runtime, handlers })`.

- [ ] **Step 5: Verify config behavior**

Run: `npx vitest run tests/compiler/load-config.test.ts tests/compiler/extract-handlers.test.ts && npm run build`

Expected: PASS.

### Task 3: Derived Event Types and Matcher Narrowing

**Files:**
- Modify: `src/types/mapping.ts`
- Modify: `src/authoring/define-handler.ts`
- Modify: `tests/authoring/define-handler.test.ts`
- Create: `tests/types/mapping.test-d.ts`

- [ ] **Step 1: Add failing type assertions**

Assert representative event inputs equal the SDK union extraction, omitted and correctly supplied `hookEventName` compile, and an incorrect literal fails:

```ts
defineHandler("PreToolUse", async () => ({
  hookSpecificOutput: { permissionDecision: "deny" },
}));

defineHandler("PreToolUse", async () => ({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
  },
}));
```

For matcher `"Bash|Write"`, assert `tool_name === "Bash"` exposes only `BashInput`, while the Write branch exposes only `FileWriteInput`. Repeat inference checks for `PostToolUseFailure`, `PermissionRequest`, and `PermissionDenied`; custom names retain `unknown` input.

- [ ] **Step 2: Verify type tests fail**

Run: `npx vitest run --typecheck tests/types/mapping.test-d.ts`

Expected: FAIL on omitted event names and correlated union narrowing.

- [ ] **Step 3: Replace manual maps with derived types**

Implement:

```ts
export type HookInputFor<E extends HookEvent> = Extract<
  HookInput,
  { hook_event_name: E }
>;

type SpecificOutput = NonNullable<SyncHookJSONOutput["hookSpecificOutput"]>;
type SpecificOutputFor<E extends HookEvent> = Extract<
  SpecificOutput,
  { hookEventName: E }
>;
type AuthorSpecificOutput<E extends HookEvent> =
  | SpecificOutputFor<E>
  | Omit<SpecificOutputFor<E>, "hookEventName">;
```

Conditionally expose `hookSpecificOutput` only when `SpecificOutputFor<E>` is not `never`.

- [ ] **Step 4: Implement distributive tool branches**

Derive `ToolHookEvent` from inputs containing both tool fields and distribute `ParseMatcher<M>` into correlated `{ tool_name; tool_input }` branches. Remove `isPreToolUseHookFor` and its imports.

- [ ] **Step 5: Verify all authoring types**

Run: `npx vitest run --typecheck tests/types/mapping.test-d.ts && npx vitest run tests/authoring/define-handler.test.ts && npm run build`

Expected: PASS.

### Task 4: Wire Output Injection and Test Parity

**Files:**
- Modify: `src/compiler/runtime-template.ts`
- Modify: `src/testing/test-handler.ts`
- Modify: `tests/compiler/runtime-template.test.ts`
- Modify: `tests/testing/test-handler.test.ts`

- [ ] **Step 1: Write failing behavioral tests**

Execute generated runtime code and assert an omitted event becomes `hookEventName: "PreToolUse"`, a supplied event remains unchanged, `{}` remains valid, and thrown errors still exit with code 2. Mirror omitted/supplied assertions through `testHandler` and verify the original returned object is not mutated.

- [ ] **Step 2: Verify tests fail**

Run: `npx vitest run tests/compiler/runtime-template.test.ts tests/testing/test-handler.test.ts`

Expected: FAIL because no injection occurs.

- [ ] **Step 3: Inject without overwriting**

Before serialization, add the field only when absent. In `testHandler`, return shallow copies of the result and `hookSpecificOutput`:

```ts
return result.hookSpecificOutput?.hookEventName
  ? result
  : {
      ...result,
      hookSpecificOutput: result.hookSpecificOutput
        ? { ...result.hookSpecificOutput, hookEventName: input.hook_event_name }
        : undefined,
    };
```

Define test defaults with `Pick<BaseHookInput, "session_id" | "transcript_path" | "cwd">`.

- [ ] **Step 4: Verify runtime and helper parity**

Run: `npx vitest run tests/compiler/runtime-template.test.ts tests/testing/test-handler.test.ts`

Expected: PASS.

### Task 5: Exhaustive Tool Input Generation

**Files:**
- Modify: `scripts/extract-types.ts`
- Modify: `tests/types/sdk-drift.test.ts`
- Create: `tests/scripts/extract-types.test.ts`
- Generate: `src/types/generated/tool-inputs.ts`

- [ ] **Step 1: Add failing extraction tests**

Assert every exported SDK declaration ending in `Input` appears once in generated output, every map member references an emitted declaration, aliases map `FileReadInput -> Read`, `FileWriteInput -> Write`, and `FileEditInput -> Edit`, and synthetic collisions/unmappable declarations throw actionable errors.

- [ ] **Step 2: Verify extraction tests fail**

Run: `npx vitest run tests/scripts/extract-types.test.ts tests/types/sdk-drift.test.ts`

Expected: FAIL because only nine inputs are mapped.

- [ ] **Step 3: Implement deterministic exhaustive mapping**

Enumerate exported interface/type declarations matching `/Input$/`, derive the tool name by removing `Input`, then apply:

```ts
const TOOL_NAME_ALIASES = {
  FileReadInput: "Read",
  FileWriteInput: "Write",
  FileEditInput: "Edit",
} as const;
```

Validate duplicate tool names and preserve SDK declaration order. Extract pure mapping/validation functions from script execution so tests can pass synthetic declarations.

- [ ] **Step 4: Regenerate and verify**

Run: `npm run extract-types && npx vitest run tests/scripts/extract-types.test.ts tests/types/sdk-drift.test.ts && npm run build`

Expected: PASS and generated map covers every current SDK tool input.

### Task 6: One-Pass In-Memory Bundling

**Files:**
- Modify: `src/compiler/bundle-handlers.ts`
- Modify: `tests/compiler/bundle-handlers.test.ts`

- [ ] **Step 1: Write failing bundle-plan tests**

For multiple handlers, spy on `esbuild.build` and assert one call, `write: false`, no filesystem creation, one `.mjs` artifact per handler, and stable mapping from virtual entry to handler metadata.

- [ ] **Step 2: Verify tests fail**

Run: `npx vitest run tests/compiler/bundle-handlers.test.ts`

Expected: FAIL because bundling invokes esbuild once per handler and writes files.

- [ ] **Step 3: Add the artifact model**

Use:

```ts
export interface PlannedArtifact {
  path: string;
  content: string;
  mode?: number;
}

export interface BundledFile extends HandlerOptions {
  event: string;
  name: string;
  fileName: string;
  filePath: string;
  commandPath: string;
  artifacts: PlannedArtifact[];
}
```

Create one virtual entry per handler importing `default.handlers[name].handler`; invoke one multi-entry esbuild build with `write: false`, annotate the config source once, and associate output files by entry name.

- [ ] **Step 4: Verify one-pass behavior**

Run: `npx vitest run tests/compiler/bundle-handlers.test.ts`

Expected: PASS and no test temp output exists.

### Task 7: Runtime Commands and Shell-Specific Wrappers

**Files:**
- Modify: `src/compiler/wrapper-template.ts`
- Modify: `src/compiler/bundle-handlers.ts`
- Modify: `tests/compiler/wrapper-template.test.ts`
- Modify: `tests/compiler/bundle-handlers.test.ts`

- [ ] **Step 1: Write failing runtime/wrapper tests**

Assert direct argument vectors are `node`, `bun`, and `deno run --allow-all`; no-shell handlers have no wrapper; Bash produces executable `.sh`; PowerShell produces `.ps1`. Both wrappers detect missing runtime, resolve their directory, forward arguments, and propagate status.

- [ ] **Step 2: Verify tests fail**

Run: `npx vitest run tests/compiler/wrapper-template.test.ts tests/compiler/bundle-handlers.test.ts`

Expected: FAIL for PowerShell and no-shell artifact selection.

- [ ] **Step 3: Implement focused runtime helpers**

Expose `runtimeCommand`, `runtimeArguments`, `generateBashWrapper`, and `generatePowerShellWrapper`. Store only the executable, display name, installation URL, and Deno’s additional arguments in runtime configuration.

PowerShell should resolve `$PSScriptRoot`, use `Get-Command -ErrorAction SilentlyContinue`, invoke with `&`, forward `@args`, and `exit $LASTEXITCODE`.

- [ ] **Step 4: Select wrappers from handler shell**

No `shell` yields only `.mjs`; `bash` adds `.sh` with mode `0o755`; `powershell` adds `.ps1`. Set `commandPath` to the bundle or selected wrapper.

- [ ] **Step 5: Verify templates and artifacts**

Run: `npx vitest run tests/compiler/wrapper-template.test.ts tests/compiler/bundle-handlers.test.ts`

Expected: PASS.

### Task 8: Precise and Idempotent Settings Merge

**Files:**
- Modify: `src/compiler/merge-hooks.ts`
- Modify: `tests/compiler/merge-hooks.test.ts`

- [ ] **Step 1: Write failing merge tests**

Cover preservation of `${CLAUDE_PROJECT_DIR}/scripts/typed-claude-hooks-audit.sh`, removal of exact managed `.sh`, `.ps1`, `.mjs`, Node/Bun/Deno commands, duplicate matcher append-once behavior, two-merge equality, forward-slash paths from synthetic backslashes, and non-hook settings preservation.

- [ ] **Step 2: Verify tests fail**

Run: `npx vitest run tests/compiler/merge-hooks.test.ts`

Expected: FAIL on broad deletion, duplicate appending, and Windows paths.

- [ ] **Step 3: Pass and use an exact managed prefix**

Extend merge options with `managedCommandPrefix` and `runtime`. Normalize separators using `.split(sep).join("/")` plus replacement of synthetic backslashes. Recognize managed commands by extracting the quoted/unquoted generated path operand and requiring it to start with the exact prefix.

- [ ] **Step 4: Generate direct or wrapper commands**

Use direct quoted commands for no-shell handlers:

```text
node "${CLAUDE_PROJECT_DIR}/.claude/hooks/typed-claude-hooks/Event/name.mjs"
deno run --allow-all "${CLAUDE_PROJECT_DIR}/.../name.mjs"
```

Use the wrapper path for explicit shells. Define `HookCommandEntry` as `Omit<HandlerOptions, "matcher"> & { type: "command"; command: string }`.

- [ ] **Step 5: Append only to the first matcher**

Map existing entries while tracking whether each matcher has received its managed entry; preserve later duplicates unchanged. Remove `matcherKey` and use map/filter transformations where they are pure.

- [ ] **Step 6: Verify merge safety**

Run: `npx vitest run tests/compiler/merge-hooks.test.ts`

Expected: PASS.

### Task 9: Pure Build Planning and Safe Application

**Files:**
- Modify: `src/cli/build.ts`
- Modify: `tests/cli/build.integration.test.ts`

- [ ] **Step 1: Add failing dry-run and cleanup tests**

Snapshot filesystem paths/content/modes/mtimes before and after normal dry-run, stale-file dry-run, and `--dry-run --clean`; assert equality. Add normal cleanup cases for `.cjs`, arbitrary files, nested stale trees, and an outside similarly named user hook that must remain.

- [ ] **Step 2: Add failing change-detection and error-atomicity tests**

Assert an identical second build preserves settings/artifact mtimes. Assert malformed settings and unavailable direct runtime produce no writes/deletes. Assert config runtime is used unless CLI runtime overrides it.

- [ ] **Step 3: Verify integration tests fail**

Run: `npx vitest run tests/cli/build.integration.test.ts`

Expected: FAIL because current build mutates before dry-run and rewrites every file.

- [ ] **Step 4: Implement `planBuild`**

Return a plan containing runtime, bundled files, artifact writes with changed flags, recursively enumerated stale paths, merged settings, and settings-changed state. Parse settings and validate the direct runtime before any mutation. Resolve `hooksDir` once. For clean mode, treat all existing managed paths as stale but retain newly planned paths.

- [ ] **Step 5: Implement `applyBuildPlan`**

Delete stale paths deepest-first, guard every deletion with containment under the exact managed root, write only missing/content-changed files, chmod only when needed, and write settings only when serialized bytes differ. Create parent directories only during apply.

- [ ] **Step 6: Make dry-run plan-only**

After planning, print settings and summary then return. Do not call apply, mkdir, write, unlink, rm, chmod, or create temporary config output.

- [ ] **Step 7: Verify build safety and idempotence**

Run: `npx vitest run tests/cli/build.integration.test.ts`

Expected: PASS.

### Task 10: CLI Runtime Precedence and Typed Callbacks

**Files:**
- Modify: `src/cli/index.ts`
- Modify: `tests/cli/build.integration.test.ts`

- [ ] **Step 1: Add a failing CLI precedence test**

Run the CLI against a config declaring Deno with no flag and assert Deno output; rerun with `--runtime node` and assert Node output.

- [ ] **Step 2: Verify the test fails**

Run: `npx vitest run tests/cli/build.integration.test.ts`

Expected: FAIL because Commander always supplies Node.

- [ ] **Step 3: Remove the CLI default and cast ladder**

Remove `.default("node")`. Type callback options directly:

```ts
interface BuildCommandOptions {
  output: string;
  hooksDir?: string;
  runtime?: Runtime;
  dryRun?: boolean;
  clean?: boolean;
}
```

Use a generic async error wrapper that preserves callback parameter types.

- [ ] **Step 4: Verify precedence and compilation**

Run: `npx vitest run tests/cli/build.integration.test.ts && npm run build`

Expected: PASS.

### Task 11: Initializer and Public Examples

**Files:**
- Modify: `src/cli/init.ts`
- Create: `tests/cli/init.integration.test.ts`
- Modify: `README.md`
- Modify: `site/src/components/Comparison.astro`
- Modify: `site/src/components/Hero.astro`
- Modify: `site/src/components/QuickStart.astro`

- [ ] **Step 1: Add a failing scaffold typecheck test**

Run `init` into a temporary package, install/reference the local package types, and execute `tsc --noEmit`. Assert the scaffold imports both APIs, omits `hookEventName`, and default-exports `defineConfig({ runtime: "node", handlers })`.

- [ ] **Step 2: Verify scaffold test fails**

Run: `npx vitest run tests/cli/init.integration.test.ts`

Expected: FAIL because current scaffold has no config root and output typing is invalid.

- [ ] **Step 3: Update scaffold and examples**

Migrate every README/site snippet to `defineConfig`. Explain runtime config, CLI one-run override, optional strongly typed author `hookEventName`, direct commands, and explicit-shell wrappers. Correct the landing block result:

```ts
return {
  hookSpecificOutput: {
    permissionDecision: "deny",
    permissionDecisionReason: "Blocked",
  },
};
```

Update the supported-tool list to generated coverage and remove claims about `.cjs`, universal wrappers, or `__managed` metadata.

- [ ] **Step 4: Verify scaffold and site**

Run: `npx vitest run tests/cli/init.integration.test.ts && npm run build && npm run build --prefix site`

Expected: PASS.

### Task 12: Remove Obsolete Monaco Tooling and Correct Contributor Guidance

**Files:**
- Delete: `scripts/generate-monaco-dts.ts`
- Modify: `package.json`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Remove obsolete command and script**

Delete only the `generate-monaco-dts` script entry while preserving existing unrelated release changes in `package.json` and `package-lock.json`. Delete the unused generator file.

- [ ] **Step 2: Rewrite repository guidance**

Describe `site/` as Astro, list only `src/types/generated/` as generated type output, document `defineHandler` plus `defineConfig`, default config export, real sync targets, and `npm run extract-types` without Monaco generation.

- [ ] **Step 3: Verify stale references are gone**

Run: `rg "generate-monaco-dts|Angular|playground|generated-dts" CLAUDE.md package.json scripts site/src README.md`

Expected: no obsolete references.

### Task 13: Snapshots and Generated Repository Hooks

**Files:**
- Modify: `tests/cli/generated-files.integration.test.ts`
- Update: `tests/cli/__snapshots__/generated/**`
- Generate: `.claude/hooks/typed-claude-hooks/**`
- Generate: `.claude/settings.json`

- [ ] **Step 1: Update generated-file expectations**

Assert `.mjs` contains event injection, default settings use direct quoted Node commands, default handlers produce no `.sh`, and dedicated explicit-shell fixtures produce `.sh`/`.ps1` artifacts.

- [ ] **Step 2: Regenerate snapshots through Vitest**

Run: `npx vitest run tests/cli/generated-files.integration.test.ts --update`

Expected: PASS with obsolete default wrapper snapshots removed.

- [ ] **Step 3: Build and regenerate managed hooks normally**

Run: `npm run build && node dist/cli/index.js build -o .claude/settings.json`

Expected: Node direct commands in settings; fresh `.mjs`; stale `.cjs` and unnecessary `.sh` files removed by the compiler, not manually.

- [ ] **Step 4: Confirm generated build idempotence**

Record managed-file and settings mtimes, rerun `node dist/cli/index.js build -o .claude/settings.json`, and assert mtimes are unchanged.

### Task 14: Full Verification and Scope Audit

**Files:**
- Review all modified files

- [ ] **Step 1: Regenerate SDK types**

Run: `npm run extract-types`

Expected: successful deterministic generation.

- [ ] **Step 2: Run formatting/lint checks**

Run: `npm run check`

Expected: PASS. If formatting is required, run `npm run format`, inspect only touched files, then rerun check.

- [ ] **Step 3: Run type and test suites**

Run: `npm run build && npx vitest run --typecheck && npm test`

Expected: all commands PASS.

- [ ] **Step 4: Build the Astro site**

Run: `npm run build --prefix site`

Expected: PASS.

- [ ] **Step 5: Verify dry-run immutability manually**

Record `git status --short`, run `node dist/cli/index.js build -o .claude/settings.json --dry-run --clean`, rerun status, and confirm no new filesystem changes.

- [ ] **Step 6: Audit every finding**

Check each numbered bug, API recommendation, design item, efficiency item, and minor cleanup in `findings.md` against a passing test or inspected implementation. Confirm no `generate-monaco-dts` references or stale managed `.cjs` files remain.

- [ ] **Step 7: Inspect final diff without reverting unrelated work**

Run: `git status --short && git diff --check && git diff --stat`

Expected: no whitespace errors; existing release changes remain present and untouched except the intentional removal of the obsolete package script.
