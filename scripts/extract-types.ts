import { Project, SyntaxKind } from "ts-morph";
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PREFIX = "../node_modules/@anthropic-ai/claude-agent-sdk";
const SDK_PATH = resolve(__dirname, PREFIX, "sdk.d.ts");
const SDK_TOOLS_PATH = resolve(__dirname, PREFIX, "sdk-tools.d.ts");
const HOOKS_OUTPUT = resolve(__dirname, "../src/types/generated/hooks.ts");
const TOOL_INPUTS_OUTPUT = resolve(
  __dirname,
  "../src/types/generated/tool-inputs.ts",
);

const project = new Project({ skipAddingFilesFromTsConfig: true });

// --- Hook types from sdk.d.ts ---

const HOOK_PATTERNS: RegExp[] = [
  /^BaseHookInput$/,
  /^HookEvent$/,
  /^HookInput$/,
  /^HookJSONOutput$/,
  /^SyncHookJSONOutput$/,
  /^AsyncHookJSONOutput$/,
  /^HookPermissionDecision$/,
  /^BackgroundTaskSummary$/,
  /^SessionCronSummary$/,
  /^SDKAssistantMessageError$/,
  /^ExitReason$/,
  /^Permission\w+$/,
  /^PostToolBatchToolCall$/,
  /^.+HookInput$/,
  /^.+HookSpecificOutput$/,
];

function matchesHookPattern(name: string): boolean {
  return HOOK_PATTERNS.some((p) => p.test(name));
}

const sdkFile = project.addSourceFileAtPath(SDK_PATH);
const hookDeclarations: string[] = [];

for (const stmt of sdkFile.getStatements()) {
  const name =
    stmt.isKind(SyntaxKind.InterfaceDeclaration) ||
    stmt.isKind(SyntaxKind.TypeAliasDeclaration)
      ? stmt.getName()
      : undefined;

  if (name && matchesHookPattern(name)) {
    const text = stmt
      .getText()
      .replace(/^export declare /gm, "export ")
      .replace(/^declare /gm, "");
    hookDeclarations.push(text);
  }
}

const hooksHeader = `// Auto-extracted from @anthropic-ai/claude-agent-sdk sdk.d.ts
// Do not edit manually — regenerate with: npm run extract-types
`;

writeFileSync(
  HOOKS_OUTPUT,
  hooksHeader + "\n" + hookDeclarations.join("\n\n") + "\n",
);
console.log(
  `Extracted ${hookDeclarations.length} hook declarations → ${HOOKS_OUTPUT}`,
);

// --- Tool input types from sdk-tools.d.ts ---

const TOOL_INPUT_MAP: Record<string, string> = {
  Bash: "BashInput",
  Read: "FileReadInput",
  Write: "FileWriteInput",
  Edit: "FileEditInput",
  Glob: "GlobInput",
  Grep: "GrepInput",
  WebFetch: "WebFetchInput",
  WebSearch: "WebSearchInput",
  Agent: "AgentInput",
};

const toolInputNames = new Set(Object.values(TOOL_INPUT_MAP));
const toolsFile = project.addSourceFileAtPath(SDK_TOOLS_PATH);
const toolDeclarations: string[] = [];

for (const stmt of toolsFile.getStatements()) {
  const name =
    stmt.isKind(SyntaxKind.InterfaceDeclaration) ||
    stmt.isKind(SyntaxKind.TypeAliasDeclaration)
      ? stmt.getName()
      : undefined;

  if (name && toolInputNames.has(name)) {
    toolDeclarations.push(stmt.getText());
  }
}

const toolMapEntries = Object.entries(TOOL_INPUT_MAP)
  .map(([toolName, typeName]) => `  ${toolName}: ${typeName};`)
  .join("\n");

const toolOutput = `// Auto-extracted from @anthropic-ai/claude-agent-sdk sdk-tools.d.ts
// Do not edit manually — regenerate with: npm run extract-types

${toolDeclarations.join("\n\n")}

export interface ToolInputMap {
${toolMapEntries}
}

export type BuiltinToolName = keyof ToolInputMap;
`;

writeFileSync(TOOL_INPUTS_OUTPUT, toolOutput);
console.log(
  `Extracted ${toolDeclarations.length} tool input types → ${TOOL_INPUTS_OUTPUT}`,
);
