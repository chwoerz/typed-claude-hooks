import * as esbuild from "esbuild";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  createCompilerOptions,
  createEditor,
  createTypeScriptEnvironment,
  initializeEditor,
  markerToDiagnostic,
} from "../src/playground/editor";
import { starterSource } from "../src/playground/starter";
import { buildHandlers } from "../src/playground/compiler/build-handlers";
import { typeLibraries } from "../src/playground/type-libraries";
import { configureMonacoWorkers } from "../src/playground/monaco-workers";

const monacoTypeScript = {
  ModuleKind: { ESNext: 99 },
  ModuleResolutionKind: { NodeJs: 2 },
  ScriptTarget: { ESNext: 99 },
} as const;

describe("playground editor", () => {
  it("uses Monaco's exact compiler enum values and strict no-emit options", () => {
    const options = createCompilerOptions(monacoTypeScript);

    expect(options).toMatchObject({
      module: monacoTypeScript.ModuleKind.ESNext,
      moduleResolution: monacoTypeScript.ModuleResolutionKind.NodeJs,
      target: monacoTypeScript.ScriptTarget.ESNext,
      strict: true,
      noEmit: true,
      baseUrl: "file:///",
    });
  });

  it("registers canonical declaration paths and aliases package entry points", () => {
    const environment = createTypeScriptEnvironment(typeLibraries);

    expect(environment.extraLibs).toContainEqual({
      filePath: "file:///node_modules/typed-claude-hooks/index.d.ts",
      content: expect.stringContaining("defineHandler"),
    });
    expect(environment.compilerOptions.paths).toMatchObject({
      "typed-claude-hooks": ["node_modules/typed-claude-hooks/index.d.ts"],
      "typed-claude-hooks/types": [
        "node_modules/typed-claude-hooks/types/index.d.ts",
      ],
      "undici-types": ["node_modules/undici-types/index.d.ts"],
      "undici-types/*": ["node_modules/undici-types/*"],
    });
  });

  it(
    "type-checks matcher input, output, public types, Node, and transitive imports",
    () => {
      const environment = createTypeScriptEnvironment(typeLibraries);
      const source = `
      import { defineHandler } from "typed-claude-hooks"
      import type { Runtime } from "typed-claude-hooks/types"
      import { basename } from "node:path"

      const runtime: Runtime = "node"
      export const blockRm = defineHandler("PreToolUse", { matcher: "Bash" }, async (input) => ({
        systemMessage: basename(input.tool_input.command) + runtime,
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: "Blocked",
        },
      }))
      // @ts-expect-error Bash matcher input is not a Write input
      blockRm.handler({ tool_input: { file_path: "x" } })
    `;
      const diagnostics = semanticDiagnostics(source, environment);

      expect(diagnostics).toEqual([]);
    },
    15_000,
  );

  it("completes matcher-narrowed tool input and Node APIs", () => {
    const environment = createTypeScriptEnvironment(typeLibraries);
    const matcherSource = `
      import { defineHandler } from "typed-claude-hooks"
      export const blockRm = defineHandler("PreToolUse", { matcher: "Bash" }, async (input) => {
        input.tool_input.
        return {}
      })
    `;
    const nodeSource = "process.";
    const matcherService = createLanguageService(matcherSource, environment);
    const nodeService = createLanguageService(nodeSource, environment);
    const toolInputCompletions = completionNames(
      matcherService,
      matcherSource,
      "input.tool_input.",
    );
    const nodeCompletions = completionNames(
      nodeService,
      nodeSource,
      "process.",
    );

    expect(toolInputCompletions).toContain("command");
    expect(toolInputCompletions).not.toContain("file_path");
    expect(nodeCompletions).toContain("cwd");
    expect(nodeCompletions).toContain("env");
  });

  it("owns a unique model per editor and disposes instances independently", () => {
    const monaco = createFakeMonaco();
    const first = createEditor(monaco.api, {} as HTMLElement);
    const second = createEditor(monaco.api, {} as HTMLElement);

    expect(first.model.uri.toString()).not.toBe(second.model.uri.toString());
    first.dispose();
    expect(first.model.isDisposed()).toBe(true);
    expect(second.model.isDisposed()).toBe(false);
    expect(monaco.hasTypeLibrary()).toBe(true);

    second.dispose();
    expect(second.model.isDisposed()).toBe(true);
    expect(monaco.hasTypeLibrary()).toBe(false);
  });

  it("waits for TypeScript language registration before reading diagnostics", async () => {
    let attempts = 0;
    const monaco = createFakeMonaco({
      getTypeScriptWorker: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("TypeScript not registered!");
        return async () => ({
          getSemanticDiagnostics: async () => [],
          getSyntacticDiagnostics: async () => [],
        });
      },
    });
    const editor = createEditor(monaco.api, {} as HTMLElement);

    await expect(editor.getDiagnostics()).resolves.toEqual({
      sourceVersion: 1,
      diagnostics: [],
    });
    expect(attempts).toBe(2);

    editor.dispose();
  });

  it("restores TypeScript defaults after the last editor is disposed", () => {
    const previousCompilerOptions = { strict: false };
    const previousDiagnosticsOptions = { noSemanticValidation: true };
    const monaco = createFakeMonaco({
      compilerOptions: previousCompilerOptions,
      diagnosticsOptions: previousDiagnosticsOptions,
    });
    const first = createEditor(monaco.api, {} as HTMLElement);
    const second = createEditor(monaco.api, {} as HTMLElement);

    expect(monaco.compilerOptions()).toMatchObject({ strict: true });
    first.dispose();
    expect(monaco.compilerOptions()).toMatchObject({ strict: true });

    second.dispose();
    expect(monaco.compilerOptions()).toBe(previousCompilerOptions);
    expect(monaco.diagnosticsOptions()).toBe(previousDiagnosticsOptions);
  });

  it.each([
    [0, 1],
    [1, 0],
  ])(
    "shares defaults across initializeEditor wrappers disposed as %s then %s",
    async (firstIndex, secondIndex) => {
      const previousCompilerOptions = { strict: false };
      const previousDiagnosticsOptions = { noSemanticValidation: true };
      const monaco = createFakeMonaco({
        compilerOptions: previousCompilerOptions,
        diagnosticsOptions: previousDiagnosticsOptions,
      });
      const wrappers = [{ ...monaco.api }, { ...monaco.api }] as Parameters<
        typeof createEditor
      >[0][];
      let loadIndex = 0;
      let workerReleases = 0;
      const dependencies = {
        configureWorkers: () => () => {
          workerReleases += 1;
        },
        loadMonaco: async () => wrappers[loadIndex++],
      };
      const editors = [
        await initializeEditor({} as HTMLElement, {}, dependencies),
        await initializeEditor({} as HTMLElement, {}, dependencies),
      ];

      editors[firstIndex].dispose();
      expect(monaco.compilerOptions()).toMatchObject({ strict: true });
      editors[secondIndex].dispose();

      expect(monaco.compilerOptions()).toBe(previousCompilerOptions);
      expect(monaco.diagnosticsOptions()).toBe(previousDiagnosticsOptions);
      expect(workerReleases).toBe(2);
    },
  );

  it.each(["model", "editor"] as const)(
    "rolls back resources when %s creation throws",
    async (failure) => {
      const previousCompilerOptions = { strict: false };
      const monaco = createFakeMonaco({
        compilerOptions: previousCompilerOptions,
        failAt: failure,
      });
      let workerReleases = 0;

      await expect(
        initializeEditor(
          {} as HTMLElement,
          {},
          {
            configureWorkers: () => () => {
              workerReleases += 1;
            },
            loadMonaco: async () => monaco.api,
          },
        ),
      ).rejects.toThrow(`${failure} creation failed`);

      expect(monaco.compilerOptions()).toBe(previousCompilerOptions);
      expect(monaco.hasTypeLibrary()).toBe(false);
      expect(monaco.liveModels()).toBe(0);
      expect(workerReleases).toBe(1);
    },
  );

  it("does not overwrite TypeScript defaults replaced by another owner", () => {
    const monaco = createFakeMonaco();
    const editor = createEditor(monaco.api, {} as HTMLElement);
    const replacementCompilerOptions = { strict: false };
    const replacementDiagnosticsOptions = { noSyntaxValidation: true };
    monaco.setCompilerOptions(replacementCompilerOptions);
    monaco.setDiagnosticsOptions(replacementDiagnosticsOptions);

    editor.dispose();

    expect(monaco.compilerOptions()).toBe(replacementCompilerOptions);
    expect(monaco.diagnosticsOptions()).toBe(replacementDiagnosticsOptions);
  });

  it("reference-counts and conditionally restores MonacoEnvironment", () => {
    const previous = {
      getWorker: () => ({ previous: true }) as unknown as Worker,
    };
    const globalScope = { MonacoEnvironment: previous };
    const releaseFirst = configureMonacoWorkers(globalScope);
    const owned = globalScope.MonacoEnvironment;
    const releaseSecond = configureMonacoWorkers(globalScope);

    expect(globalScope.MonacoEnvironment).toBe(owned);
    releaseFirst();
    expect(globalScope.MonacoEnvironment).toBe(owned);
    releaseSecond();
    expect(globalScope.MonacoEnvironment).toBe(previous);

    const releaseThird = configureMonacoWorkers(globalScope);
    const replacement = { getWorker: previous.getWorker };
    globalScope.MonacoEnvironment = replacement;
    releaseThird();
    expect(globalScope.MonacoEnvironment).toBe(replacement);
  });

  it("builds the direct named starter handler", async () => {
    expect(starterSource).toContain("export const blockRm = defineHandler");
    expect(starterSource).not.toContain("export default");

    const result = await buildHandlers(
      { requestId: "starter", source: starterSource },
      esbuild,
    );
    expect(result.status).toBe("success");
    expect(result.handlers).toEqual([
      { name: "blockRm", event: "PreToolUse", matcher: "Bash" },
    ]);
  });

  it("converts Monaco markers to accurate source diagnostics", () => {
    const source = "const first = 1\nconst broken = nope\n";
    const diagnostic = markerToDiagnostic(
      {
        code: "2304",
        severity: 8,
        message: "Cannot find name 'nope'.",
        source: "ts",
        startLineNumber: 2,
        startColumn: 16,
        endLineNumber: 2,
        endColumn: 20,
      },
      "hooks.config.ts",
      source,
    );

    expect(diagnostic).toEqual({
      code: "2304",
      severity: "error",
      message: "Cannot find name 'nope'.",
      sourceLine: "const broken = nope",
      fileName: "hooks.config.ts",
      start: { line: 2, column: 16, offset: 31 },
      end: { line: 2, column: 20, offset: 35 },
    });
  });
});

function semanticDiagnostics(
  source: string,
  environment: ReturnType<typeof createTypeScriptEnvironment>,
) {
  const sourceFile = "file:///hooks.config.ts";
  const virtualFiles = Object.fromEntries(
    environment.extraLibs.map(({ filePath, content }) => [filePath, content]),
  );
  virtualFiles[sourceFile] = source;
  const options: ts.CompilerOptions = {
    ...environment.compilerOptions,
    lib: undefined,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    target: ts.ScriptTarget.ESNext,
    noEmit: true,
  };
  const host = ts.createCompilerHost(options);
  const originalFileExists = host.fileExists;
  const originalReadFile = host.readFile;
  host.fileExists = (fileName) =>
    fileName in virtualFiles || originalFileExists(fileName);
  host.readFile = (fileName) =>
    virtualFiles[fileName] ?? originalReadFile(fileName);
  host.getSourceFile = (fileName, languageVersion) => {
    const content = host.readFile(fileName);
    return content === undefined
      ? undefined
      : ts.createSourceFile(fileName, content, languageVersion, true);
  };
  host.directoryExists = (directoryName) =>
    Object.keys(virtualFiles).some((fileName) =>
      fileName.startsWith(`${directoryName}/`),
    ) || ts.sys.directoryExists(directoryName);
  host.getCurrentDirectory = () => "file:///";

  return ts
    .getPreEmitDiagnostics(ts.createProgram([sourceFile], options, host))
    .map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
    );
}

function createLanguageService(
  source: string,
  environment: ReturnType<typeof createTypeScriptEnvironment>,
) {
  const sourceFile = "file:///hooks.config.ts";
  const virtualFiles: Record<string, string> = Object.fromEntries(
    environment.extraLibs.map(({ filePath, content }) => [filePath, content]),
  );
  virtualFiles[sourceFile] = source;
  const compilerOptions: ts.CompilerOptions = {
    ...environment.compilerOptions,
    lib: undefined,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    target: ts.ScriptTarget.ESNext,
  };
  const host: ts.LanguageServiceHost = {
    getCompilationSettings: () => compilerOptions,
    getCurrentDirectory: () => "file:///",
    getDefaultLibFileName: ts.getDefaultLibFilePath,
    getScriptFileNames: () => Object.keys(virtualFiles),
    getScriptSnapshot: (fileName) => {
      const content = virtualFiles[fileName] ?? ts.sys.readFile(fileName);
      return content === undefined
        ? undefined
        : ts.ScriptSnapshot.fromString(content);
    },
    getScriptVersion: () => "1",
    fileExists: (fileName) =>
      fileName in virtualFiles || ts.sys.fileExists(fileName),
    readFile: (fileName) => virtualFiles[fileName] ?? ts.sys.readFile(fileName),
    directoryExists: (directoryName) =>
      Object.keys(virtualFiles).some((fileName) =>
        fileName.startsWith(`${directoryName}/`),
      ) || ts.sys.directoryExists(directoryName),
  };
  return ts.createLanguageService(host);
}

function completionNames(
  service: ts.LanguageService,
  source: string,
  expression: string,
) {
  const position = source.indexOf(expression) + expression.length;
  return (
    service.getCompletionsAtPosition("file:///hooks.config.ts", position, {})
      ?.entries ?? []
  ).map(({ name }) => name);
}

function createFakeMonaco(
  initial: {
    compilerOptions?: object;
    diagnosticsOptions?: object;
    failAt?: "model" | "editor";
    getTypeScriptWorker?: () => Promise<
      (uri: { toString(): string }) => Promise<{
        getSemanticDiagnostics(fileName: string): Promise<unknown[]>;
        getSyntacticDiagnostics(fileName: string): Promise<unknown[]>;
      }>
    >;
  } = {},
) {
  const models = new Map<string, ReturnType<typeof createModel>>();
  const typeLibraries = new Set<string>();
  let compilerOptions = initial.compilerOptions ?? {};
  let diagnosticsOptions = initial.diagnosticsOptions ?? {};
  const createModel = (value: string, uri: { toString(): string }) => {
    let disposed = false;
    return {
      uri,
      dispose: () => {
        disposed = true;
        models.delete(uri.toString());
      },
      getValue: () => value,
      getVersionId: () => 1,
      isDisposed: () => disposed,
      setValue: () => {},
    };
  };
  const api = {
    Uri: { parse: (value: string) => ({ toString: () => value }) },
    typescript: {
      ModuleKind: monacoTypeScript.ModuleKind,
      ModuleResolutionKind: monacoTypeScript.ModuleResolutionKind,
      ScriptTarget: monacoTypeScript.ScriptTarget,
      getTypeScriptWorker: initial.getTypeScriptWorker,
      typescriptDefaults: {
        addExtraLib: (_content: string, filePath: string) => {
          typeLibraries.add(filePath);
          return { dispose: () => typeLibraries.delete(filePath) };
        },
        getCompilerOptions: () => compilerOptions,
        getDiagnosticsOptions: () => diagnosticsOptions,
        setCompilerOptions: (options: object) => {
          compilerOptions = options;
        },
        setDiagnosticsOptions: (options: object) => {
          diagnosticsOptions = options;
        },
      },
    },
    editor: {
      create: () => {
        if (initial.failAt === "editor")
          throw new Error("editor creation failed");
        return { dispose: () => {} };
      },
      createModel: (
        value: string,
        _language: string,
        uri: { toString(): string },
      ) => {
        if (initial.failAt === "model")
          throw new Error("model creation failed");
        const model = createModel(value, uri);
        models.set(uri.toString(), model);
        return model;
      },
      getModel: (uri: { toString(): string }) =>
        models.get(uri.toString()) ?? null,
      getModelMarkers: () => [],
      onDidChangeMarkers: () => ({ dispose: () => {} }),
    },
  };
  return {
    api: api as unknown as Parameters<typeof createEditor>[0],
    compilerOptions: () => compilerOptions,
    diagnosticsOptions: () => diagnosticsOptions,
    setCompilerOptions: (options: object) => {
      compilerOptions = options;
    },
    setDiagnosticsOptions: (options: object) => {
      diagnosticsOptions = options;
    },
    hasTypeLibrary: () =>
      typeLibraries.has("file:///node_modules/typed-claude-hooks/index.d.ts"),
    liveModels: () => models.size,
  };
}
