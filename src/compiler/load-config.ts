import { resolve } from "node:path";
import * as esbuild from "esbuild";
import type { HookEvent } from "../types/index.js";
import type { TypedHandler } from "../types/mapping.js";
import { HOOK_EVENTS } from "./hook-events.js";

export interface LoadedConfig {
  handlerExports: Record<string, TypedHandler<HookEvent>>;
}

const PORTABLE_ARTIFACT_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

function isObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function isHookEvent(value: unknown): value is HookEvent {
  return typeof value === "string" && Object.hasOwn(HOOK_EVENTS, value);
}

function isHandlerCandidate(value: unknown): boolean {
  return isObject(value) && (Object.hasOwn(value, "event") || Object.hasOwn(value, "handler"));
}

function validateHandler(value: unknown): value is TypedHandler<HookEvent> {
  if (!isObject(value)) return false;
  if (!Object.hasOwn(value, "event") || !Object.hasOwn(value, "handler")) {
    return false;
  }

  const validators: Record<string, (option: unknown) => boolean> = {
    event: isHookEvent,
    handler: (option) => typeof option === "function",
    matcher: (option) => typeof option === "string",
    timeout: (option) => typeof option === "number" && Number.isFinite(option),
    if: (option) => typeof option === "string",
    shell: (option) => option === "bash" || option === "powershell",
    statusMessage: (option) => typeof option === "string",
    once: (option) => typeof option === "boolean",
    async: (option) => typeof option === "boolean",
    asyncRewake: (option) => typeof option === "boolean",
  };
  const unknownOption = Object.keys(value).find((key) => !Object.hasOwn(validators, key));
  if (unknownOption) throw new Error(`Unknown handler option: ${unknownOption}`);

  const invalidOption = Object.entries(value).find(([key, option]) => !validators[key](option));
  if (invalidOption) {
    throw new Error(`Invalid handler option: ${invalidOption[0]}`);
  }
  return true;
}

function validateNoDuplicates(handlers: Record<string, TypedHandler<HookEvent>>): void {
  const seen = new Set<TypedHandler<HookEvent>>();
  Object.entries(handlers).forEach(([name, handler]) => {
    if (seen.has(handler)) {
      throw new Error(`Same handler instance exported multiple times (at least "${name}")`);
    }
    seen.add(handler);
  });
}

function validateHandlerNames(entries: [string, unknown][]): void {
  const unsafeName = entries.find(([name]) => !PORTABLE_ARTIFACT_NAME.test(name));
  if (unsafeName) {
    throw new Error(`Handler export name ${JSON.stringify(unsafeName[0])} must be a portable artifact name`);
  }

  const reservedName = entries.find(([name]) => WINDOWS_RESERVED_NAME.test(name));
  if (reservedName) {
    throw new Error(`Handler export name ${JSON.stringify(reservedName[0])} is reserved on Windows`);
  }

  const seen = new Set<string>();
  const collidingName = entries.find(([name]) => {
    const normalizedName = name.toLowerCase();
    if (seen.has(normalizedName)) return true;
    seen.add(normalizedName);
    return false;
  });
  if (collidingName) {
    throw new Error(
      `Handler export names must be unique in case-insensitive filesystems (at least ${JSON.stringify(collidingName[0])})`,
    );
  }
}

export async function loadConfig(configPath: string): Promise<LoadedConfig> {
  const absConfigPath = resolve(configPath);
  const result = await esbuild.build({
    entryPoints: [absConfigPath],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
  });
  const output = result.outputFiles[0];
  if (!output) throw new Error("Config build produced no output");

  const dataUrl = `data:text/javascript;base64,${Buffer.from(output.contents).toString("base64")}`;
  const moduleExports = (await import(dataUrl)) as Record<string, unknown>;
  const namedEntries = Object.entries(moduleExports).filter(([name]) => name !== "default");
  const invalidEntry = namedEntries.find(([, value]) => isHandlerCandidate(value) && !validateHandler(value));
  if (invalidEntry) {
    throw new Error(`Invalid handler export ${JSON.stringify(invalidEntry[0])}`);
  }

  const handlerEntries = namedEntries.filter(([, value]) => validateHandler(value));
  if (handlerEntries.length === 0) {
    throw new Error("Config file has no named handlers");
  }
  validateHandlerNames(handlerEntries);
  const handlerExports = Object.fromEntries(handlerEntries) as Record<string, TypedHandler<HookEvent>>;
  validateNoDuplicates(handlerExports);
  return { handlerExports };
}
