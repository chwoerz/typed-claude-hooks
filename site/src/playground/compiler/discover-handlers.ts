import * as ts from "typescript";
import type {
  DiscoverHandlersResult,
  HandlerMetadata,
  SourceDiagnostic,
  SourcePosition,
} from "./types";

const allowedImports = new Set([
  "@typed-rocks/typed-claude-hooks",
  "@typed-rocks/typed-claude-hooks/types",
]);
const nodeBuiltins = new Set([
  "assert",
  "assert/strict",
  "async_hooks",
  "buffer",
  "child_process",
  "cluster",
  "console",
  "constants",
  "crypto",
  "diagnostics_channel",
  "dns",
  "dns/promises",
  "domain",
  "events",
  "fs",
  "fs/promises",
  "http",
  "http2",
  "https",
  "module",
  "net",
  "os",
  "path",
  "path/posix",
  "path/win32",
  "perf_hooks",
  "process",
  "punycode",
  "querystring",
  "readline",
  "readline/promises",
  "repl",
  "stream",
  "stream/consumers",
  "stream/promises",
  "stream/web",
  "string_decoder",
  "sys",
  "timers",
  "timers/promises",
  "tls",
  "trace_events",
  "tty",
  "url",
  "util",
  "util/types",
  "v8",
  "vm",
  "wasi",
  "worker_threads",
  "zlib",
]);
const optionNames = new Set([
  "matcher",
  "timeout",
  "if",
  "shell",
  "statusMessage",
  "once",
  "async",
  "asyncRewake",
]);
const stringOptions = new Set(["matcher", "if", "statusMessage"]);
const booleanOptions = new Set(["once", "async", "asyncRewake"]);
const artifactNamePattern = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const hookEvents = new Set([
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "PostToolBatch",
  "Notification",
  "UserPromptSubmit",
  "UserPromptExpansion",
  "SessionStart",
  "SessionEnd",
  "Stop",
  "StopFailure",
  "SubagentStart",
  "SubagentStop",
  "PreCompact",
  "PostCompact",
  "PermissionRequest",
  "PermissionDenied",
  "Setup",
  "TeammateIdle",
  "TaskCreated",
  "TaskCompleted",
  "Elicitation",
  "ElicitationResult",
  "ConfigChange",
  "WorktreeCreate",
  "WorktreeRemove",
  "InstructionsLoaded",
  "CwdChanged",
  "FileChanged",
  "MessageDisplay",
]);

export function discoverHandlers(
  source: string,
  fileName = "hooks.config.ts",
): DiscoverHandlersResult {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const diagnostics = syntaxDiagnostics(fileName, sourceFile);
  if (diagnostics.length > 0) {
    return { handlers: [], diagnostics };
  }
  const defineHandlerNames = new Set<string>();

  sourceFile.statements
    .filter(ts.isImportDeclaration)
    .forEach((declaration) => {
      validateImport(declaration, sourceFile, fileName, diagnostics);
      collectDefineHandlerImports(declaration, defineHandlerNames);
    });
  validateModuleLoading(sourceFile, fileName, diagnostics);

  const handlers: HandlerMetadata[] = [];
  const exportedNames = new Set<string>();

  sourceFile.statements.forEach((statement) => {
    if (ts.isExportAssignment(statement) || hasDefaultModifier(statement)) {
      diagnostics.push(
        diagnostic(
          sourceFile,
          fileName,
          statement,
          "PLAYGROUND_DEFAULT_EXPORT",
          "Default exports are not supported; export each handler as a named const.",
        ),
      );
      return;
    }
    if (ts.isExportDeclaration(statement)) {
      if (isFullyTypeOnlyExport(statement)) {
        return;
      }
      diagnostics.push(
        diagnostic(
          sourceFile,
          fileName,
          statement,
          "PLAYGROUND_RE_EXPORT",
          "Runtime re-exports and export-star declarations are not supported; only fully type-only export declarations are allowed.",
        ),
      );
      return;
    }
    if (!hasExportModifier(statement)) {
      return;
    }
    // Interfaces and type aliases are safe because TypeScript erases them.
    if (
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement)
    ) {
      return;
    }
    if (!ts.isVariableStatement(statement)) {
      diagnostics.push(
        diagnostic(
          sourceFile,
          fileName,
          statement,
          "PLAYGROUND_RUNTIME_EXPORT",
          "Only direct handler consts may be runtime exports; exported functions, classes, and other runtime declarations are not supported.",
        ),
      );
      return;
    }
    if ((statement.declarationList.flags & ts.NodeFlags.Const) === 0) {
      diagnostics.push(
        diagnostic(
          sourceFile,
          fileName,
          statement,
          "PLAYGROUND_MUTABLE_EXPORT",
          "Handler declarations must use export const; exported let and var declarations are not supported.",
        ),
      );
      return;
    }

    statement.declarationList.declarations.forEach((declaration) => {
      const handler = discoverDeclaration(
        declaration,
        sourceFile,
        fileName,
        defineHandlerNames,
        exportedNames,
        diagnostics,
      );
      if (handler) {
        handlers.push(handler);
      }
    });
  });

  if (handlers.length === 0) {
    diagnostics.push(
      diagnostic(
        sourceFile,
        fileName,
        sourceFile,
        "PLAYGROUND_NO_HANDLERS",
        "No handlers found. Export at least one named const initialized directly by defineHandler(...).",
      ),
    );
  }

  return { handlers, diagnostics };
}

function validateImport(
  declaration: ts.ImportDeclaration,
  sourceFile: ts.SourceFile,
  fileName: string,
  diagnostics: SourceDiagnostic[],
): void {
  if (!ts.isStringLiteral(declaration.moduleSpecifier)) {
    return;
  }
  const moduleName = declaration.moduleSpecifier.text;
  if (moduleName === "node:module") {
    validateNodeModuleImport(declaration, sourceFile, fileName, diagnostics);
  }
  if (allowedImports.has(moduleName) || moduleName.startsWith("node:")) {
    return;
  }
  const message = nodeBuiltins.has(moduleName)
    ? `Use "node:${moduleName}" instead of the bare Node built-in "${moduleName}".`
    : `The playground bundler cannot resolve "${moduleName}". Use @typed-rocks/typed-claude-hooks, @typed-rocks/typed-claude-hooks/types, or a node:* module; generated hooks retain Node runtime capabilities.`;
  diagnostics.push(
    diagnostic(
      sourceFile,
      fileName,
      declaration.moduleSpecifier,
      "PLAYGROUND_UNSUPPORTED_IMPORT",
      message,
    ),
  );
}

function validateNodeModuleImport(
  declaration: ts.ImportDeclaration,
  sourceFile: ts.SourceFile,
  fileName: string,
  diagnostics: SourceDiagnostic[],
): void {
  const importClause = declaration.importClause;
  if (!importClause || importClause.isTypeOnly) {
    return;
  }
  const namedBindings = importClause.namedBindings;
  const hasRuntimeBinding =
    importClause.name !== undefined ||
    (namedBindings !== undefined &&
      (ts.isNamespaceImport(namedBindings) ||
        namedBindings.elements.some(({ isTypeOnly }) => !isTypeOnly)));
  if (!hasRuntimeBinding) {
    return;
  }
  diagnostics.push(
    diagnostic(
      sourceFile,
      fileName,
      importClause,
      "PLAYGROUND_CREATE_REQUIRE",
      "The playground supports statically resolved Node imports only; use a type-only node:module import or another node:* module instead of runtime module loading.",
    ),
  );
}

function validateModuleLoading(
  sourceFile: ts.SourceFile,
  fileName: string,
  diagnostics: SourceDiagnostic[],
): void {
  const visit = (node: ts.Node): void => {
    const isDynamicImport =
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword;
    const isRequireCall =
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require";
    if (
      ts.isImportEqualsDeclaration(node) ||
      isDynamicImport ||
      isRequireCall
    ) {
      diagnostics.push(
        diagnostic(
          sourceFile,
          fileName,
          node,
          "PLAYGROUND_STATIC_IMPORT_ONLY",
          "Only static ESM imports are supported; import equals, dynamic import(), and require() are not allowed.",
        ),
      );
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
}

function collectDefineHandlerImports(
  declaration: ts.ImportDeclaration,
  names: Set<string>,
): void {
  if (
    !ts.isStringLiteral(declaration.moduleSpecifier) ||
    declaration.moduleSpecifier.text !== "@typed-rocks/typed-claude-hooks" ||
    declaration.importClause?.isTypeOnly
  ) {
    return;
  }
  const bindings = declaration.importClause?.namedBindings;
  if (!bindings || !ts.isNamedImports(bindings)) {
    return;
  }
  bindings.elements
    .filter(
      (element) =>
        !element.isTypeOnly &&
        (element.propertyName ?? element.name).text === "defineHandler",
    )
    .forEach((element) => names.add(element.name.text));
}

function discoverDeclaration(
  declaration: ts.VariableDeclaration,
  sourceFile: ts.SourceFile,
  fileName: string,
  defineHandlerNames: Set<string>,
  exportedNames: Set<string>,
  diagnostics: SourceDiagnostic[],
): HandlerMetadata | undefined {
  if (!ts.isIdentifier(declaration.name)) {
    diagnostics.push(
      diagnostic(
        sourceFile,
        fileName,
        declaration.name,
        "PLAYGROUND_INVALID_EXPORT",
        "Exported handlers must use a single artifact-safe identifier.",
      ),
    );
    return undefined;
  }
  const name = declaration.name.text;
  if (exportedNames.has(name)) {
    diagnostics.push(
      diagnostic(
        sourceFile,
        fileName,
        declaration.name,
        "PLAYGROUND_DUPLICATE_NAME",
        `Duplicate exported handler name "${name}".`,
      ),
    );
    return undefined;
  }
  exportedNames.add(name);
  if (!artifactNamePattern.test(name)) {
    diagnostics.push(
      diagnostic(
        sourceFile,
        fileName,
        declaration.name,
        "PLAYGROUND_INVALID_NAME",
        `Exported handler name "${name}" is not safe for an artifact file name. Use letters, numbers, underscores, or hyphens.`,
      ),
    );
    return undefined;
  }

  const initializer = declaration.initializer;
  if (!initializer || !ts.isCallExpression(initializer)) {
    diagnostics.push(
      diagnostic(
        sourceFile,
        fileName,
        declaration,
        "PLAYGROUND_INDIRECT_HANDLER",
        `Only direct handler consts may be runtime exports; exported const "${name}" must be initialized by a direct call to defineHandler(...).`,
      ),
    );
    return undefined;
  }
  if (ts.isPropertyAccessExpression(initializer.expression)) {
    diagnostics.push(
      diagnostic(
        sourceFile,
        fileName,
        initializer.expression,
        "PLAYGROUND_NAMESPACE_CALL",
        "Namespace calls such as hooks.defineHandler(...) are not supported; use a named import.",
      ),
    );
    return undefined;
  }
  if (
    !ts.isIdentifier(initializer.expression) ||
    !defineHandlerNames.has(initializer.expression.text)
  ) {
    diagnostics.push(
      diagnostic(
        sourceFile,
        fileName,
        initializer.expression,
        "PLAYGROUND_UNRELATED_CALL",
        `Exported handler "${name}" must use a direct call to defineHandler imported from "@typed-rocks/typed-claude-hooks".`,
      ),
    );
    return undefined;
  }

  const eventNode = initializer.arguments[0];
  if (!eventNode || !isStringLiteral(eventNode)) {
    diagnostics.push(
      diagnostic(
        sourceFile,
        fileName,
        eventNode ?? initializer,
        "PLAYGROUND_STATIC_EVENT",
        `Handler "${name}" needs a string literal event for artifact generation.`,
      ),
    );
    return undefined;
  }
  if (!hookEvents.has(eventNode.text)) {
    diagnostics.push(
      diagnostic(
        sourceFile,
        fileName,
        eventNode,
        "PLAYGROUND_UNKNOWN_EVENT",
        `Unsupported hook event "${eventNode.text}". Use a HookEvent value exported by @typed-rocks/typed-claude-hooks/types.`,
      ),
    );
    return undefined;
  }

  const optionsNode =
    initializer.arguments.length >= 3 ? initializer.arguments[1] : undefined;
  const options = optionsNode
    ? extractOptions(optionsNode, sourceFile, fileName, name, diagnostics)
    : {};
  if (!options) {
    return undefined;
  }
  return { name, event: eventNode.text, ...options };
}

function extractOptions(
  node: ts.Expression,
  sourceFile: ts.SourceFile,
  fileName: string,
  handlerName: string,
  diagnostics: SourceDiagnostic[],
): Omit<HandlerMetadata, "name" | "event"> | undefined {
  if (!ts.isObjectLiteralExpression(node)) {
    diagnostics.push(
      diagnostic(
        sourceFile,
        fileName,
        node,
        "PLAYGROUND_STATIC_OPTIONS",
        `Handler "${handlerName}" options must be an object literal for artifact generation.`,
      ),
    );
    return undefined;
  }

  const options: Record<string, string | number | boolean> = {};
  const invalidProperties = node.properties.filter((property) => {
    if (!ts.isPropertyAssignment(property)) {
      diagnostics.push(
        diagnostic(
          sourceFile,
          fileName,
          property,
          "PLAYGROUND_STATIC_OPTION",
          `Handler "${handlerName}" options cannot use spreads, methods, or shorthand properties.`,
        ),
      );
      return true;
    }
    const optionName = propertyName(property.name);
    if (!optionName || !optionNames.has(optionName)) {
      diagnostics.push(
        diagnostic(
          sourceFile,
          fileName,
          property.name,
          "PLAYGROUND_UNKNOWN_OPTION",
          `Handler "${handlerName}" has unsupported option "${optionName ?? property.name.getText(sourceFile)}".`,
        ),
      );
      return true;
    }
    if (
      optionName === "timeout" &&
      ts.isNumericLiteral(property.initializer) &&
      !Number.isFinite(Number(property.initializer.text))
    ) {
      diagnostics.push(
        diagnostic(
          sourceFile,
          fileName,
          property.initializer,
          "PLAYGROUND_FINITE_TIMEOUT",
          'Handler option "timeout" must be a finite numeric literal for artifact generation.',
        ),
      );
      return true;
    }
    const value = literalOptionValue(optionName, property.initializer);
    if (value === undefined) {
      diagnostics.push(
        diagnostic(
          sourceFile,
          fileName,
          property.initializer,
          "PLAYGROUND_STATIC_OPTION",
          `Handler option "${optionName}" must use a supported literal value for artifact generation.`,
        ),
      );
      return true;
    }
    options[optionName] = value;
    return false;
  });

  return invalidProperties.length === 0
    ? (options as Omit<HandlerMetadata, "name" | "event">)
    : undefined;
}

function literalOptionValue(
  optionName: string,
  node: ts.Expression,
): string | number | boolean | undefined {
  if (stringOptions.has(optionName) && isStringLiteral(node)) {
    return node.text;
  }
  if (optionName === "timeout" && ts.isNumericLiteral(node)) {
    return Number(node.text);
  }
  if (
    optionName === "shell" &&
    isStringLiteral(node) &&
    (node.text === "bash" || node.text === "powershell")
  ) {
    return node.text;
  }
  if (booleanOptions.has(optionName)) {
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  }
  return undefined;
}

function propertyName(name: ts.PropertyName): string | undefined {
  return ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
    ? name.text
    : undefined;
}

function isStringLiteral(
  node: ts.Node,
): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

function hasExportModifier(node: ts.Node): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts
      .getModifiers(node)
      ?.some(({ kind }) => kind === ts.SyntaxKind.ExportKeyword) ??
      false)
  );
}

function isFullyTypeOnlyExport(declaration: ts.ExportDeclaration): boolean {
  if (declaration.isTypeOnly) {
    return true;
  }
  const exportClause = declaration.exportClause;
  return (
    exportClause !== undefined &&
    ts.isNamedExports(exportClause) &&
    exportClause.elements.length > 0 &&
    exportClause.elements.every(({ isTypeOnly }) => isTypeOnly)
  );
}

function hasDefaultModifier(node: ts.Node): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts
      .getModifiers(node)
      ?.some(({ kind }) => kind === ts.SyntaxKind.DefaultKeyword) ??
      false)
  );
}

function syntaxDiagnostics(
  fileName: string,
  sourceFile: ts.SourceFile,
): SourceDiagnostic[] {
  const parseDiagnostics = (
    sourceFile as ts.SourceFile & {
      parseDiagnostics: readonly ts.DiagnosticWithLocation[];
    }
  ).parseDiagnostics;
  return parseDiagnostics.map((item) => {
    const start = item.start ?? 0;
    const length = item.length ?? 0;
    return {
      code: `TS${item.code}`,
      severity:
        item.category === ts.DiagnosticCategory.Warning ? "warning" : "error",
      message: ts.flattenDiagnosticMessageText(item.messageText, "\n"),
      fileName,
      start: position(sourceFile, start),
      end: position(sourceFile, start + length),
    };
  });
}

function diagnostic(
  sourceFile: ts.SourceFile,
  fileName: string,
  node: ts.Node,
  code: string,
  message: string,
): SourceDiagnostic {
  return {
    code,
    severity: "error",
    message,
    fileName,
    start: position(sourceFile, node.getStart(sourceFile)),
    end: position(sourceFile, node.getEnd()),
  };
}

function position(sourceFile: ts.SourceFile, offset: number): SourcePosition {
  const boundedOffset = Math.max(
    0,
    Math.min(offset, sourceFile.getFullText().length),
  );
  const { line, character } =
    sourceFile.getLineAndCharacterOfPosition(boundedOffset);
  return { line: line + 1, column: character + 1, offset: boundedOffset };
}
