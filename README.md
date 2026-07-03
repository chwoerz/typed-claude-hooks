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
  process.stdout.write(JSON.stringify({ decision: 'deny' }));
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

### `defineHandler(event, fn)` / `defineHandler(event, options, fn)`

Creates a typed handler for a specific hook event. For `PreToolUse` and `PostToolUse`, pass a `matcher` in the options to narrow `tool_input` to the matched tool's type:

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

Supported tools: `Bash`, `Read`, `Write`, `Edit`, `Glob`, `Grep`, `WebFetch`, `WebSearch`, `Agent`. MCP and custom tools are accepted as matcher strings but `tool_input` stays `unknown`.

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
| `--dry-run`    | `false`                 | Print what would be written            |
| `--clean`      | `false`                 | Remove generated files before building |

### `typed-claude-hooks init`

Scaffolds a starter `hooks.config.ts` and `tsconfig.json`.

## How It Works

`typed-claude-hooks build` does four things:

1. **Transpiles** your `.ts` config with esbuild and imports it
2. **Bundles** each handler into a self-contained `.cjs` file that reads JSON from stdin, calls your handler, and writes JSON to stdout
3. **Merges** hook entries into `settings.json`, preserving any hand-written hooks

Generated hook entries are marked with `"__managed": "typed-claude-hooks"` so they can be cleanly replaced on rebuild without touching your manual hooks.

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
