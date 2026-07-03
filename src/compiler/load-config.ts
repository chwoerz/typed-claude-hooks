import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";
import type { HookEvent } from "../types/index.js";
import type { TypedHandler } from "../types/mapping.js";

export interface LoadedConfig {
  handlerExports: Record<string, TypedHandler<HookEvent>>;
}

function isHandler(value: unknown): value is TypedHandler<HookEvent> {
  return (
    value != null &&
    typeof value === "object" &&
    "event" in (value as object) &&
    "handler" in (value as object)
  );
}

function validateNoDuplicateExports(
  handlerExports: Record<string, TypedHandler<HookEvent>>,
): void {
  const seen = new Set<TypedHandler<HookEvent>>();
  for (const [name, handler] of Object.entries(handlerExports)) {
    if (seen.has(handler)) {
      throw new Error(
        `Same handler instance exported multiple times (at least "${name}")`,
      );
    }
    seen.add(handler);
  }
}

export async function loadConfig(configPath: string): Promise<LoadedConfig> {
  const absPath = resolve(configPath);
  const tmpDir = resolve(
    dirname(absPath),
    `.typed-claude-hooks-tmp-${randomUUID().slice(0, 8)}`,
  );
  const tmpFile = resolve(tmpDir, "config.mjs");

  try {
    mkdirSync(tmpDir, { recursive: true });

    await esbuild.build({
      entryPoints: [absPath],
      bundle: true,
      format: "esm",
      platform: "node",
      outfile: tmpFile,
      packages: "external",
    });

    const mod = await import(pathToFileURL(tmpFile).href);

    const handlerExports = Object.fromEntries(
      Object.entries(mod).filter(
        ([key, value]) => key !== "default" && isHandler(value),
      ),
    ) as Record<string, TypedHandler<HookEvent>>;

    if (Object.keys(handlerExports).length === 0) {
      throw new Error(
        "Config file has no exported handlers. " +
          "Add: export const myHandler = defineHandler(...)",
      );
    }

    validateNoDuplicateExports(handlerExports);

    return { handlerExports };
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}
