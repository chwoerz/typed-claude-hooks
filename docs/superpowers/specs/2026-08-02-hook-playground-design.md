# Hook Playground Design

## Goal

Add a browser-based playground to the existing Astro site where users can author a real `hooks.config.ts` with Monaco autocomplete, inspect the generated Claude Code settings, understand where every file belongs, and download production artifacts without uploading source code.

The first version builds hooks but does not execute them. It remains compatible with the site's static GitHub Pages deployment.

## Scope

The playground supports:

- One virtual `hooks.config.ts` containing multiple named `defineHandler(...)` exports.
- Monaco TypeScript diagnostics and autocomplete for the package's public API, generated hook and tool-input types, matcher-aware input narrowing, and Node APIs.
- Automatic, debounced browser builds.
- Production `.mjs` bundles that preserve `node:*` imports for later execution under Node.
- Shell wrappers and a merge-safe settings snippet using the same conventions as the CLI.
- A ZIP containing source, generated artifacts, and placement instructions.

The first version does not support:

- Executing hooks in the browser or on a server.
- Arbitrary npm dependencies.
- Multiple virtual source files or imports between user-authored files.
- Draft persistence, accounts, or shareable links.
- Bun or Deno artifact generation. Playground artifacts target the default Node runtime.

Allowed imports are `typed-claude-hooks`, `typed-claude-hooks/types`, and `node:*`. The browser compiler rejects all other imports with an actionable diagnostic.

## Architecture

Create a static `/playground/` Astro page containing a single client-side playground component. The rest of the site remains server-rendered static HTML.

Monaco owns editing, TypeScript language services, completion, and inline diagnostics. Its virtual TypeScript environment receives declaration bundles derived from the library's actual public declarations and `@types/node`, preventing a manually maintained approximation of the API.

A dedicated Web Worker owns `esbuild-wasm`. Moving compilation off the main thread keeps Monaco and the page responsive. After a short debounce, the component sends the current source and a monotonically increasing request ID to the worker. The worker returns diagnostics, handler metadata, the settings snippet, and generated artifact bytes. The component ignores responses older than its latest request.

The browser compiler treats `node:*` modules as external. It resolves the library authoring API to a browser-safe internal module while compiling, but generated handlers retain the runtime behavior required by the CLI's bundles.

To prevent browser and CLI output from drifting, extract environment-neutral artifact logic from the compiler into shared modules. Shared logic includes wrapper rendering, handler output paths, command entries, and settings hook construction. CLI filesystem orchestration and merging with an existing settings file remain Node-only. The browser supplies an empty existing-settings object and serializes only the resulting `hooks` property as its snippet.

The browser compiler may use a browser-specific handler discovery step because the current CLI config loader evaluates the compiled module under Node. The accepted browser syntax is intentionally limited to direct, named `defineHandler(...)` exports in the single config file. Re-exports and dynamically constructed handlers are rejected rather than evaluated.

## Interface

Add `Playground` to the primary navigation. The page follows the existing dark stone, amber, square-edged visual language.

On desktop, the workspace uses the approved persistent split layout:

- Left: Monaco editor for `hooks.config.ts`.
- Right: build output and installation guidance.
- Top action bar: `Reset` and `Download ZIP`.

On narrow screens, the panels stack with the editor above output. Both remain usable without horizontal page scrolling.

The right panel shows:

- Compiler loading, building, valid, or error status.
- Type and build diagnostic count with source locations.
- Discovered handler names, events, and matchers.
- The complete JSON object whose `hooks` property should be merged into `.claude/settings.json`.
- A compact file tree with artifact sizes, without displaying full `.mjs` or wrapper contents.
- Exact source and artifact destinations.

`Download ZIP` is disabled while dependencies are loading, a build is running, diagnostics contain errors, or no handlers were discovered. The initial starter config builds automatically. `Reset` asks for confirmation before restoring that starter source. Source is neither persisted nor transmitted.

## Build Data Flow

1. Astro loads the static playground shell.
2. The client initializes Monaco, the declaration libraries, and the compiler worker.
3. Monaco receives the starter `hooks.config.ts` and immediately provides completions and type diagnostics.
4. Each edit starts a short debounce. The latest source is sent to the worker after typing pauses.
5. The worker validates imports and statically discovers direct named handler exports.
6. The worker builds one self-contained `.mjs` artifact per handler with `esbuild-wasm`, externalizing `node:*` imports.
7. Shared artifact functions render the matching `.sh` wrapper and settings command entry for each handler.
8. The worker returns metadata, settings, and binary/text artifacts tagged with the request ID.
9. The UI updates only if the response matches the latest request.
10. On request, the client creates and downloads the ZIP entirely in the browser.

## ZIP Contract

The downloaded archive contains:

```text
hooks.config.ts
settings.hooks.snippet.json
README.txt
.claude/
  hooks/
    typed-claude-hooks/
      <Event>/
        <handler>.mjs
        <handler>.sh
```

`settings.hooks.snippet.json` contains a top-level `hooks` object, not a complete settings file. `README.txt` warns users not to replace an existing `.claude/settings.json`; it explains how to append each generated matcher entry to the corresponding event array without deleting existing entries, where to place the generated hook directory, and that the editable source normally belongs at `.typed-claude-hooks/hooks.config.ts`.

The source is placed at the ZIP root so extracting the archive cannot accidentally overwrite a user's existing sandbox config. The README supplies the destination explicitly.

## Error Handling

Monaco presents TypeScript syntax and type errors inline. The output panel presents the same diagnostics in a keyboard-accessible list and adds compiler-specific failures.

Unsupported imports identify the module and list the imports v1 supports. Unsupported handler forms explain that handlers must be direct named exports. Duplicate export names, invalid handler names, no discovered handlers, and artifact-generation failures prevent download.

If Monaco or `esbuild-wasm` initialization fails, the editor source remains visible where possible, the output panel explains that generation is unavailable, and download remains disabled. Worker crashes create a visible error and permit a worker retry without reloading the page.

## Testing

Unit tests cover the extracted environment-neutral artifact functions, including paths, wrapper commands, matcher grouping, handler options, and deterministic settings snippets.

Browser-compiler tests cover:

- A valid starter handler.
- Multiple handlers across events and matchers.
- Matcher-aware authoring types.
- A `node:*` import that remains external in the bundle.
- Rejection of arbitrary npm imports.
- Invalid TypeScript and unsupported export forms.
- Stale worker response suppression.
- ZIP names, hierarchy, snippets, README guidance, and artifact contents.

Browser-level tests verify that Monaco initializes, automatic rebuilds update the settings preview, errors disable downloads, Reset restores the starter, the ZIP can be requested, and the layout stacks on a narrow viewport.

Existing CLI tests continue to verify generated artifact behavior after shared logic is extracted. Run the root checks and tests, then build the separate Astro site as final verification.

## Success Criteria

- Users receive event-, matcher-, output-, and Node-aware Monaco autocomplete.
- Valid multiple-handler source automatically produces settings and downloadable Node artifacts without a backend.
- The settings snippet is safe and clearly documented as merge-only.
- Users can identify every local destination without opening generated bundles.
- Browser-generated wrapper paths and settings commands match CLI conventions.
- The static site still builds and deploys on GitHub Pages and works on desktop and mobile.
