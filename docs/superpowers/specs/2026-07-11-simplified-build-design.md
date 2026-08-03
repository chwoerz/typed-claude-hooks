# Simplified Build Design

## Goal

Remove build-preview, forced-clean, incremental-write, and rollback machinery in favor of a small destructive build flow.

## CLI

Remove `--dry-run` and `--clean` from the `build` command and `BuildOptions`. Update README and tests so these options are no longer documented or accepted.

## Build Flow

The build performs all operations that can fail without filesystem mutation first:

1. Resolve paths.
2. Load and validate the config.
3. Extract handlers.
4. Bundle every handler and wrapper in memory.
5. Read and parse existing settings.
6. Merge managed hook entries into settings.

After those steps succeed, the build applies output directly:

1. Delete the entire managed hooks directory without following symlink targets.
2. Create event directories.
3. Write every `.mjs` bundle and mandatory `.sh` or `.ps1` wrapper.
4. Set POSIX wrapper executable permissions.
5. Write the merged settings JSON.

## Failure Semantics

Compile, config, or settings-parse errors leave existing generated hooks untouched because they happen before deletion.

Filesystem errors after deletion may leave generated hooks missing or partially written, and settings may remain old or be partially updated. The command reports the error and exits unsuccessfully. There is no staging, rollback, or recovery transaction; rerunning a successful build restores the generated state.

## Removed Behavior

- Dry-run preview and dry-run immutability.
- Explicit clean mode.
- Incremental content and mode comparison.
- Mtime preservation.
- Per-file stale reconciliation.
- Temporary staging files, UUIDs, atomic renames, and rollback-oriented cleanup.

Normal builds still remove all stale managed artifacts because the complete managed directory is replaced every time. Files outside that exact directory remain untouched.

## Testing

Retain tests proving config/bundle/settings errors occur before deletion, generated wrappers execute, stale managed files disappear, similarly named files outside the managed directory survive, and managed-directory symlinks do not cause deletion of external targets. Remove tests for dry-run, clean mode, mtime stability, staged-write failure, and incremental writes.
