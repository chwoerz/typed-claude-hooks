# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

typed-claude-hooks is a TypeScript library + CLI that provides type-safe hooks for Claude Code. It includes an Astro site in `site/`.

# Code Style

- Prefer `const` over `let`. If a variable needs reassignment, extract the logic into a function and use `return` instead.
- Extract repeated property accesses into `const` variables. If you use `x.foo` more than once, pull it into `const foo = x.foo` (or destructure) and reuse the variable.
- Prefer `map`, `filter`, `flatMap` over `for` loops. Use `for...of` only when the loop has side effects or early exits. Do not use `reduce` — it's unreadable.
- Lint and format with Biome (`npm run check` to check, `npm run format` to auto-fix formatting).
- When the public API changes, keep the README, the `init` template, and relevant Astro site snippets in sync.
- When hook or tool-input types change, run `npm run extract-types`.

# Generated Files

The only generated source files are under `src/types/generated/`. Do not edit them by hand; run `npm run extract-types` to regenerate them from `@anthropic-ai/claude-agent-sdk`.

CLI builds produce `.mjs` hook bundles plus mandatory shell wrappers (`.sh` or `.ps1`) and point hook entries in settings at the wrappers. Files under `.claude/hooks/` and managed hook entries in `.claude/settings.json` are build artifacts managed by `npx typed-claude-hooks build`.

# Site Development

`site/` is a separate Astro project with its own `package.json`. Run `npm install` in both the repository root and `site/`, then use `npm run build` from `site/` to verify it.

# Config API

The config authoring API is `defineHandler` only. The `Runtime` type is exported from `typed-claude-hooks/types`, not the root package, and describes the CLI runtime option rather than the config API. Config files export handlers as named exports; the compiler auto-collects them by their `event` field. Do not add a default config export.

```ts
import { defineHandler } from "typed-claude-hooks"

export const blockRm = defineHandler("PreToolUse", { matcher: "Bash" }, async (input) => {
  // ...
})
```

Refer to @https://code.claude.com/docs/en/hooks for hook event types and lifecycle behavior.

# Runtime

Runtime selection is CLI-only through `--runtime`. It defaults to `node` and is not persisted, so every build without the option uses Node regardless of an earlier build's runtime.

# Backwards compatibility
ALWAYS ASK if you want to keep something backwards compatible. Most likely we dont want that.
