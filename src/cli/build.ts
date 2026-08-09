import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import type { PlannedArtifact } from "../compiler/artifact-plan.js";
import { bundleHandlers } from "../compiler/bundle-handlers.js";
import { extractHandlers } from "../compiler/extract-handlers.js";
import { loadConfig } from "../compiler/load-config.js";
import { mergeHooksIntoSettings } from "../compiler/merge-hooks.js";
import { projectRelativeLogicalPath } from "../compiler/project-path.js";
import type { Runtime } from "../types/mapping.js";

const MANAGED_SUBDIR = "typed-claude-hooks";

export interface BuildOptions {
  config: string;
  output: string;
  hooksDir?: string;
  runtime?: Runtime;
}

function loadExistingSettings(settingsPath: string) {
  if (!existsSync(settingsPath)) return {};
  try {
    return JSON.parse(readFileSync(settingsPath, "utf-8")) as Record<string, unknown>;
  } catch {
    throw new Error(`Failed to parse ${settingsPath} — is it valid JSON?`);
  }
}

function removeManagedDir(managedDir: string): void {
  try {
    const stats = lstatSync(managedDir);
    if (stats.isDirectory() && !stats.isSymbolicLink()) {
      rmSync(managedDir, { recursive: true, force: true });
    } else {
      unlinkSync(managedDir);
    }
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }
}

function makeFileWrappersExecutable(bundledFiles: PlannedArtifact[]) {
  bundledFiles
    .filter((file) => file.shell !== "powershell")
    .forEach((file) => {
      chmodSync(file.wrapper.filePath, 0o755);
    });
}

export async function build(options: BuildOptions): Promise<void> {
  const { config, output, hooksDir: hooksDirOption } = options;
  const configPath = resolve(config);
  const settingsPath = resolve(output);
  const hooksDir = hooksDirOption ? resolve(hooksDirOption) : resolve(dirname(settingsPath), "hooks");
  const projectRoot = process.cwd();
  const managedDir = resolve(hooksDir, MANAGED_SUBDIR);

  const managedLogicalPath = projectRelativeLogicalPath(projectRoot, managedDir);
  if (/["\r\n]/.test(managedLogicalPath)) {
    throw new Error(
      `Generated hook command path cannot contain double quotes or line breaks: ${JSON.stringify(managedLogicalPath)}`,
    );
  }
  const loaded = await loadConfig(configPath);

  const handlers = extractHandlers(loaded);
  const runtime = options.runtime ?? "node";
  const bundledFiles = await bundleHandlers({
    configPath,
    handlers,
    hooksDir: managedDir,
    runtime,
  });
  const existingSettings = loadExistingSettings(settingsPath);
  const logicalBundledFiles = bundledFiles.map((file) => ({
    ...file,
    filePath: projectRelativeLogicalPath(projectRoot, file.filePath),
    wrapper: {
      ...file.wrapper,
      filePath: projectRelativeLogicalPath(projectRoot, file.wrapper.filePath),
    },
  }));
  const merged = mergeHooksIntoSettings({
    existingSettings,
    bundledFiles: logicalBundledFiles,
    projectRoot: ".",
  });
  const settingsContents = `${JSON.stringify(merged, null, 2)}\n`;

  removeManagedDir(managedDir);
  bundledFiles.forEach((file) => {
    mkdirSync(dirname(file.filePath), { recursive: true });
  });
  bundledFiles.forEach((file) => {
    writeArtifactFiles(file);
  });
  makeFileWrappersExecutable(bundledFiles);
  mkdirSync(dirname(settingsPath), { recursive: true });
  writeFileSync(settingsPath, settingsContents);

  printBuildSummary(bundledFiles, settingsPath);
}

function writeArtifactFiles(file: PlannedArtifact) {
  writeFileSync(file.filePath, file.contents);
  writeFileSync(file.wrapper.filePath, file.wrapper.contents);
}

function printBuildSummary(bundledFiles: PlannedArtifact[], settingsPath: string): void {
  const relSettingsPath = relative(process.cwd(), settingsPath);
  const byEvent = Map.groupBy(bundledFiles, (file) => file.event);

  console.log(`✓ Found ${bundledFiles.length} handler(s)`);
  console.log(`✓ Generated ${relSettingsPath}`);
  for (const [event, files] of byEvent) {
    console.log(`  → ${event}: ${files.map((file) => file.name).join(", ")}`);
  }
}
