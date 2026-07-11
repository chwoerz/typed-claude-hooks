# typed-claude-hooks

Type-safe hooks for Claude Code. All 30 events. Full autocomplete. One build command.

## The Problem

Raw Claude Code hooks are shell commands in `settings.json`. You pipe JSON through stdin, parse it by hand, and hope you spelled the field names right:

```js
#!/usr/bin/env node
const data = require('fs').readFileSync('/dev/stdin', 'utf8');
const input = JSON.parse(data);

// no types — typo in field name? silent bug
if (input.tool_input.comand.includes('rm -rf')) {
  process.exit(2);
}
```

## The Fix

```ts
import { defineHandler } from "typed-claude-hooks"

export const blockRm = defineHandler("PreToolUse", { matcher: "Bash" }, async (input) => {
  // input.tool_input is fully typed — autocomplete for command, timeout, description
  if (input.tool_input.command.includes("rm -rf")) {
    return {
      hookSpecificOutput: {
        permissionDecision: "deny" as const,
        permissionDecisionReason: "No rm -rf allowed",
      },
    }
  }
  return {}
})
```

- **Type-safe everything** — real TypeScript types for all 30 events, mistakes caught at compile time
- **Smart type narrowing** — pass `{ matcher: "Write" }` and get `file_path` + `content`; pass `{ matcher: "Bash" }` and get `command`
- **Test without subprocesses** — `testHandler` runs your hook as a function call, no stdin/stdout piping
- **Zero-config settings.json** — one command compiles your hooks and generates `settings.json`

## Quick Start

```bash
npm install -D typed-claude-hooks
npx typed-claude-hooks init
```

This creates a `hooks.config.ts` with an example hook. Edit it, then build:

```bash
npx typed-claude-hooks build -o .claude/settings.json
```

Done. Your hooks are compiled and ready.

## Writing Hooks

Export handlers as named exports — each is automatically discovered by its event type:

```ts
import { defineHandler } from "typed-claude-hooks"

// Matcher narrows tool_input to FileWriteInput | FileEditInput
export const protectEnv = defineHandler("PreToolUse", { matcher: "Write|Edit" }, async (input) => {
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

// Non-tool events don't use matchers
export const logStop = defineHandler("Stop", async (input) => {
  console.error(`Session stopped: ${input.session_id}`)
  return {}
})
```

For events with hook-specific output, `hookEventName` is optional while authoring. The generated runtime inserts the handler's event when it is omitted. You can also provide the exact event explicitly, and TypeScript rejects a mismatched event:

```ts
return {
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny" as const,
    permissionDecisionReason: "Blocked",
  },
}
```

### `defineHandler(event, fn)` / `defineHandler(event, options, fn)`

Creates a typed handler for a specific hook event. For all five tool events — `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PermissionRequest`, and `PermissionDenied` — pass a `matcher` in the options to narrow `tool_input` to the matched tool's type:

```ts
// Matcher narrows tool_input to BashInput — full autocomplete
export const blockRm = defineHandler("PreToolUse", { matcher: "Bash" }, async (input) => {
  input.tool_input.command  // string, no cast needed
})

// Union matcher — tool_input is FileWriteInput | FileEditInput
export const protectEnv = defineHandler("PreToolUse", { matcher: "Write|Edit" }, async (input) => {
  input.tool_input.file_path  // string
})

// No matcher — tool_input stays unknown
export const logAll = defineHandler("PreToolUse", async (input) => { ... })

// Non-tool events don't use matchers
export const onStop = defineHandler("Stop", async (input) => { ... })
```

Built-in tool inputs are typed for file and search tools, shell and web tools, agents and workflows, tasks and todos, planning and worktrees, notebooks and REPL, cron and wakeups, MCP resources, monitoring, notifications, and remote triggers. This includes tools such as `Bash`, `Read`, `Write`, `Edit`, `Glob`, `Grep`, `WebFetch`, `WebSearch`, `Agent`, `AskUserQuestion`, `NotebookEdit`, and the `Task*` tools. Unknown custom matcher names are accepted with `tool_input` typed as `unknown`.

## Testing Hooks

Use `testHandler` to unit test your handlers without stdin/stdout or process spawning:

```ts
import { testHandler } from "typed-claude-hooks/testing"
import { protectEnv } from "./hooks.config"

const result = await testHandler(protectEnv, {
  tool_name: "Write",
  tool_input: { file_path: ".env", content: "SECRET=123" },
  tool_use_id: "tu_1",
})

expect(result.hookSpecificOutput?.permissionDecision).toBe("deny")
```

`testHandler` auto-fills base fields (`session_id`, `cwd`, `transcript_path`) with test defaults. Override any field by including it in the input.

## CLI

### `typed-claude-hooks build [config] -o <target>`

Compiles hooks and merges them into the target `settings.json`.

| Flag           | Default                 | Description                            |
|----------------|-------------------------|----------------------------------------|
| `[config]`     | `hooks.config.ts`       | Path to the config file                |
| `-o, --output` | (required)              | Path to the output `settings.json`     |
| `--hooks-dir`  | `hooks/` next to target | Where to write compiled JS files       |
| `--runtime`    | `node`                  | Wrapper runtime: `node`, `bun`, or `deno` |
| `--dry-run`    | `false`                 | Print what would be written            |
| `--clean`      | `false`                 | Remove generated files before building |

`--runtime` applies only to that build. It is embedded in generated wrappers and is not persisted to the config or `settings.json`; omit it on a later build to return to Node.

Each handler can set `shell: "bash" | "powershell"` in its options. Bash is the default. Every handler always produces a self-contained `.mjs` bundle plus a mandatory `.sh` wrapper for Bash or `.ps1` wrapper for PowerShell. The generated settings entry invokes the wrapper, never the `.mjs` file directly.

```ts
export const windowsHook = defineHandler(
  "PreToolUse",
  { matcher: "Bash", shell: "powershell" },
  async () => ({}),
)
```

### `typed-claude-hooks init`

Scaffolds a starter `hooks.config.ts` and `tsconfig.json`.

## How It Works

`typed-claude-hooks build` does three things:

1. **Transpiles** your `.ts` config with esbuild and imports it
2. **Bundles** each named handler into a self-contained `.mjs` file and generates its `.sh` or `.ps1` wrapper
3. **Merges** wrapper commands into `settings.json`, preserving hand-written hooks

For example, `blockRm` generates:

```text
.claude/hooks/typed-claude-hooks/PreToolUse/
|-- blockRm.mjs
`-- blockRm.sh
```

The settings command points to `blockRm.sh`. Generated commands are recognized by their managed directory and replaced on rebuild without touching manual hooks.

## Local Development

When working on typed-claude-hooks itself, build and run the CLI from the repo:

```bash
npm run build
node dist/cli/index.js build -o .claude/settings.json
```

Or use `npm link` to make the `typed-claude-hooks` command available globally:

```bash
npm link
typed-claude-hooks build -o .claude/settings.json
```

## Types

All hook types are available as a separate export:

```ts
import type {
  HookEvent,
  PreToolUseHookInput,
  StopHookInput,
  SyncHookJSONOutput,
} from "typed-claude-hooks/types"
```

Types are auto-extracted from the `@anthropic-ai/claude-agent-sdk` package and bundled with typed-claude-hooks — no extra dependencies needed.

## License

MIT
