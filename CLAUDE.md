# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

typed-claude-hooks is a TypeScript library + CLI that provides type-safe hooks for Claude Code. It includes an Angular site (`site/`) for interactive exploration and a playground.

# Code Style

- Prefer `const` over `let`. If a variable needs reassignment, extract the logic into a function and use `return` instead.
- Extract repeated property accesses into `const` variables. If you use `x.foo` more than once, pull it into `const foo = x.foo` (or destructure) and reuse the variable.
- Prefer `map`, `filter`, `flatMap` over `for` loops. Use `for...of` only when the loop has side effects or early exits. Do not use `reduce` — it's unreadable.
- Lint and format with Biome (`npm run check` to check, `npm run format` to auto-fix formatting).
- When the public API changes, always update: (1) the README, (2) the site UI — landing page code snippets, scenario hook code, playground starter code, sandbox service, settings-generator service and their tests. All three must stay in sync.
- When hook or tool-input types change, run `npm run extract-types` first, then `npm run generate-monaco-dts`.

# Generated Files

Do not edit these by hand — they are produced by build scripts:
- `src/types/generated/` — run `npm run extract-types` to regenerate from `@anthropic-ai/claude-agent-sdk`
- `site/src/app/components/playground/editor/generated-dts.ts` — run `npm run generate-monaco-dts`
- `.claude/hooks/` and hook entries in `.claude/settings.json` — managed by `npx typed-claude-hooks build`

# Site Development

`site/` is a separate Angular project with its own `package.json`. It depends on the root package via `"typed-claude-hooks": "file:.."`. Run `npm install` in both root and `site/`. Build the root package (`npm run build`) before the site.

# Config API

The public API is `defineHandler` only — there is no `defineHooks`. Config files export handlers as named exports; the compiler auto-collects them by their `event` field. No default export is needed.

```ts
import { defineHandler } from "typed-claude-hooks"

export const blockRm = defineHandler("PreToolUse", { matcher: "Bash" }, async (input) => {
  // ...
})
```

Refer to @https://code.claude.com/docs/en/hooks for hook event types and lifecycle behavior.

# Backwards compatibility
ALWAYS ASK if you want to keep something backwards compatible. Most likely we dont want that.
