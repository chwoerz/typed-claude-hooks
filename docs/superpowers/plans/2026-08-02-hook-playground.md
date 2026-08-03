# Hook Playground Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a static Monaco playground that type-checks and builds downloadable Node hook artifacts in-browser.

**Architecture:** Monaco handles editing and TypeScript diagnostics. A Web Worker uses TypeScript AST analysis and `esbuild-wasm` to discover and bundle handlers. Environment-neutral artifact generation is shared with the CLI.

**Tech Stack:** Astro, Monaco Editor, TypeScript, esbuild WASM, fflate, Vitest, Playwright.

---

### Task 1: Extract Shared Artifact Planning

**Files:**
- Create: `src/compiler/artifact-plan.ts`
- Modify: `src/compiler/bundle-handlers.ts`
- Modify: `src/compiler/merge-hooks.ts`
- Test: `tests/compiler/artifact-plan.test.ts`
- Test: `tests/compiler/bundle-handlers.test.ts`
- Test: `tests/compiler/merge-hooks.test.ts`

- [ ] Add failing tests for deterministic `.mjs`/wrapper paths, wrapper rendering, matcher grouping, and settings command generation.
- [ ] Run `npm test -- tests/compiler/artifact-plan.test.ts` and verify the new tests fail for missing exports.
- [ ] Extract environment-neutral functions:
  - `planArtifactPaths(handler, hooksRoot, runtime)`
  - `createWrapperArtifact(handler, mjsPath, runtime)`
  - `buildHookEntries(artifacts, projectRoot)`
  - `createSettingsSnippet(artifacts, projectRoot)`
- [ ] Keep filesystem access and existing-settings merging in Node-specific modules.
- [ ] Adapt CLI bundling and merging to use the shared functions.
- [ ] Run `npm test -- tests/compiler` and verify all compiler tests pass.
- [ ] Commit with `git add src/compiler/artifact-plan.ts src/compiler/bundle-handlers.ts src/compiler/merge-hooks.ts tests/compiler/artifact-plan.test.ts tests/compiler/bundle-handlers.test.ts tests/compiler/merge-hooks.test.ts && git commit -m "refactor: share hook artifact planning"`.

### Task 2: Prepare Browser Type Libraries

**Files:**
- Create: `site/scripts/prepare-playground-types.mjs`
- Create: `site/src/playground/type-libraries.ts`
- Modify: `site/package.json`
- Modify: `.github/workflows/deploy-site.yml`
- Modify: `CLAUDE.md`
- Test: `site/tests/type-libraries.test.ts`

- [ ] Add a failing test asserting that prepared libraries include `typed-claude-hooks`, `typed-claude-hooks/types`, `@types/node`, and their transitive declaration files.
- [ ] Run the site test and verify it fails because the generated manifest does not exist.
- [ ] Implement a preparation script that reads root `dist/**/*.d.ts` and Node declarations and creates a browser-loadable manifest.
- [ ] Ensure generated type assets are build output, not hand-maintained source.
- [ ] Update CI to install and build the root package before building the site.
- [ ] Update development instructions to document the root-build prerequisite.
- [ ] Run the root build and type-library test and verify they pass.
- [ ] Commit with `git add site/scripts/prepare-playground-types.mjs site/src/playground/type-libraries.ts site/package.json site/package-lock.json .github/workflows/deploy-site.yml CLAUDE.md site/tests/type-libraries.test.ts && git commit -m "build: prepare playground type libraries"`.

### Task 3: Implement Static Handler Discovery

**Files:**
- Create: `site/src/playground/compiler/discover-handlers.ts`
- Create: `site/src/playground/compiler/types.ts`
- Test: `site/tests/discover-handlers.test.ts`

- [ ] Add failing tests for multiple direct named exports, an aliased `defineHandler` import, event/matcher/options extraction, duplicate names, invalid identifiers, re-exports, dynamic handler construction, and unsupported imports.
- [ ] Run `npm test -- tests/discover-handlers.test.ts` from `site/` and verify the tests fail because discovery is not implemented.
- [ ] Parse the single virtual config using the TypeScript compiler API.
- [ ] Accept only direct named exports initialized by the imported `defineHandler` symbol.
- [ ] Permit only `typed-claude-hooks`, `typed-claude-hooks/types`, and `node:*` imports.
- [ ] Return source-positioned diagnostics rather than throwing for author errors.
- [ ] Run the discovery tests and verify they pass.
- [ ] Commit with `git add site/src/playground/compiler/discover-handlers.ts site/src/playground/compiler/types.ts site/tests/discover-handlers.test.ts && git commit -m "feat: discover browser playground handlers"`.

### Task 4: Build Hooks In A Web Worker

**Files:**
- Create: `site/src/playground/compiler/compiler.worker.ts`
- Create: `site/src/playground/compiler/build-handlers.ts`
- Create: `site/src/playground/compiler/virtual-modules.ts`
- Modify: `site/package.json`
- Modify: `site/package-lock.json`
- Test: `site/tests/build-handlers.test.ts`

- [ ] Add `esbuild-wasm`, `typescript`, and `fflate` to the site dependencies.
- [ ] Add failing tests for one artifact per named handler, sibling tree-shaking, preserved `node:*` imports, the stdin/stdout runtime, `.sh` wrappers, settings parity, unsupported imports, and invalid source.
- [ ] Run the build-handler tests and verify they fail because browser compilation is not implemented.
- [ ] Map `typed-claude-hooks` to a browser-safe virtual authoring implementation.
- [ ] Mark `node:*` imports external.
- [ ] Generate one Node ESM bundle per discovered handler.
- [ ] Return request IDs, diagnostics, metadata, settings, and artifacts from the worker.
- [ ] Handle WASM initialization and worker failures explicitly.
- [ ] Run site compiler tests and verify they pass.
- [ ] Commit with `git add site/src/playground/compiler site/tests/build-handlers.test.ts site/package.json site/package-lock.json && git commit -m "feat: compile hooks in browser worker"`.

### Task 5: Configure Monaco

**Files:**
- Create: `site/src/playground/editor.ts`
- Create: `site/src/playground/monaco-workers.ts`
- Create: `site/src/playground/starter.ts`
- Modify: `site/package.json`
- Modify: `site/package-lock.json`
- Test: `site/tests/editor.test.ts`

- [ ] Add `monaco-editor` to site dependencies.
- [ ] Add failing tests for compiler options, virtual module paths, starter source, and diagnostic conversion.
- [ ] Run the editor tests and verify they fail because Monaco configuration is absent.
- [ ] Configure strict TypeScript with NodeNext-compatible behavior and no emit.
- [ ] Register all prepared package and Node declaration files with Monaco.
- [ ] Configure Monaco workers through Vite-compatible worker imports.
- [ ] Verify event, matcher-narrowed input, output, and Node completion types in tests.
- [ ] Run editor tests and verify they pass.
- [ ] Commit with `git add site/src/playground/editor.ts site/src/playground/monaco-workers.ts site/src/playground/starter.ts site/tests/editor.test.ts site/package.json site/package-lock.json && git commit -m "feat: configure Monaco hook authoring"`.

### Task 6: Implement Playground State Controller

**Files:**
- Create: `site/src/playground/controller.ts`
- Create: `site/src/playground/zip.ts`
- Create: `site/src/playground/readme.ts`
- Test: `site/tests/controller.test.ts`
- Test: `site/tests/zip.test.ts`

- [ ] Add failing tests for debounced builds, stale-response suppression, download state, Reset, and ZIP generation.
- [ ] Assert the ZIP contains `hooks.config.ts`, `settings.hooks.snippet.json`, `README.txt`, each `.mjs`, and each matching `.sh` wrapper at the specified paths.
- [ ] Run controller and ZIP tests and verify they fail because the modules are absent.
- [ ] Implement the debounced controller and ignore worker responses older than the latest request ID.
- [ ] Disable download during loading, building, errors, and empty handler output.
- [ ] Implement Reset without local persistence.
- [ ] Generate ZIPs entirely in-browser with `fflate`.
- [ ] Generate README guidance for source placement and merge-safe settings installation.
- [ ] Run controller and ZIP tests and verify they pass.
- [ ] Commit with `git add site/src/playground/controller.ts site/src/playground/zip.ts site/src/playground/readme.ts site/tests/controller.test.ts site/tests/zip.test.ts && git commit -m "feat: manage playground builds and downloads"`.

### Task 7: Build The Split-View Interface

**Files:**
- Create: `site/src/components/Playground.astro`
- Create: `site/src/pages/playground.astro`
- Create: `site/src/styles/playground.css`
- Modify: `site/src/components/Header.astro`
- Test: `site/tests/playground-page.test.ts`

- [ ] Add semantic tests for status, diagnostics, handler summary, settings preview, file tree, placement instructions, Reset, and ZIP controls.
- [ ] Run the page tests and verify they fail because the playground page is absent.
- [ ] Implement the approved persistent desktop split view.
- [ ] Stack the editor above output on narrow screens without horizontal page scrolling.
- [ ] Display artifact sizes without exposing full bundle contents.
- [ ] Add keyboard-accessible diagnostics and status announcements.
- [ ] Add `Playground` to primary navigation.
- [ ] Preserve the existing dark stone, amber, square-edged visual system.
- [ ] Run `npm run build` from `site/` and verify the static page builds.
- [ ] Commit with `git add site/src/components/Playground.astro site/src/pages/playground.astro site/src/styles/playground.css site/src/components/Header.astro site/tests/playground-page.test.ts && git commit -m "feat: add hook playground interface"`.

### Task 8: Browser-Level Verification

**Files:**
- Create: `site/playwright.config.ts`
- Create: `site/e2e/playground.spec.ts`
- Modify: `site/package.json`
- Modify: `site/package-lock.json`
- Modify: `.github/workflows/deploy-site.yml`

- [ ] Add Playwright Chromium setup and production-preview web-server configuration.
- [ ] Add browser tests for Monaco initialization, starter autocomplete, automatic settings-preview updates, invalid-source download disabling, Reset confirmation, ZIP download, worker retry, and mobile stacking.
- [ ] Run the browser suite and verify it fails before the remaining browser wiring is complete.
- [ ] Fix browser integration issues with the smallest changes in the relevant playground modules.
- [ ] Run the browser suite against the production Astro build and verify it passes.
- [ ] Add site unit and browser tests to deployment CI.
- [ ] Commit with `git add site/playwright.config.ts site/e2e/playground.spec.ts site/package.json site/package-lock.json .github/workflows/deploy-site.yml && git commit -m "test: verify playground browser workflow"`.

### Task 9: Documentation And Final Verification

**Files:**
- Modify: `README.md`
- Modify: `site/src/components/Docs.astro`
- Modify: `site/src/components/QuickStart.astro`
- Modify: `.gitignore`
- Track: `docs/superpowers/specs/2026-08-02-hook-playground-design.md`
- Track: `docs/superpowers/plans/2026-08-02-hook-playground.md`

- [ ] Document playground limitations: no execution, extra npm packages, multi-file configs, Bun, or Deno.
- [ ] Link the playground from documentation and quick start.
- [ ] Remove `docs/superpowers` from `.gitignore` so the approved spec and plan can be tracked.
- [ ] Run `npm run check`, `npm test`, and `npm run build` from the repository root; verify all pass.
- [ ] Run `npm test`, `npm run build`, and the Playwright suite from `site/`; verify all pass.
- [ ] Review the production page at desktop and mobile widths.
- [ ] Inspect browser storage and network requests to verify source is neither persisted nor transmitted.
- [ ] Commit with `git add README.md site/src/components/Docs.astro site/src/components/QuickStart.astro .gitignore docs/superpowers/specs/2026-08-02-hook-playground-design.md docs/superpowers/plans/2026-08-02-hook-playground.md && git commit -m "docs: document browser hook playground"`.
