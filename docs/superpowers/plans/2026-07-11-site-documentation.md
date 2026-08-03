# Site Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the landing page and add a dedicated documentation route matching the current library behavior.

**Architecture:** Introduce shared navigation and reusable highlighted-code presentation while preserving the existing landing flow. Add an authored `/docs/` route with accurate API, CLI, runtime, testing, and generated-output documentation.

**Tech Stack:** Astro 5, TypeScript, Shiki, CSS, Playwright browser verification

---

### Task 1: Shared Site Shell

**Files:**
- Create: `site/src/components/Header.astro`
- Modify: `site/src/layouts/Base.astro`
- Modify: `site/src/styles/global.css`
- Add: `site/public/favicon.svg`

- [ ] Add a compact shared header linking to the base-aware home route, docs route, correct GitHub repository, and npm package.
- [ ] Render the header from `Base.astro`, add accurate descriptions, canonical URL metadata, and favicon link.
- [ ] Add global code containment and focus-visible styles while preserving the existing dark amber design.
- [ ] Run `npm run build --prefix site`; expect both existing landing output and assets to compile.

### Task 2: Correct the Landing Page

**Files:**
- Modify: `site/src/components/Hero.astro`
- Modify: `site/src/components/Comparison.astro`
- Modify: `site/src/components/QuickStart.astro`
- Modify: `site/src/components/Footer.astro`

- [ ] Correct repository links, “type-safe” wording, runtime/wrapper copy, and build replacement semantics.
- [ ] Add a visible Docs CTA without adding full documentation to the landing page.
- [ ] Keep the valid permission-denial snippet aligned with the initializer and remove dead tooltip styles.
- [ ] Ensure highlighted code scrolls inside its block at 390px rather than extending beyond the viewport.

### Task 3: Add Dedicated Documentation

**Files:**
- Create: `site/src/pages/docs.astro`
- Create: `site/src/components/Docs.astro`

- [ ] Add sections for installation, named handler exports, matcher narrowing, outputs, testing, CLI/runtime/shells, generated files, and destructive rebuild behavior.
- [ ] Use current examples:

```ts
export const protectEnvFiles = defineHandler(
  "PreToolUse",
  { matcher: "Write|Edit" },
  async (input) => ({
    hookSpecificOutput: {
      permissionDecision: "deny" as const,
      permissionDecisionReason: "Cannot modify .env files",
    },
  }),
)
```

- [ ] Document all 30 events, five matcher-aware tool events, 34 generated SDK tool inputs, optional exact `hookEventName`, `testHandler`, CLI-only runtime, mandatory wrappers, and full managed-directory replacement.
- [ ] Add a sticky desktop section index and readable linear mobile layout.

### Task 4: Verify Accuracy and Rendering

**Files:**
- Review all site files

- [ ] Run `npm run build --prefix site`; expect successful static routes for home and docs.
- [ ] Preview and inspect `/typed-claude-hooks/` and `/typed-claude-hooks/docs/` at desktop and 390px widths.
- [ ] Verify no horizontal page overflow, no console errors, favicon success, and correct internal/external links.
- [ ] Search site source for `--dry-run`, `--clean`, `defineConfig`, `anthropics/typed-claude-hooks`, and direct `.mjs` settings commands; expect no stale documentation.
- [ ] Run root `npm run check`, `npm run build`, and `npm test` to ensure documentation work did not regress the library.
