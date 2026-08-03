# Repository Findings Implementation Design

## Scope

Implement every item in `findings.md`: the twelve confirmed bugs, the output API recommendation, type-system recommendations, efficiency improvements, and minor cleanup. Preserve independent handler execution semantics while reducing unnecessary build and runtime work.

Existing unrelated release changes in `package.json` and `package-lock.json` must be preserved. Generated hook files may be replaced only through the normal build pipeline after source changes are verified.

## Public API and Configuration

Add `defineConfig` as the typed root of `hooks.config.ts`:

```ts
export default defineConfig({
  runtime: "node",
  handlers: { blockDangerous, onStop },
});
```

The loader consumes this default export instead of collecting named handler exports. This is a deliberate clean break. `runtime` accepts `node`, `bun`, or `deno`; a CLI `--runtime` value overrides it for one build, otherwise the configured value applies, with Node as the default.

`defineHandler` remains the handler-authoring API. Documentation, initialization output, site snippets, tests, and package exports are updated together.

## Output and Input Types

Derive event inputs from the SDK union with `Extract<HookInput, { hook_event_name: E }>`. Derive hook-specific outputs from `SyncHookJSONOutput` in the same way rather than maintaining manual event tables.

For events with hook-specific output, author returns accept either:

- The exact SDK output, including the correctly inferred literal `hookEventName` for that event.
- The same output with `hookEventName` omitted.

This preserves copy-paste compatibility and strong checking when the field is supplied. Runtime serialization and `testHandler` add the event name only when it was omitted; they never replace an author-supplied value.

Matcher narrowing distributes over every parsed matcher name so checking `tool_name` narrows the corresponding `tool_input`. Apply it to every event carrying tool fields, including `PostToolUseFailure`, `PermissionRequest`, and `PermissionDenied`. Remove the unfinished `isPreToolUseHookFor` helper because ordinary discriminant narrowing replaces it.

Tool input generation enumerates all SDK `*Input` declarations, applies a small explicit alias table where SDK type names differ from Claude tool names, and fails when a declaration cannot be mapped. Generated type files remain script-owned.

## Build Pipeline

Separate planning from mutation:

1. Load and validate the config.
2. Bundle all handlers in one multi-entry esbuild invocation with in-memory output.
3. Construct bundle and optional wrapper artifacts in memory.
4. Compute stale managed paths, merged settings, and changed files without writing.
5. On dry-run, print the resulting settings and summary without creating, deleting, chmodding, or rewriting anything.
6. On normal builds, remove stale managed artifacts and write only content that changed.

`--clean` participates in the plan and has no filesystem effect during dry-run. Cleanup removes every unexpected file under the managed directory, including old `.cjs` bundles and nested stale files, while leaving files outside that exact directory untouched.

The build avoids rewriting byte-identical settings and generated artifacts so file watchers do not receive false changes.

## Settings Merge Safety

Pass the normalized managed command prefix from the build into settings merging. Existing hooks count as managed only when their command targets the exact generated directory. User-authored paths that merely contain `typed-claude-hooks` are preserved.

Normalize generated settings paths to forward slashes on every platform. When existing settings contain duplicate matcher blocks, append generated hooks only to the first matching block. Rebuilds remain idempotent.

Command-entry types derive from `HandlerOptions` rather than repeating every option.

## Runtime Commands and Shells

Preserve one independently executable command per handler. Do not introduce a central dispatcher because it could alter ordering, failure isolation, and Claude Code hook semantics.

For handlers without an explicit shell, settings invoke the selected runtime directly with a quoted project-relative bundle path. Deno receives its required execution arguments. Build validates that the selected runtime is available before writing direct commands.

For `shell: "bash"`, emit an executable `.sh` wrapper. For `shell: "powershell"`, emit a `.ps1` wrapper with equivalent runtime discovery, error reporting, script-directory resolution, argument handling, and exit propagation. Settings point to the correct wrapper extension and preserve the shell option.

This removes the extra shell process and repeated runtime lookup from the default path while retaining explicit shell behavior.

## Tooling and Documentation

Delete the obsolete Monaco DTS generator and its package command because the current Astro site has no playground consumer. Rewrite `CLAUDE.md` to describe the Astro project, current generated files, `defineConfig`, and the actual public-API synchronization obligations.

Fix the landing-page blocking example to return a valid `PreToolUse` permission decision. Update README and initializer examples for `defineConfig` and optional `hookEventName`. Update the supported-tool documentation from generated coverage.

Apply listed mechanical cleanup only in files already touched by this work: direct mapping in handler extraction, typed Commander callbacks, `Pick` for test defaults, removal of one-line aliases, no reassignment where avoidable, and simpler runtime configuration.

## Error Handling

Config loading reports missing or invalid default configuration clearly. Duplicate handler instances or export names remain errors. Type extraction fails with actionable names for unmapped SDK tool inputs. Build errors identify unavailable runtimes and malformed settings without partially applying planned changes where practical.

PowerShell and POSIX wrappers emit consistent installation guidance and preserve child-process exit codes.

## Testing and Verification

Add or update tests for:

- Exact managed-prefix matching and preservation of similarly named user hooks.
- Duplicate matcher blocks and rebuild idempotence.
- Forward-slash settings paths.
- Dry-run immutability for normal, stale, and clean builds.
- Cleanup of arbitrary stale managed files and directories.
- Byte-identical build change detection.
- Config runtime defaults and CLI precedence.
- Direct Node, Bun, and Deno commands.
- Bash and PowerShell wrapper content and extension selection.
- One multi-entry esbuild build per compilation.
- Output injection when `hookEventName` is omitted and preservation when supplied.
- Exact literal rejection for an incorrect manually supplied event name.
- Derived event maps and distributive matcher narrowing.
- Exhaustive SDK tool-input extraction and drift failure.
- Initializer and documentation snippets through representative type checks where feasible.

Run type extraction before final type checks. Final verification consists of Biome checks, TypeScript build, all Vitest tests, the extraction script, and an Astro site build. Generated hook artifacts are inspected after regeneration, and unrelated working-tree changes are not reverted or reformatted.
