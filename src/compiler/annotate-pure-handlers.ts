import { extname, resolve } from "node:path";
import { Node, Project, SyntaxKind } from "ts-morph";

const PACKAGE_NAME = "typed-claude-hooks";

function withoutExtension(filePath: string): string {
  return filePath.slice(0, -extname(filePath).length || undefined);
}

function isAuthoringModule(moduleName: string, configPath: string): boolean {
  if (moduleName === PACKAGE_NAME) return true;
  if (!moduleName.startsWith(".")) return false;

  const importedPath = withoutExtension(resolve(configPath, "..", moduleName));
  return ["src/index", "src/authoring/define-handler"].some((suffix) =>
    importedPath.endsWith(`/${suffix}`),
  );
}

export function annotatePureHandlers(
  source: string,
  configPath: string,
): string {
  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile(configPath, source);
  const importSymbols = sourceFile
    .getImportDeclarations()
    .filter((declaration) =>
      isAuthoringModule(declaration.getModuleSpecifierValue(), configPath),
    )
    .flatMap((declaration) => declaration.getNamedImports())
    .filter((specifier) => specifier.getName() === "defineHandler")
    .map((specifier) => specifier.getAliasNode() ?? specifier.getNameNode())
    .map((identifier) => identifier.getSymbol())
    .filter((symbol) => symbol !== undefined);

  const positions = sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .map((call) => call.getExpression())
    .filter(Node.isIdentifier)
    .filter((identifier) => {
      const symbol = identifier.getSymbol();
      return symbol !== undefined && importSymbols.includes(symbol);
    })
    .map((identifier) => identifier.getStart())
    .sort((left, right) => right - left);

  positions.forEach((position) => {
    sourceFile.insertText(position, "/* @__PURE__ */ ");
  });
  return sourceFile.getFullText();
}
