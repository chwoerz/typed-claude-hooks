import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SDK_PATH = resolve(
  __dirname,
  "../../node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts",
);
const MAPPING_PATH = resolve(__dirname, "../../src/types/mapping.ts");

// Properties we set automatically — not user-configurable.
const AUTO_SET_PROPERTIES = new Set(["type", "command", "args"]);

function getSDKCommandHookKeys(): string[] {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const file = project.addSourceFileAtPath(SDK_PATH);

  const settingsInterface = file.getInterfaceOrThrow("Settings");
  const hooksProp = settingsInterface.getPropertyOrThrow("hooks");
  const hooksType = hooksProp.getType();

  // hooks is: { [k: string]: { matcher?; hooks: (CommandHook | PromptHook)[] }[] }
  // Navigate: NonNullable<hooks> → index signature value → array element → .hooks property → array element
  const nonNullable = hooksType.getNonNullableType();
  const indexType = nonNullable.getStringIndexType()!;
  const matcherEntry = indexType.getArrayElementTypeOrThrow();
  const hooksArrayProp = matcherEntry.getPropertyOrThrow("hooks");
  const hookUnion = hooksArrayProp
    .getTypeAtLocation(hooksProp)
    .getArrayElementTypeOrThrow();

  // Extract the { type: 'command' } variant
  const commandType = hookUnion
    .getUnionTypes()
    .find((t) =>
      t
        .getProperties()
        .some(
          (p) =>
            p.getName() === "type" &&
            p.getTypeAtLocation(hooksProp).isStringLiteral(),
        ),
    )!;

  return commandType
    .getProperties()
    .map((p) => p.getName())
    .filter((name) => !AUTO_SET_PROPERTIES.has(name));
}

function getHandlerOptionsKeys(): string[] {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const file = project.addSourceFileAtPath(MAPPING_PATH);

  const iface = file.getInterfaceOrThrow("HandlerOptions");
  return iface
    .getProperties()
    .map((p) => p.getName())
    .filter((name) => name !== "matcher");
}

describe("SDK drift detection", () => {
  it("HandlerOptions covers every SDK command hook property", () => {
    const sdkKeys = getSDKCommandHookKeys().sort();
    const ourKeys = getHandlerOptionsKeys().sort();

    expect(ourKeys).toEqual(sdkKeys);
  });
});
