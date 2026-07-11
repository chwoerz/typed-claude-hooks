import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Project, SyntaxKind } from "ts-morph";
import { generateToolInputs } from "./tool-input-mapping.ts";

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
  `${hooksHeader}\n${hookDeclarations.join("\n\n")}\n`,
);
console.log(
  `Extracted ${hookDeclarations.length} hook declarations → ${HOOKS_OUTPUT}`,
);

// --- Tool input types from sdk-tools.d.ts ---

const toolsFile = project.addSourceFileAtPath(SDK_TOOLS_PATH);
const toolOutput = generateToolInputs(toolsFile);

writeFileSync(TOOL_INPUTS_OUTPUT, toolOutput);
console.log(
  `Extracted ${toolsFile.getInterfaces().filter((declaration) => declaration.getName().endsWith("Input")).length} tool input types → ${TOOL_INPUTS_OUTPUT}`,
);
