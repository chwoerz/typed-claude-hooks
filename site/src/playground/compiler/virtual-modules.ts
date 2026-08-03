import * as ts from "typescript";
import {
  generateBashWrapper as renderBashWrapper,
  generatePowerShellWrapper as renderPowerShellWrapper,
} from "typed-claude-hooks/compiler";
export { generateRuntime } from "typed-claude-hooks/compiler";

export const generateBashWrapper = (mjsFileName: string) =>
  renderBashWrapper(mjsFileName, "node");
export const generatePowerShellWrapper = (mjsFileName: string) =>
  renderPowerShellWrapper(mjsFileName, "node");

export const configModule = "playground:hooks.config.ts";
export const runtimeModule = "typed-claude-hooks";
export const runtimeNamespace = "playground-runtime";

export const authoringRuntime = `
function clearUndefineds(value) {
  for (const key of Object.keys(value)) {
    if (value[key] === undefined) delete value[key];
  }
  return value;
}

export function defineHandler(event, ...rest) {
  const options = typeof rest[0] === "object" && rest[0] !== null && !Array.isArray(rest[0])
    ? rest.shift()
    : undefined;
  return clearUndefineds({ ...options, event, handler: rest[0] });
}
`;

export function annotatePureDefineHandlers(
  source: string,
  fileName = "hooks.config.ts",
): string {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const importedNames = new Set(
    sourceFile.statements
    .filter(ts.isImportDeclaration)
    .filter(
      ({ moduleSpecifier }) =>
        ts.isStringLiteral(moduleSpecifier) &&
        moduleSpecifier.text === runtimeModule,
    )
    .flatMap(({ importClause }) => {
      const bindings = importClause?.namedBindings;
      return bindings && ts.isNamedImports(bindings) ? bindings.elements : [];
    })
    .filter(
      (element) =>
        !element.isTypeOnly &&
        (element.propertyName ?? element.name).text === "defineHandler",
    )
    .map((element) => element.name.text),
  );

  const positions = sourceFile.statements
    .filter(ts.isVariableStatement)
    .flatMap(({ declarationList }) => declarationList.declarations)
    .map(({ initializer }) => initializer)
    .filter(
      (initializer): initializer is ts.CallExpression =>
        initializer !== undefined && ts.isCallExpression(initializer),
    )
    .filter(
      ({ expression }) =>
        ts.isIdentifier(expression) && importedNames.has(expression.text),
    )
    .map(({ expression }) => expression.getStart(sourceFile));

  const result = { source };
  positions
    .sort((left, right) => right - left)
    .forEach((position) => {
      const current = result.source;
      result.source = `${current.slice(0, position)}/* @__PURE__ */ ${current.slice(position)}`;
    });
  return result.source;
}
