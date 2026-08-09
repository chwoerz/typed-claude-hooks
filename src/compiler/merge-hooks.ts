import { buildHookEntries, type MatcherEntry, type PlannedArtifactPaths } from "./artifact-plan.js";
import { HOOK_EVENTS } from "./hook-events.js";

interface ExistingHookEntry {
  command?: string;
}

interface ExistingMatcherEntry {
  matcher?: string;
  hooks: ExistingHookEntry[];
}

export interface MergeOptions {
  existingSettings: Record<string, unknown>;
  bundledFiles: PlannedArtifactPaths[];
  projectRoot: string;
}

const HOOK_EVENT_PATTERN = Object.keys(HOOK_EVENTS).join("|");
const GENERATED_HOOK_PATH = String.raw`\$\{CLAUDE_PROJECT_DIR\}/(?:[^/"\r\n]+/)*typed-claude-hooks/(?:${HOOK_EVENT_PATTERN})/[^/"\r\n]+`;
const QUOTED_GENERATED_HOOK = new RegExp(`^"${GENERATED_HOOK_PATH}\\.(?:ps1|sh)"$`);
const LEGACY_GENERATED_BASH_HOOK = new RegExp(`^${GENERATED_HOOK_PATH}\\.sh$`);
const GENERATED_POWERSHELL_HOOK = new RegExp(`^& "${GENERATED_HOOK_PATH}\\.ps1"$`);

function isManagedHook(hook: ExistingHookEntry): boolean {
  const { command } = hook;
  return (
    typeof command === "string" &&
    (QUOTED_GENERATED_HOOK.test(command) ||
      LEGACY_GENERATED_BASH_HOOK.test(command) ||
      GENERATED_POWERSHELL_HOOK.test(command))
  );
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
  const { existingSettings, bundledFiles, projectRoot } = options;
  const newHookEntries = buildHookEntries(bundledFiles, projectRoot);
  const existingHooks = (existingSettings.hooks ?? {}) as Record<string, ExistingMatcherEntry[]>;
  const cleaned = stripManagedFromExisting(existingHooks);

  const allEvents = [...new Set([...Object.keys(cleaned), ...Object.keys(newHookEntries)])];

  const hooks = Object.fromEntries(
    allEvents.map((event) => [event, mergeByMatcher(cleaned[event] ?? [], newHookEntries[event] ?? [])]),
  );

  return {
    ...existingSettings,
    hooks,
  };
}
