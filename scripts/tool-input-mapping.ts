import { type SourceFile, SyntaxKind } from "ts-morph";

// SDK declaration names normally match tool names after removing "Input".
const TOOL_INPUT_ALIASES: Record<string, string> = {
  FileEditInput: "Edit",
  FileReadInput: "Read",
  FileWriteInput: "Write",
};

export function mapToolInputNames(names: string[]): [string, string][] {
  const entries = names
    .map((typeName): [string, string] => [TOOL_INPUT_ALIASES[typeName] ?? typeName.slice(0, -"Input".length), typeName])
    .sort(([leftName, leftType], [rightName, rightType]) => {
      const left = `${leftName}\0${leftType}`;
      const right = `${rightName}\0${rightType}`;
      return left < right ? -1 : left > right ? 1 : 0;
    });

  entries.forEach(([toolName, typeName], index) => {
    const previous = entries[index - 1];
    if (previous?.[0] === toolName) {
      throw new Error(`Tool name "${toolName}" maps to both ${previous[1]} and ${typeName}`);
    }
  });

  return entries;
}

export function generateToolInputs(toolsFile: SourceFile): string {
  const declarationsByName = new Map(
    toolsFile
      .getStatements()
      .filter(
        (statement) =>
          statement.isExported() &&
          (statement.isKind(SyntaxKind.InterfaceDeclaration) || statement.isKind(SyntaxKind.TypeAliasDeclaration)) &&
          statement.getName().endsWith("Input"),
      )
      .map((declaration) => [declaration.getName(), declaration.getText()]),
  );
  const toolInputMap = mapToolInputNames([...declarationsByName.keys()]);
  const toolDeclarations = toolInputMap.map(([, typeName]) => declarationsByName.get(typeName));
  const toolMapEntries = toolInputMap.map(([toolName, typeName]) => `  ${toolName}: ${typeName};`).join("\n");

  return `// Auto-extracted from @anthropic-ai/claude-agent-sdk sdk-tools.d.ts
// Do not edit manually — regenerate with: npm run extract-types

${toolDeclarations.join("\n\n")}

export interface ToolInputMap {
${toolMapEntries}
}

export type BuiltinToolName = keyof ToolInputMap;
`;
}
