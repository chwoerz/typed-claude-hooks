import { randomUUID } from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, relative, resolve, sep } from "node:path";
import {
  bundleHandlers,
  type PlannedArtifact,
} from "../compiler/bundle-handlers.js";
import { extractHandlers } from "../compiler/extract-handlers.js";
import { loadConfig } from "../compiler/load-config.js";
import { mergeHooksIntoSettings } from "../compiler/merge-hooks.js";
import type { Runtime } from "../types/mapping.js";

const MANAGED_SUBDIR = "typed-claude-hooks";

interface PlannedWrite {
  contents: string;
  filePath: string;
  mode?: number;
}

interface BuildPlan {
  artifacts: PlannedArtifact[];
  managedDir: string;
  removals: string[];
  settingsPath: string;
  settingsContents: string;
  writes: PlannedWrite[];
}

function lstatIfExists(filePath: string) {
  try {
    return lstatSync(filePath);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function listUnexpectedEntries(
  managedDir: string,
  bundledFiles: PlannedArtifact[],
): string[] {
  const managedStats = lstatIfExists(managedDir);
  if (!managedStats) return [];
  if (!managedStats.isDirectory() || managedStats.isSymbolicLink()) {
    return [managedDir];
  }

  const expectedFiles = bundledFiles.flatMap((file) => [
    file.filePath,
    file.wrapper.filePath,
  ]);
  const expectedFilePaths = new Set(expectedFiles);
  const expectedDirectories = new Set([
    managedDir,
    ...expectedFiles.map(dirname),
  ]);

  const visit = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const entryPath = resolve(directory, entry.name);
      const stats = lstatSync(entryPath);
      if (expectedFilePaths.has(entryPath)) {
        return stats.isFile() ? [] : [entryPath];
      }
      if (
        !expectedDirectories.has(entryPath) ||
        !stats.isDirectory() ||
        stats.isSymbolicLink()
      ) {
        return [entryPath];
      }
      return visit(entryPath);
    });

  return visit(managedDir);
}

function planWrite(
  filePath: string,
  contents: string,
  mode?: number,
): PlannedWrite | null {
  const stats = lstatIfExists(filePath);
  const isFile = stats?.isFile() === true;
  const writeContents =
    !isFile || !readFileSync(filePath).equals(Buffer.from(contents));
  const changeMode =
    mode !== undefined && (!stats || (stats.mode & 0o777) !== mode);
  return writeContents || changeMode ? { contents, filePath, mode } : null;
}

function removePath(filePath: string): void {
  const stats = lstatIfExists(filePath);
  if (!stats) return;
  if (stats.isDirectory() && !stats.isSymbolicLink()) {
    rmSync(filePath, { recursive: true, force: true });
  } else {
    unlinkSync(filePath);
  }
}

function containsPath(parent: string, child: string): boolean {
  const pathFromParent = relative(parent, child);
  return (
    pathFromParent === "" ||
    (pathFromParent !== ".." && !pathFromParent.startsWith(`..${sep}`))
  );
}

function applyPlan(plan: BuildPlan): void {
  const token = `${process.pid}-${randomUUID()}`;
  const artifactStageDir = resolve(
    dirname(plan.managedDir),
    `.${basename(plan.managedDir)}-${token}.tmp`,
  );
  const stagedWrites = plan.writes.map((write) => ({
    ...write,
    stagedPath:
      write.filePath === plan.settingsPath
        ? `${write.filePath}.${token}.tmp`
        : resolve(artifactStageDir, relative(plan.managedDir, write.filePath)),
  }));

  try {
    stagedWrites.forEach(({ contents, mode, stagedPath }) => {
      mkdirSync(dirname(stagedPath), { recursive: true });
      writeFileSync(stagedPath, contents);
      if (mode !== undefined) {
        chmodSync(stagedPath, mode);
      }
    });

    const blockers = plan.removals.filter((removal) =>
      stagedWrites.some(({ filePath }) => containsPath(removal, filePath)),
    );
    blockers.forEach(removePath);

    stagedWrites.forEach(({ filePath, stagedPath }) => {
      mkdirSync(dirname(filePath), { recursive: true });
      renameSync(stagedPath, filePath);
    });

    plan.removals
      .filter((removal) => !blockers.includes(removal))
      .forEach(removePath);
  } finally {
    rmSync(artifactStageDir, { recursive: true, force: true });
    stagedWrites.forEach(({ stagedPath }) => {
      if (stagedPath !== artifactStageDir) {
        rmSync(stagedPath, { recursive: true, force: true });
      }
    });
  }
}

export interface BuildOptions {
  config: string;
  output: string;
  hooksDir?: string;
  dryRun?: boolean;
  clean?: boolean;
  runtime?: Runtime;
}

function loadExistingSettings(settingsPath: string) {
  if (!existsSync(settingsPath)) return {};
  try {
    return JSON.parse(readFileSync(settingsPath, "utf-8")) as Record<
      string,
      unknown
    >;
  } catch {
    throw new Error(`Failed to parse ${settingsPath} — is it valid JSON?`);
  }
}

async function createBuildPlan(
  options: BuildOptions,
): Promise<BuildPlan | null> {
  const { config, output, hooksDir: hooksDirOption } = options;
  const configPath = resolve(config);
  const settingsPath = resolve(output);
  const hooksDir = hooksDirOption
    ? resolve(hooksDirOption)
    : resolve(dirname(settingsPath), "hooks");
  const managedDir = resolve(hooksDir, MANAGED_SUBDIR);
  const managedCommandPrefix = `\${CLAUDE_PROJECT_DIR}/${relative(
    process.cwd(),
    managedDir,
  ).replaceAll("\\", "/")}/`;

  const loaded = await loadConfig(configPath);
  const handlers = extractHandlers(loaded);

  if (handlers.length === 0) {
    console.log("No handlers found in config.");
    return null;
  }

  const bundledFiles = await bundleHandlers({
    configPath,
    handlers,
    hooksDir: managedDir,
    runtime: options.runtime ?? "node",
  });

  const existingSettings = loadExistingSettings(settingsPath);

  const merged = mergeHooksIntoSettings({
    existingSettings,
    bundledFiles,
    managedCommandPrefix,
    projectRoot: process.cwd(),
  });

  const artifactWrites = bundledFiles.flatMap((file): PlannedWrite[] => [
    { contents: file.contents, filePath: file.filePath },
    {
      contents: file.wrapper.contents,
      filePath: file.wrapper.filePath,
      mode: file.shell === "powershell" ? undefined : 0o755,
    },
  ]);
  const removals = options.clean
    ? lstatIfExists(managedDir)
      ? [managedDir]
      : []
    : listUnexpectedEntries(managedDir, bundledFiles);
  const writes = artifactWrites
    .map(({ contents, filePath, mode }) => {
      const blocked = removals.some((removal) =>
        containsPath(removal, filePath),
      );
      return options.clean || blocked
        ? { contents, filePath, mode }
        : planWrite(filePath, contents, mode);
    })
    .filter((write): write is PlannedWrite => write !== null);
  const settingsContents = `${JSON.stringify(merged, null, 2)}\n`;
  const settingsWrite = planWrite(settingsPath, settingsContents);

  return {
    artifacts: bundledFiles,
    managedDir,
    removals,
    settingsContents,
    settingsPath,
    writes: settingsWrite ? [...writes, settingsWrite] : writes,
  };
}

export async function build(options: BuildOptions): Promise<void> {
  const plan = await createBuildPlan(options);
  if (!plan) return;

  if (options.dryRun) {
    console.log("Dry run — would write:");
    console.log(plan.settingsContents.trimEnd());
    return;
  }

  applyPlan(plan);
  printBuildSummary(plan.artifacts, plan.settingsPath, plan.removals.length);
}

function printBuildSummary(
  bundledFiles: PlannedArtifact[],
  settingsPath: string,
  removedCount: number,
): void {
  const relSettingsPath = relative(process.cwd(), settingsPath);
  const byEvent = Map.groupBy(bundledFiles, (f) => f.event);

  console.log(`✓ Found ${bundledFiles.length} handler(s)`);
  console.log(`✓ Generated ${relSettingsPath}`);
  for (const [event, files] of byEvent) {
    const names = files.map((f) => f.name).join(", ");
    console.log(`  → ${event}: ${names}`);
  }
  if (removedCount) {
    console.log(`✓ Removed ${removedCount} stale hook(s)`);
  }
}
