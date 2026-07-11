# Repository Review Findings

Full-repo review (src/ and scripts/ primary, site/ secondary), 2026-07-11.
All items below were verified by re-reading the code; items marked **(verified by execution)** were additionally reproduced by running the relevant command (`tsc`, `npm run check`, the script itself).

## Bugs (confirmed)

### 1. `isManagedHook` deletes user-authored hooks — `src/compiler/merge-hooks.ts:74`
The predicate is `command.includes("typed-claude-hooks") && command.endsWith(".sh")` — a bare substring match with no anchoring to the managed directory (`hooks/typed-claude-hooks/`). A user hook like `${CLAUDE_PROJECT_DIR}/scripts/typed-claude-hooks-audit.sh` — or **any** `.sh` hook in a repo whose path contains "typed-claude-hooks" (this repo!) — is classified as managed, stripped by `stripManagedFromExisting`, and permanently lost when build writes settings.json back.
**Fix:** match only commands under the exact managed prefix, e.g. `command.startsWith("${CLAUDE_PROJECT_DIR}/" + relative(projectRoot, managedDir))`, passed in from build.ts.

### 2. `--dry-run` still writes and deletes files — `src/cli/build.ts:112–129`
`bundleHandlers` (writes every `.mjs`/`.sh` + chmod 755), `removeStaleFiles` (unlinks files), and `--clean`'s `rmSync` all run **before** the only `options.dryRun` check at line 129. A "preview" run mutates and deletes files on disk; only settings.json is spared.
**Fix:** check `dryRun` before any filesystem mutation (bundle to memory or short-circuit earlier).

### 3. `init` scaffold and README examples don't typecheck — `src/cli/init.ts:12–17`, `README.md` (verified by execution)
The starter template and both README snippets return `hookSpecificOutput` **without** `hookEventName`, which `HookOutputFor` currently requires. `npx typed-claude-hooks init` + `tsc` fails with TS2769 on the code the tool itself generated. See the API recommendation below — the right fix is to make the types match the docs, not the other way around.

### 4. `npm run generate-monaco-dts` crashes with ENOENT — `scripts/generate-monaco-dts.ts:30` (verified by execution)
The script reads `src/types/hooks.ts` / `src/types/tool-inputs.ts`, but `extract-types.ts` writes to `src/types/generated/`. The two scripts hand-duplicate the paths and have drifted. Worse, its output path `site/src/app/components/playground/editor/generated-dts.ts` targets an Angular tree that no longer exists — `site/` is now an Astro project with no playground.
**Fix:** either delete the script (if the playground is gone for good) or share the path constants with `extract-types.ts` and point the output at the real site. Update CLAUDE.md accordingly (see item 12).

### 5. Duplicate matcher entries get the managed hook appended twice — `src/compiler/merge-hooks.ts:115–127`
`mergeByMatcher` appends the managed entry's hooks to **every** existing entry with the same matcher key. If the user's settings.json legally contains two `"Bash"` entries, the generated command lands in both and the hook executes twice per tool call (stable at 2× across rebuilds, but never deduplicated).
**Fix:** append to the first match only (consult `seen` inside the loop).

### 6. Runtime choice is not persisted — `src/cli/build.ts:116`
`runtime: options.runtime ?? "node"`, and the chosen runtime is recorded nowhere. After generating Deno wrappers with `--runtime deno` (as this working tree did), the next plain `npx typed-claude-hooks build` silently regenerates node wrappers. Relatedly: the checked-in Deno wrappers make every hook exit 2 ("Deno is required") for any collaborator/CI without Deno — on a Node project where Node is guaranteed present.
**Fix:** persist the runtime (e.g. in the config file or settings.json managed block) or make it a `hooks.config.ts` setting rather than a CLI flag.

### 7. Landing-page flagship snippet is invalid — `site/src/components/Comparison.astro:24`
The advertised snippet returns `{ deny: "Blocked" }`. No `deny` key exists in `SyncHookJSONOutput`; blocking requires `hookSpecificOutput.permissionDecision: "deny"` (or `decision: "block"`). Copied verbatim, the snippet fails to typecheck, and if forced through, the `rm -rf` it claims to block **runs anyway**.

### 8. Windows: generated command contains backslashes — `src/compiler/merge-hooks.ts:45`
`` `${CLAUDE_PROJECT_DIR}/${relative(projectRoot, wrapperPath)}` `` uses platform-specific `node:path.relative`, so on Windows the settings command becomes `${CLAUDE_PROJECT_DIR}/.claude\hooks\...` and the wrapper is never found.
**Fix:** normalize with `.split(sep).join("/")` (or `node:path/posix`).

### 9. `shell: "powershell"` produces an unrunnable pair — `src/types/mapping.ts:146` + `src/compiler/wrapper-template.ts:33`
The option is forwarded verbatim into the settings entry (spread in `createHookCommandEntry`), but `generateWrapper` unconditionally emits a `#!/bin/sh` `.sh` script and nothing ever generates a `.ps1`. Declaring `shell: "powershell"` tells Claude Code to run a POSIX script via PowerShell — failing on exactly the platform the option targets.
**Fix:** emit a `.ps1` wrapper for that option, or reject/remove the option.

### 10. `isPreToolUseHookFor` is dead, unexported, half-typed WIP — `src/authoring/define-handler.ts:53` (uncommitted)
Not re-exported from `src/index.ts` (package exports only `defineHandler`/`HandlerOptions`), so consumers can't import it; unused in src/tests/site; the predicate narrows `tool_input` but not `tool_name` (post-guard, `tool_name === "Write"` still typechecks); it fails Biome formatting so `npm run check` is currently red (verified by execution); and per CLAUDE.md a public-API addition obligates README/site updates that weren't made. Either finish it (export, narrow `tool_name` too, format, document) or delete it — see also "deeper fix" under Design below.

### 11. Stale `.cjs` bundles are never cleaned up — `src/cli/build.ts:42`
`removeStaleFiles` only considers `.mjs`/`.sh`, so pre-migration `.cjs` bundles survive forever — this repo's own `.claude/hooks/typed-claude-hooks/PreToolUse/blockDangerous.cjs` and `Stop/onStop.cjs` still sit beside the current `.mjs` files. Delete them, and widen the stale filter (delete anything in the managed dir not in `bundledFiles`).

### 12. CLAUDE.md describes a site that doesn't exist — `CLAUDE.md`
It calls `site/` an Angular app with a playground, sandbox service, settings-generator service, and lists `site/src/app/components/playground/editor/generated-dts.ts` as a generated file. `site/` is an Astro project (Hero/QuickStart/Comparison/Footer components only); none of those paths exist. Agents and contributors following these binding instructions will hunt for or fabricate nonexistent files. Rewrite the site section and the API-sync checklist to match reality.

## API recommendation: drop `hookEventName` from handler returns

**Your instinct is right, and it's already a de-facto bug (finding 3): the README and the `init` template omit `hookEventName` today, so the shipped examples don't compile.** The event is statically known to `defineHandler` and dynamically present as `input.hook_event_name`, so requiring it in the return value is pure boilerplate. Concretely:

1. `src/types/mapping.ts` — change `HookOutputFor` to strip the discriminant:
   `hookSpecificOutput?: Omit<HookSpecificOutputMap[E], "hookEventName">`
2. `src/compiler/runtime-template.ts` — before `JSON.stringify(result)`, inject it generically from the input (no per-event codegen needed):
   `if (result && result.hookSpecificOutput && !result.hookSpecificOutput.hookEventName) result.hookSpecificOutput.hookEventName = input.hook_event_name;`
3. `src/testing/test-handler.ts` — mirror the injection so test output matches wire output; adjust `tests/testing/test-handler.test.ts`.
4. README / site snippets then become correct as-is.

No SDK obstacle: `HookOutputFor` already selects the exact per-event output type, so the discriminant is never needed for narrowing in authoring position; the runtime still emits it on the wire for Claude Code. Per CLAUDE.md's backwards-compat rule this should be a clean break (`Omit`, not optional) — flagging per the "always ask" rule, but a clean break is the recommendation.

## Design / altitude (worth doing, not urgent)

- **Derive the type maps instead of hand-maintaining them** — `src/types/mapping.ts:57,94`. Verified with a scratch `tsc --strict` proof: `HookInputFor<E> = Extract<HookInput, { hook_event_name: E }>` and `HookSpecificOutputMap[E] = Extract<NonNullable<SyncHookJSONOutput["hookSpecificOutput"]>, { hookEventName: E }>` are exactly equivalent to the current 30- and 20-entry hand tables. Today every SDK event addition silently resolves `HookInputFor<NewEvent>` to `never` until someone hand-edits two tables.
- **Make matcher narrowing distributive, delete the ad-hoc guard** — `src/types/mapping.ts:134`. `NarrowedToolInput` builds a non-discriminated intersection (`tool_name: "Bash"|"Edit"` × `tool_input: BashInput|EditInput`), so `input.tool_name === "Bash"` can't narrow `tool_input` — which is why `isPreToolUseHookFor` was written. Distribute over `ParseMatcher<M>` (one `{ tool_name: N; tool_input: ResolveToolInput<N> }` branch per tool) and plain `===` checks narrow natively; the guard becomes unnecessary. Also widen `ToolHookEvent` — `PostToolUseFailure`, `PermissionRequest`, `PermissionDenied` inputs carry `tool_name` too but currently fall through to the un-narrowed overload.
- **`TOOL_INPUT_MAP` covers 9 of 34 SDK tools** — `scripts/extract-types.ts:75`. The SDK's `sdk-tools.d.ts` exports 34 `*Input` types (NotebookEdit, TodoWrite, …); everything outside the hand-list gets `tool_input: unknown`. Enumerate the SDK union (plus a small alias table), or at least fail the script when the SDK ships inputs the map doesn't cover.

## Efficiency (plausible, architectural)

- **N+1 esbuild passes per build** — `src/compiler/load-config.ts:47` + `src/compiler/bundle-handlers.ts:67`. The config graph is bundled once to enumerate exports, then once more per handler; `pureAnnotationPlugin` additionally re-reads the config from disk inside every pass's `onLoad`. Use a single `esbuild.build` with N entry points and hoist the config read.
- **No change detection** — `src/cli/build.ts`. Every build rebundles and rewrites all `.mjs`/`.sh` + settings.json even when byte-identical, churning mtimes for watchers. Compare content before writing.
- **2 processes per handler per hook event** — `src/compiler/wrapper-template.ts:39` + `src/compiler/merge-hooks.ts:62`. Each fire pays sh wrapper + `command -v` PATH scan + subshell + runtime cold start (`deno run` especially), and K handlers on the same event/matcher spawn K pairs. Consider emitting the direct `node .../file.mjs` command into settings.json (build-time runtime check instead of per-event), and one dispatch bundle per (event, matcher) group.

## Minor cleanup

- `src/compiler/merge-hooks.ts:20` — `HookCommandEntry` re-lists every `HandlerOptions` field; extend `Omit<HandlerOptions, "matcher">` instead so new options can't silently drift out of the type (the `...hookOptions` spread already bypasses excess-property checks).
- `src/testing/test-handler.ts:11` — `BaseDefaults` re-declares `session_id`/`transcript_path`/`cwd`; use `Pick<BaseHookInput, ...>`.
- `src/compiler/extract-handlers.ts:10` — `Map.groupBy` + `flatMap` round-trip is a plain `.map` over the entries; merge-hooks re-groups by event itself anyway.
- `src/cli/index.ts:40` — the `unknown`-cast ladder in the action callbacks defeats type checking for CLI options; type the callback parameters directly.
- `src/compiler/merge-hooks.ts:81` — `matcherKey()` is a one-line alias for `entry.matcher` called once; inline it.
- `src/compiler/wrapper-template.ts:10` — `command`/`execArgs` duplicate each other for node and bun; store `command` + optional extra args.
- CLAUDE.md style rules are violated in the compiler itself: `for...of` used for pure map/filter transformations (`merge-hooks.ts:108–133`), `let` + reassignment where the rules prescribe extract-and-return (`build.ts:35,81`), repeated `options.hooksDir` access (`build.ts:95–96`).
