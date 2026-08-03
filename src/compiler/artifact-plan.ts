import type { HandlerOptions, Runtime } from "../types/mapping.js";
import { clearUndefineds } from "../utils.js";
import type { HandlerEntry } from "./extract-handlers.js";
import { generateBashWrapper, generatePowerShellWrapper } from "./wrapper-template.js";

export interface WrapperArtifact {
  contents: string;
  filePath: string;
}

export interface PlannedArtifact extends HandlerOptions {
  contents: string;
  event: string;
  fileName: string;
  filePath: string;
  name: string;
  runtime: Runtime;
  wrapper: WrapperArtifact;
}

export type PlannedArtifactPaths = Omit<PlannedArtifact, "contents">;

export interface HookCommandEntry extends Omit<HandlerOptions, "matcher"> {
  type: "command";
  command: string;
}

export interface MatcherEntry {
  matcher?: string;
  hooks: HookCommandEntry[];
}

function normalizePath(filePath: string): string {
  return filePath.replaceAll("\\", "/").replace(/\/$/, "");
}

function joinPath(...parts: string[]): string {
  const separator = parts[0].includes("\\") ? "\\" : "/";
  return parts
    .map((part, index) => {
      const normalized = part.replaceAll(/[\\/]/g, separator).replace(/[\\/]$/, "");
      return index === 0 ? normalized : normalized.replace(/^[\\/]/, "");
    })
    .join(separator);
}

function fileNameFromPath(filePath: string): string {
  return normalizePath(filePath).split("/").at(-1) ?? "";
}

function relativePath(from: string, to: string): string {
  if (from === "" || from === ".") return normalizePath(to).replace(/^\.\//, "");
  const normalizedFrom = normalizePath(from);
  const normalizedTo = normalizePath(to);
  const fromUncRoot = uncRoot(normalizedFrom);
  const toUncRoot = uncRoot(normalizedTo);
  const uncPath = fromUncRoot !== undefined || toUncRoot !== undefined;
  if (uncPath && fromUncRoot?.toLowerCase() !== toUncRoot?.toLowerCase()) {
    throw new Error(
      `Cannot create a project-relative hook command across different UNC roots (${fromUncRoot ?? "no UNC root"} and ${toUncRoot ?? "no UNC root"})`,
    );
  }
  const fromParts = normalizedFrom.split("/");
  const toParts = normalizedTo.split("/");
  const fromDrive = windowsDrive(fromParts[0]);
  const toDrive = windowsDrive(toParts[0]);
  const windowsPath = uncPath || fromDrive !== undefined || toDrive !== undefined;
  if (windowsPath && fromDrive?.toLowerCase() !== toDrive?.toLowerCase()) {
    throw new Error(
      `Cannot create a project-relative hook command across different drives (${fromDrive ?? "no drive"} and ${toDrive ?? "no drive"})`,
    );
  }
  const commonLength = fromParts.findIndex((part, index) => {
    const targetPart = toParts[index];
    return windowsPath ? part.toLowerCase() !== targetPart?.toLowerCase() : part !== targetPart;
  });
  const sharedParts = commonLength === -1 ? Math.min(fromParts.length, toParts.length) : commonLength;
  return [...fromParts.slice(sharedParts).map(() => ".."), ...toParts.slice(sharedParts)].join("/");
}

function windowsDrive(firstPathPart: string): string | undefined {
  return /^[A-Za-z]:$/.test(firstPathPart) ? firstPathPart : undefined;
}

function uncRoot(filePath: string): string | undefined {
  const match = filePath.match(/^\/\/([^/]+)\/([^/]+)(?:\/|$)/);
  return match ? `//${match[1]}/${match[2]}` : undefined;
}

export function createWrapperArtifact(handler: HandlerEntry, mjsPath: string, runtime: Runtime): WrapperArtifact {
  const isPowerShell = handler.shell === "powershell";
  const contents = isPowerShell
    ? generatePowerShellWrapper(fileNameFromPath(mjsPath), runtime)
    : generateBashWrapper(fileNameFromPath(mjsPath), runtime);
  return {
    contents,
    filePath: mjsPath.replace(/\.mjs$/, isPowerShell ? ".ps1" : ".sh"),
  };
}

export function planArtifactPaths(handler: HandlerEntry, hooksRoot: string, runtime: Runtime): PlannedArtifactPaths {
  const { name, event, ...handlerOptions } = handler;
  const fileName = `${name}.mjs`;
  const filePath = joinPath(hooksRoot, event, fileName);
  return {
    ...handlerOptions,
    event,
    fileName,
    filePath,
    name,
    runtime,
    wrapper: createWrapperArtifact(handler, filePath, runtime),
  };
}

function createHookCommandEntry(artifact: PlannedArtifactPaths, projectRoot: string): HookCommandEntry {
  const { async, asyncRewake, if: condition, once, shell, statusMessage, timeout, wrapper } = artifact;
  const hookOptions: Omit<HandlerOptions, "matcher"> = clearUndefineds({
    async,
    asyncRewake,
    if: condition,
    once,
    shell,
    statusMessage,
    timeout,
  });
  const relativeCommandPath = `\${CLAUDE_PROJECT_DIR}/${relativePath(projectRoot, wrapper.filePath)}`;
  const command = `"${relativeCommandPath}"`;
  return clearUndefineds({
    type: "command" as const,
    command: artifact.shell === "powershell" ? `& ${command}` : command,
    ...hookOptions,
  });
}

export function buildHookEntries(
  artifacts: PlannedArtifactPaths[],
  projectRoot: string,
): Record<string, MatcherEntry[]> {
  const byEvent = Map.groupBy(artifacts, (artifact) => artifact.event);
  return Object.fromEntries(
    [...byEvent.entries()].map(([event, eventArtifacts]) => {
      const byMatcher = Map.groupBy(eventArtifacts, (artifact) => artifact.matcher);
      const matchers = [...byMatcher.entries()].map(([matcher, matcherArtifacts]) => ({
        ...(matcher !== undefined ? { matcher } : {}),
        hooks: matcherArtifacts.map((artifact) => createHookCommandEntry(artifact, projectRoot)),
      }));
      return [event, matchers];
    }),
  );
}

export function createSettingsSnippet(
  artifacts: PlannedArtifactPaths[],
  projectRoot: string,
): { hooks: Record<string, MatcherEntry[]> } {
  return { hooks: buildHookEntries(artifacts, projectRoot) };
}
