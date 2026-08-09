import { extname, resolve } from "node:path";
import { type AnyNode, parse } from "acorn";
import * as esbuild from "esbuild";
import { loaderForPath } from "./esbuild-loader.js";

const PACKAGE_NAME = "@typed-rocks/typed-claude-hooks";
const PURE_ANNOTATION = "/* @__PURE__ */ ";

function withoutExtension(filePath: string): string {
  return filePath.slice(0, -extname(filePath).length || undefined);
}

function isAuthoringModule(moduleName: string, configPath: string): boolean {
  if (moduleName === PACKAGE_NAME) return true;
  if (!moduleName.startsWith(".")) return false;

  const importedPath = withoutExtension(resolve(configPath, "..", moduleName));
  return ["src/index", "src/authoring/define-handler"].some((suffix) => importedPath.endsWith(`/${suffix}`));
}

function isNode(value: unknown): value is AnyNode {
  return value !== null && typeof value === "object" && typeof (value as { type?: unknown }).type === "string";
}

function childNodes(node: AnyNode): AnyNode[] {
  return Object.values(node).flatMap((value) => {
    if (Array.isArray(value)) return value.filter(isNode);
    return isNode(value) ? [value] : [];
  });
}

function isHandlerCall(node: AnyNode, localNames: Set<string>): boolean {
  return node.type === "CallExpression" && node.callee.type === "Identifier" && localNames.has(node.callee.name);
}

function collectCallStarts(node: AnyNode, localNames: Set<string>): number[] {
  const own = isHandlerCall(node, localNames) ? [node.start] : [];
  return [...own, ...childNodes(node).flatMap((child) => collectCallStarts(child, localNames))];
}

function insertPureAnnotations(code: string, callStarts: number[]): string {
  const sorted = [...callStarts].sort((left, right) => left - right);
  const segments = sorted.map((start, index) => code.slice(index === 0 ? 0 : sorted[index - 1], start));
  return [...segments, code.slice(sorted.at(-1) ?? 0)].join(PURE_ANNOTATION);
}

/**
 * Marks `defineHandler(...)` calls as side-effect free so esbuild can tree-shake
 * the handlers a given bundle does not import.
 *
 * Types are stripped with esbuild first, so the returned code is plain JavaScript
 * and must be handed to esbuild with the `js` loader.
 */
export async function annotatePureHandlers(source: string, configPath: string): Promise<string> {
  const { code } = await esbuild.transform(source, {
    loader: loaderForPath(configPath),
    jsx: "automatic",
  });
  const program = parse(code, { ecmaVersion: "latest", sourceType: "module" });

  const localNames = new Set(
    program.body
      .filter((node) => node.type === "ImportDeclaration")
      .filter((node) => isAuthoringModule(String(node.source.value), configPath))
      .flatMap((node) => node.specifiers)
      .filter((specifier) => specifier.type === "ImportSpecifier")
      .filter((specifier) => specifier.imported.type === "Identifier" && specifier.imported.name === "defineHandler")
      .map((specifier) => specifier.local.name),
  );

  return insertPureAnnotations(code, collectCallStarts(program, localNames));
}
