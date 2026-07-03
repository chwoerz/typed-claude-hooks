import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = (...parts: string[]) => resolve(__dirname, "..", "src", ...parts);
const OUTPUT = resolve(
  __dirname,
  "../site/src/app/components/playground/editor/generated-dts.ts",
);

function stripImports(source: string): string {
  return source.replace(
    /import\s+(?:type\s+)?\{[^}]*\}\s*from\s*["'][^"']+["'];?\n?/gs,
    "",
  );
}

function readAndStrip(path: string): string {
  const raw = readFileSync(path, "utf-8");
  return stripImports(raw)
    .split("\n")
    .filter((line) => !line.startsWith("// Auto-extracted"))
    .filter((line) => !line.startsWith("// Do not edit"))
    .filter((line) => !line.startsWith("//# sourceMappingURL"))
    .join("\n")
    .trim();
}

const hooksTypes = readAndStrip(SRC("types", "hooks.ts"));
const toolInputTypes = readAndStrip(SRC("types", "tool-inputs.ts"));
const mappingTypes = readAndStrip(SRC("types", "mapping.ts"));

const defineHandlerOverloads = `
export function defineHandler<E extends ToolHookEvent, M extends string>(
  event: E,
  options: HandlerOptions & { matcher: M },
  handler: (input: NarrowedToolInput<E, M>) => Promise<HookOutputFor<E>>,
): TypedHandler<E>;

export function defineHandler<E extends HookEvent>(
  event: E,
  options: HandlerOptions,
  handler: (input: HookInputFor<E>) => Promise<HookOutputFor<E>>,
): TypedHandler<E>;

export function defineHandler<E extends HookEvent>(
  event: E,
  handler: (input: HookInputFor<E>) => Promise<HookOutputFor<E>>,
): TypedHandler<E>;
`.trim();

const dtsBody = [
  hooksTypes,
  toolInputTypes,
  mappingTypes,
  defineHandlerOverloads,
]
  .join("\n\n")
  .split("\n")
  .map((line) => (line.trim() === "" ? "" : `  ${line}`))
  .join("\n");

const dtsContent = `declare module "typed-claude-hooks" {\n${dtsBody}\n}`;

const output = `// Auto-generated from src/types — do not edit manually
// Regenerate with: npm run generate-monaco-dts

export const TYPED_CLAUDE_HOOKS_DTS = ${JSON.stringify(dtsContent)};
`;

writeFileSync(OUTPUT, output);
console.log(`Generated Monaco DTS → ${OUTPUT}`);
