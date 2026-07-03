import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve } from "node:path";
import {
  type BundledFile,
  bundleHandlers,
  type Runtime,
} from "../compiler/bundle-handlers.js";
import { extractHandlers } from "../compiler/extract-handlers.js";
import { loadConfig } from "../compiler/load-config.js";
import { mergeHooksIntoSettings } from "../compiler/merge-hooks.js";

const MANAGED_SUBDIR = "typed-claude-hooks";

function removeStaleFiles(
  managedDir: string,
  bundledFiles: BundledFile[],
): number {
  if (!existsSync(managedDir)) return 0;

  const expectedPaths = new Set(
    bundledFiles.flatMap((f) => [
      resolve(managedDir, f.event, f.fileName),
      resolve(managedDir, f.event, f.fileName.replace(/\.mjs$/, ".sh")),
    ]),
  );

  let removedCount = 0;

  for (const entry of readdirSync(managedDir, { withFileTypes: true })) {
    const fullPath = resolve(managedDir, entry.name);

    if (
      entry.isFile() &&
      (entry.name.endsWith(".mjs") || entry.name.endsWith(".sh"))
    ) {
      unlinkSync(fullPath);
      removedCount++;
      continue;
    }

    if (!entry.isDirectory()) continue;

    for (const fileEntry of readdirSync(fullPath, { withFileTypes: true })) {
      if (!fileEntry.isFile()) continue;
      if (!fileEntry.name.endsWith(".mjs") && !fileEntry.name.endsWith(".sh"))
        continue;

      const filePath = resolve(fullPath, fileEntry.name);
      if (!expectedPaths.has(filePath)) {
        unlinkSync(filePath);
        removedCount++;
      }
    }

    if (readdirSync(fullPath).length === 0) {
      rmSync(fullPath, { recursive: true });
    }
  }

  return removedCount;
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
  let existingSettings: Record<string, unknown> = {};
  if (existsSync(settingsPath)) {
    try {
      existingSettings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    } catch {
      throw new Error(`Failed to parse ${settingsPath} — is it valid JSON?`);
    }
  }
  return existingSettings;
}

export async function build(options: BuildOptions): Promise<void> {
  const configPath = resolve(options.config);
  const settingsPath = resolve(options.output);
  const hooksDir = options.hooksDir
    ? resolve(options.hooksDir)
    : resolve(dirname(settingsPath), "hooks");
  const managedDir = resolve(hooksDir, MANAGED_SUBDIR);

  if (options.clean && existsSync(managedDir)) {
    rmSync(managedDir, { recursive: true, force: true });
  }

  const loaded = await loadConfig(configPath);
  const handlers = extractHandlers(loaded);

  if (handlers.length === 0) {
    console.log("No handlers found in config.");
    return;
  }

  const bundledFiles = await bundleHandlers({
    configPath,
    handlers,
    hooksDir: managedDir,
    runtime: options.runtime ?? "node",
  });

  const removedCount = removeStaleFiles(managedDir, bundledFiles);

  const existingSettings = loadExistingSettings(settingsPath);

  const merged = mergeHooksIntoSettings({
    existingSettings,
    bundledFiles,
    projectRoot: process.cwd(),
  });

  if (options.dryRun) {
    console.log("Dry run — would write:");
    console.log(JSON.stringify(merged, null, 2));
    return;
  }

  mkdirSync(dirname(settingsPath), { recursive: true });
  writeFileSync(settingsPath, `${JSON.stringify(merged, null, 2)}\n`);

  printBuildSummary(bundledFiles, settingsPath, removedCount);
}

function printBuildSummary(
  bundledFiles: BundledFile[],
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
