# Site Documentation Design

## Goal

Correct the landing page against the current library and add a dedicated documentation route without cluttering the existing marketing flow.

## Structure

Add shared navigation with Home, Docs, GitHub, and npm links. Keep the landing page's hero, comparison, and quick-start sequence. Add `/docs/` as an authored documentation page with a desktop section index and linear mobile reading flow.

## Landing Page

Retain the dark amber visual language while correcting copy, links, metadata, and generated-file behavior. Add a clear documentation call to action. The page must state that builds generate a self-contained `.mjs` and mandatory `.sh` or `.ps1` wrapper per handler, invoke wrappers from settings, and replace the managed generated directory after validation.

Fix the footer GitHub URL, wording such as “type-safe,” mobile code overflow, dead styles, and the missing favicon.

## Documentation Page

Document shipped behavior only:

- Installation and initialization.
- Named `defineHandler` exports.
- All 30 hook events.
- Matcher narrowing for the five tool events.
- Generated typing for all 34 current SDK tool inputs and `unknown` for custom tools.
- Hook-specific outputs with optional, strongly typed `hookEventName` injection.
- `testHandler` usage.
- Build CLI options: config path, output, hooks directory, and runtime.
- CLI-only Node/Bun/Deno runtime selection.
- Mandatory Bash and PowerShell wrappers.
- Generated file layout and settings integration.
- Full managed-directory replacement after config, bundle, and settings validation.
- Accepted partial-output behavior for filesystem failures during writes.

Examples must match the initializer and current public exports. Do not document removed dry-run, clean, runtime persistence, or `defineConfig` behavior.

## Presentation

Use the existing typography, colors, square borders, and code styling. The docs page should favor readable sections, restrained callouts, and code blocks rather than generic card grids. Highlighted code must remain contained on mobile and scroll horizontally within its block.

## Verification

Build the Astro site and inspect `/typed-claude-hooks/` and `/typed-claude-hooks/docs/` at desktop and 390px widths. Verify navigation, external links, code containment, favicon loading, and zero console errors. Search source for removed CLI flags, obsolete API names, and incorrect repository URLs. Compare representative snippets with current TypeScript APIs and typecheck them where practical.
