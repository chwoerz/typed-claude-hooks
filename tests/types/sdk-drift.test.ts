import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Project, SyntaxKind } from "ts-morph";
import { describe, expect, it } from "vitest";
import {
  generateToolInputs,
  mapToolInputNames,
} from "../../scripts/tool-input-mapping.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SDK_PATH = resolve(
  __dirname,
  "../../node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts",
);
const MAPPING_PATH = resolve(__dirname, "../../src/types/mapping.ts");
const TOOL_INPUTS_PATH = resolve(
  __dirname,
  "../../src/types/generated/tool-inputs.ts",
);
const SDK_TOOLS_PATH = resolve(
  __dirname,
  "../../node_modules/@anthropic-ai/claude-agent-sdk/sdk-tools.d.ts",
);

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
  const indexType = nonNullable.getStringIndexType();
  if (!indexType) {
    throw new Error("SDK Settings hooks type has no string index");
  }
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
    );
  if (!commandType) {
    throw new Error("SDK Settings hooks type has no command hook variant");
  }

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

  it("extracts and maps every exported SDK tool input declaration", () => {
    const project = new Project({ skipAddingFilesFromTsConfig: true });
    const sdkFile = project.addSourceFileAtPath(SDK_TOOLS_PATH);
    const generatedFile = project.addSourceFileAtPath(TOOL_INPUTS_PATH);
    const sdkNames = sdkFile
      .getStatements()
      .filter(
        (statement) =>
          statement.isExported() &&
          (statement.isKind(SyntaxKind.InterfaceDeclaration) ||
            statement.isKind(SyntaxKind.TypeAliasDeclaration)),
      )
      .map((statement) => statement.getName())
      .filter((name) => name.endsWith("Input"))
      .sort();
    const generatedNames = generatedFile
      .getStatements()
      .filter(
        (statement) =>
          statement.isKind(SyntaxKind.InterfaceDeclaration) ||
          statement.isKind(SyntaxKind.TypeAliasDeclaration),
      )
      .map((statement) => statement.getName())
      .filter((name) => name.endsWith("Input"))
      .sort();
    const mappedTypeNames = generatedFile
      .getInterfaceOrThrow("ToolInputMap")
      .getProperties()
      .map((property) => property.getTypeNodeOrThrow().getText())
      .sort();

    expect(generatedNames).toEqual(sdkNames);
    expect(mappedTypeNames).toEqual(generatedNames);
  });

  it("keeps generated tool input content current", () => {
    const project = new Project({ skipAddingFilesFromTsConfig: true });
    const sdkFile = project.addSourceFileAtPath(SDK_TOOLS_PATH);

    expect(readFileSync(TOOL_INPUTS_PATH, "utf8")).toBe(
      generateToolInputs(sdkFile),
    );
  });

  it("maps tool names deterministically with file aliases", () => {
    expect(
      mapToolInputNames(["WebFetchInput", "FileReadInput", "BashInput"]),
    ).toEqual([
      ["Bash", "BashInput"],
      ["Read", "FileReadInput"],
      ["WebFetch", "WebFetchInput"],
    ]);
  });

  it("rejects duplicate mapped tool names", () => {
    expect(() => mapToolInputNames(["FileReadInput", "ReadInput"])).toThrow(
      'Tool name "Read" maps to both FileReadInput and ReadInput',
    );
  });
});
