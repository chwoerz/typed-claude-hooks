# Auto-Init Sandbox

Replace the `init` command with a single zero-argument `typed-claude-hooks` command that
scaffolds and installs everything it needs on first run.

## Problem

Two problems with the current design.

**The `init` command is a redundant step.** It creates `hooks.config.ts` and `tsconfig.json`,
prints a follow-up build command, and does nothing else. Every user runs `init` once and then
never again. The build could do the same work itself.

**Scaffolding into the project root is invasive.** `init` writes `tsconfig.json` to the root
of whatever repository it runs in. That repository may be Python or Go, or it may be a
TypeScript project with its own carefully configured `tsconfig.json` and dependency tree.
Editor autocompletion for `hooks.config.ts` also requires `typed-claude-hooks` to resolve
through `node_modules` from the config's directory, which means a dependency in the host
project. A global install does not satisfy this: the global prefix is not on the
`node_modules` chain above the user's project, so both the editor and the esbuild-based build
fail to resolve the package.

## Solution

Everything the tool authors and needs lives in a self-contained npm project at
`.typed-claude-hooks/`. The host repository is never touched apart from
`.claude/settings.json` and the generated hook artifacts.

### CLI surface

The `build` subcommand is removed; building is what the bare command does.

```
npx typed-claude-hooks [config] [-o <settings>] [--hooks-dir <dir>] [--runtime node|bun|deno]
npx typed-claude-hooks init
```

`init` is retained as the one subcommand. It performs the same scaffold and
dependency sync as the bare command and then stops, without building: no
`settings.json` is written and no hook artifacts are generated. It never
overwrites an existing file, and it reports the files it skipped so a run that
does nothing says so rather than being silent.

Note that `init` therefore does not regenerate a file the user has damaged —
that limitation is accepted. Its purpose is setup without a build, so an editor
has working types before any hooks are wired into `settings.json`.

| Argument       | Default                                |
|----------------|----------------------------------------|
| `[config]`     | `.typed-claude-hooks/hooks.config.ts`  |
| `-o, --output` | `.claude/settings.json`                |
| `--hooks-dir`  | `hooks/` next to the output            |
| `--runtime`    | `node`                                 |

`-o` was previously required and becomes optional with a default. `--hooks-dir` and
`--runtime` are unchanged.

### The sandbox

```
.typed-claude-hooks/
|-- package.json        private, "type": "module", depends on typed-claude-hooks
|-- hooks.config.ts     the example handler
|-- tsconfig.json       strict, NodeNext, include ["**/*.ts"]
|-- .gitignore          node_modules/
|-- package-lock.json   committed, so teammates reproduce the same tree
`-- node_modules/
```

The `tsconfig.json` lives inside the sandbox. Editors resolve the nearest `tsconfig.json` for
a file, so it governs `hooks.config.ts` and nothing else in the host repository.
Autocompletion works because `node_modules` is a sibling of the config, which is exactly what
TypeScript's resolution walk expects.

Generated `.mjs` hooks are esbuild bundles with their dependencies inlined. The sandbox's
`node_modules` is therefore needed only at build time and for editor types. Deleting it does
not stop installed hooks from running.

### Run sequence

Each run performs three phases in order.

**1. Scaffold.** Write `package.json`, `hooks.config.ts`, `tsconfig.json`, and `.gitignore` if
absent. Never overwrite an existing file. `package-lock.json` and `node_modules/` are produced
by npm in the next phase, not scaffolded.

**2. Sync the dependency.** Resolve the `typed-claude-hooks` version installed in the sandbox
and compare it against the running CLI's version. If it is missing or different, rewrite only
the `typed-claude-hooks` entry in the sandbox `package.json` and run
`npm install --prefix .typed-claude-hooks`.

- Dependencies the user added for their own hooks are preserved. This mirrors how the build
  already preserves hand-written hooks when merging `settings.json`.
- A `file:` or `link:` version specifier is left untouched. This repository dogfoods itself
  with `"typed-claude-hooks": "file:.."`, and overwriting that with a registry version would
  break local development.
- If `npm install` fails, stop and surface that error directly rather than letting the build
  proceed into a confusing `Could not resolve "typed-claude-hooks"` from esbuild.

The CLI's own version is read from its installed `package.json` rather than hardcoded.
`src/cli/index.ts` currently passes a literal `"0.1.0"` to `.version()`, which can drift from
the real package version; the same resolved value serves both `--version` and the sync check.

**3. Build.** Unchanged: load the config, extract handlers, bundle each into a `.mjs` plus its
shell wrapper, merge the wrapper commands into `settings.json`.

First run in an empty repository:

```
$ npx typed-claude-hooks
Created .typed-claude-hooks/package.json
Created .typed-claude-hooks/hooks.config.ts
Created .typed-claude-hooks/tsconfig.json
Created .typed-claude-hooks/.gitignore
Installing typed-claude-hooks@0.1.0...
+ Found 1 handler(s)
+ Generated .claude/settings.json
  -> PreToolUse: protectEnvFiles
```

Later runs print only the build summary.

## Rejected Alternatives

**Keep `build` as a subcommand.** Building is the default action, so naming it adds a word
without adding a choice.

**Delete `init` entirely.** Considered and rejected: scaffolding without building is a
genuinely distinct operation, and removing the verb would turn a habitual
`typed-claude-hooks init` into "build a config file named `init`", which fails with an opaque
esbuild resolution error.

**Let `init --force` overwrite existing files.** Rejected: destructive regeneration is not
worth the footgun of one stray invocation destroying a hand-written `hooks.config.ts`.

**Scaffold and stop, so the user reads the config before it goes live.** Rejected in favor of
one command producing a working hook. The example handler denies edits to `.env` files, which
is safe to activate unread.

**Symlink the running CLI into the sandbox instead of installing.** Instant and offline, but
the link points into an npx cache or a global prefix. It breaks when that cache is pruned and
is meaningless to a teammate who clones the repository.

**Detect a missing local install and instruct the user to run `npm install -D`.** Superseded:
the dependency now lives in the sandbox, so the CLI installs it rather than asking.

**Collect handlers from every `*.ts` file in the sandbox.** A dedicated directory makes this
cheap, but it requires cross-file handler-name collision detection and turns the `[config]`
argument into a directory path. The single-config model with named exports is retained;
users split code out into modules and import them.

## Implementation Notes

- Scaffolding and dependency sync move into a dedicated sandbox module. `src/cli/init.ts`
  shrinks to a thin wrapper over it, and `src/cli/index.ts` keeps a default action plus the
  single `init` subcommand.
- `ensureSandbox` returns the names of the files it created, so `init` can report the rest as
  skipped.
- `tests/cli/init.integration.test.ts` is rewritten to cover the new `init`: it scaffolds,
  reports skips on a second run, and writes no `settings.json`. A separate first-run
  integration test covers the bare command end to end.
- This repository's own root `hooks.config.ts` moves into `.typed-claude-hooks/`.
  `tests/compiler/annotate-pure-handlers.test.ts` references it at `../../hooks.config.ts`
  and must be updated.
- The README Quick Start and CLI table, and the site components `Hero.astro`,
  `QuickStart.astro`, and `Docs.astro`, all advertise `init` and need rewriting.

## Out of Scope

- Package managers other than npm. The sandbox is independent of the host project, so the
  host's choice of pnpm, yarn, or bun does not matter.
- Backwards compatibility with a root `hooks.config.ts`. There is one canonical location.