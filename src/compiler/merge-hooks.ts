import { relative } from "node:path";
import { clearUndefineds } from "../utils.js";
import type { BundledFile } from "./bundle-handlers.js";

interface ExistingHookEntry {
  command?: string;
}

interface ExistingMatcherEntry {
  matcher?: string;
  hooks: ExistingHookEntry[];
}

export interface MergeOptions {
  existingSettings: Record<string, unknown>;
  bundledFiles: BundledFile[];
  projectRoot: string;
}

interface HookCommandEntry {
  type: "command";
  command: string;
  timeout?: number;
  if?: string;
  shell?: "bash" | "powershell";
  statusMessage?: string;
  once?: boolean;
  async?: boolean;
  asyncRewake?: boolean;
}

interface MatcherEntry {
  matcher?: string;
  hooks: HookCommandEntry[];
}

function createHookCommandEntry(
  projectRoot: string,
  f: BundledFile,
): HookCommandEntry {
  const { fileName, filePath, event, name, matcher, ...hookOptions } = f;
  const wrapperPath = filePath.replace(/\.mjs$/, ".sh");
  return clearUndefineds({
    type: "command" as const,
    command: `\${CLAUDE_PROJECT_DIR}/${relative(projectRoot, wrapperPath)}`,
    ...hookOptions,
  });
}

function buildHookEntries(
  bundledFiles: BundledFile[],
  projectRoot: string,
): Record<string, MatcherEntry[]> {
  const byEvent = Map.groupBy(bundledFiles, (f) => f.event);

  return Object.fromEntries(
    [...byEvent.entries()].map(([event, files]) => {
      const byMatcher = Map.groupBy(files, (f) => f.matcher);
      const matchers = [...byMatcher.entries()].map(
        ([matcher, matcherFiles]): MatcherEntry => ({
          ...(matcher !== undefined ? { matcher } : {}),
          hooks: matcherFiles.map((f) =>
            createHookCommandEntry(projectRoot, f),
          ),
        }),
      );
      return [event, matchers];
    }),
  );
}

function isManagedHook(hook: ExistingHookEntry): boolean {
  const { command } = hook;
  return (
    typeof command === "string" &&
    command.includes("typed-claude-hooks") &&
    command.endsWith(".sh")
  );
}

function matcherKey(entry: ExistingMatcherEntry): string | undefined {
  return entry.matcher;
}

function stripManagedFromExisting(
  existingHooks: Record<string, ExistingMatcherEntry[]>,
): Record<string, ExistingMatcherEntry[]> {
  return Object.fromEntries(
    Object.entries(existingHooks)
      .map(([event, matchers]) => {
        const cleaned = matchers
          .map((m) => ({
            ...m,
            hooks: (m.hooks ?? []).filter((h) => !isManagedHook(h)),
          }))
          .filter((m) => m.hooks.length > 0);
        return [event, cleaned] as const;
      })
      .filter(([, cleaned]) => cleaned.length > 0),
  );
}

function mergeByMatcher(
  existing: ExistingMatcherEntry[],
  managed: MatcherEntry[],
): ExistingMatcherEntry[] {
  const managedByMatcher = new Map<string | undefined, MatcherEntry>();
  for (const entry of managed) {
    managedByMatcher.set(entry.matcher, entry);
  }

  const seen = new Set<string | undefined>();
  const result: ExistingMatcherEntry[] = [];

  for (const entry of existing) {
    const key = matcherKey(entry);
    const managedMatch = managedByMatcher.get(key);
    if (managedMatch) {
      result.push({
        ...entry,
        hooks: [...entry.hooks, ...managedMatch.hooks],
      });
      seen.add(key);
    } else {
      result.push(entry);
    }
  }

  for (const entry of managed) {
    if (!seen.has(entry.matcher)) {
      result.push(entry);
    }
  }

  return result;
}

export function mergeHooksIntoSettings(
  options: MergeOptions,
): Record<string, unknown> {
  const { existingSettings, bundledFiles, projectRoot } = options;
  const newHookEntries = buildHookEntries(bundledFiles, projectRoot);
  const existingHooks = (existingSettings.hooks ?? {}) as Record<
    string,
    ExistingMatcherEntry[]
  >;
  const cleaned = stripManagedFromExisting(existingHooks);

  const allEvents = [
    ...new Set([...Object.keys(cleaned), ...Object.keys(newHookEntries)]),
  ];

  const hooks = Object.fromEntries(
    allEvents.map((event) => [
      event,
      mergeByMatcher(cleaned[event] ?? [], newHookEntries[event] ?? []),
    ]),
  );

  return {
    ...existingSettings,
    hooks,
  };
}
