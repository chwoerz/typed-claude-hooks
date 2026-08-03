# Simplified Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace build planning, dry-run, clean mode, staging, and incremental writes with a direct full managed-directory rebuild.

**Architecture:** Config loading, bundling, settings parsing, and settings merging remain mutation-free. After they succeed, remove the exact managed directory and directly write every bundle, wrapper, and settings file; write failures are reported without rollback.

**Tech Stack:** TypeScript, Node.js filesystem APIs, Commander, Vitest, Biome

---

### Task 1: Specify Destructive Rebuild Behavior

**Files:**
- Modify: `tests/cli/build.integration.test.ts`

- [ ] Remove dry-run, clean-mode, mtime, and staged-write-failure tests.
- [ ] Retain stale-artifact, outside-path, symlink-target, wrapper execution, config failure, and malformed-settings coverage.
- [ ] Add an assertion that every successful build replaces an otherwise-valid generated artifact, proving there is no incremental write behavior.
- [ ] Run `npx vitest run tests/cli/build.integration.test.ts`; expect failures until production options and write flow are simplified.

### Task 2: Simplify Build Application

**Files:**
- Modify: `src/cli/build.ts`

- [ ] Remove `BuildPlan`, `PlannedWrite`, UUID staging, content/mode comparison, containment helpers, recursive stale reconciliation, and atomic rename logic.
- [ ] Keep config load, handler extraction, in-memory bundle creation, existing-settings parsing, and settings merge before mutation.
- [ ] Apply output with this direct flow:

```ts
removeManagedDirectory(managedDir);
bundledFiles.forEach((file) => {
  mkdirSync(dirname(file.filePath), { recursive: true });
  writeFileSync(file.filePath, file.contents);
  writeFileSync(file.wrapper.filePath, file.wrapper.contents);
  if (file.shell !== "powershell") chmodSync(file.wrapper.filePath, 0o755);
});
mkdirSync(dirname(settingsPath), { recursive: true });
writeFileSync(settingsPath, `${JSON.stringify(merged, null, 2)}\n`);
```

- [ ] Use `lstatSync` semantics so a symlink at the managed-directory path is unlinked rather than traversed.
- [ ] Remove `dryRun` and `clean` from `BuildOptions`.
- [ ] Run `npx vitest run tests/cli/build.integration.test.ts tests/cli/generated-files.integration.test.ts`; expect all tests to pass.

### Task 3: Remove CLI Flags and Documentation

**Files:**
- Modify: `src/cli/index.ts`
- Modify: `README.md`

- [ ] Remove `dryRun` and `clean` from `BuildActionOptions` and Commander options.
- [ ] Remove `--dry-run` and `--clean` rows and explanations from README.
- [ ] Search with `rg "dryRun|dry run|--dry-run|--clean|clean mode" src tests README.md CLAUDE.md site` and remove only obsolete build-option references.

### Task 4: Verify the Simplified Build

**Files:**
- Review all modified files

- [ ] Run `npm run check`; expect no diagnostics.
- [ ] Run `npm run build`; expect successful TypeScript compilation.
- [ ] Run `npm test`; expect all non-environment-dependent tests to pass.
- [ ] Run `npm run build --prefix site`; expect successful Astro output.
- [ ] Run `node dist/cli/index.js build -o .claude/settings.json`; expect managed hooks to regenerate through mandatory wrappers.
- [ ] Run `git diff --check`; expect no whitespace errors.
