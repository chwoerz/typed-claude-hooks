import { relative } from "node:path";
import type { HandlerOptions } from "../types/mapping.js";
import { clearUndefineds } from "../utils.js";
import type { PlannedArtifact } from "./bundle-handlers.js";

interface ExistingHookEntry {
  command?: string;
}

interface ExistingMatcherEntry {
  matcher?: string;
  hooks: ExistingHookEntry[];
}

export interface MergeOptions {
  existingSettings: Record<string, unknown>;
  bundledFiles: PlannedArtifact[];
  managedCommandPrefix: string;
  projectRoot: string;
}

interface HookCommandEntry extends Omit<HandlerOptions, "matcher"> {
  type: "command";
  command: string;
}

interface MatcherEntry {
  matcher?: string;
  hooks: HookCommandEntry[];
}

function createHookCommandEntry(projectRoot: string, f: PlannedArtifact): HookCommandEntry {
  const {
    contents: _contents,
    event,
    fileName,
    filePath,
    matcher,
    name,
    runtime: _runtime,
    wrapper,
    ...hookOptions
  } = f;
  const commandPath = wrapper.filePath;
  const relativeCommandPath = `\${CLAUDE_PROJECT_DIR}/${relative(projectRoot, commandPath).replaceAll("\\", "/")}`;
  const command = `"${relativeCommandPath}"`;
  return clearUndefineds({
    type: "command" as const,
    command: f.shell === "powershell" ? `& ${command}` : command,
    ...hookOptions,
  });
}

function buildHookEntries(bundledFiles: PlannedArtifact[], projectRoot: string): Record<string, MatcherEntry[]> {
  const byEvent = Map.groupBy(bundledFiles, (f) => f.event);

  return Object.fromEntries(
    [...byEvent.entries()].map(([event, files]) => {
      const byMatcher = Map.groupBy(files, (f) => f.matcher);
      const matchers = [...byMatcher.entries()].map(
        ([matcher, matcherFiles]): MatcherEntry => ({
          ...(matcher !== undefined ? { matcher } : {}),
          hooks: matcherFiles.map((f) => createHookCommandEntry(projectRoot, f)),
        }),
      );
      return [event, matchers];
    }),
  );
}

function isManagedHook(hook: ExistingHookEntry, managedCommandPrefix: string): boolean {
  const { command } = hook;
  return (
    typeof command === "string" &&
    ((command.startsWith(`"${managedCommandPrefix}`) && /\.(?:ps1|sh)"$/.test(command)) ||
      (command.startsWith(`& "${managedCommandPrefix}`) && /\.ps1"$/.test(command)) ||
      (command.startsWith(managedCommandPrefix) && /\.sh$/.test(command)))
  );
}

function stripManagedFromExisting(
  existingHooks: Record<string, ExistingMatcherEntry[]>,
  managedCommandPrefix: string,
): Record<string, ExistingMatcherEntry[]> {
  return Object.fromEntries(
    Object.entries(existingHooks)
      .map(([event, matchers]) => {
        const cleaned = matchers
          .map((m) => ({
            ...m,
            hooks: (m.hooks ?? []).filter((h) => !isManagedHook(h, managedCommandPrefix)),
          }))
          .filter((m) => m.hooks.length > 0);
        return [event, cleaned] as const;
      })
      .filter(([, cleaned]) => cleaned.length > 0),
  );
}

function mergeByMatcher(existing: ExistingMatcherEntry[], managed: MatcherEntry[]): ExistingMatcherEntry[] {
  const managedByMatcher = new Map<string | undefined, MatcherEntry>();
  for (const entry of managed) {
    managedByMatcher.set(entry.matcher, entry);
  }

  const appended = new Set<string | undefined>();
  const mergedExisting = existing.map((entry) => {
    const { matcher } = entry;
    const managedMatch = managedByMatcher.get(matcher);
    if (managedMatch && !appended.has(matcher)) {
      appended.add(matcher);
      return {
        ...entry,
        hooks: [...entry.hooks, ...managedMatch.hooks],
      };
    }
    return entry;
  });
  const unmatchedManaged = managed.filter((entry) => !appended.has(entry.matcher));

  return [...mergedExisting, ...unmatchedManaged];
}

export function mergeHooksIntoSettings(options: MergeOptions): Record<string, unknown> {
  const { existingSettings, bundledFiles, managedCommandPrefix, projectRoot } = options;
  const newHookEntries = buildHookEntries(bundledFiles, projectRoot);
  const existingHooks = (existingSettings.hooks ?? {}) as Record<string, ExistingMatcherEntry[]>;
  const cleaned = stripManagedFromExisting(existingHooks, managedCommandPrefix);

  const allEvents = [...new Set([...Object.keys(cleaned), ...Object.keys(newHookEntries)])];

  const hooks = Object.fromEntries(
    allEvents.map((event) => [event, mergeByMatcher(cleaned[event] ?? [], newHookEntries[event] ?? [])]),
  );

  return {
    ...existingSettings,
    hooks,
  };
}
