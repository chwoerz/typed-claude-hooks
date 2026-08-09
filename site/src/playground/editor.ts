import type * as Monaco from "monaco-editor/editor/editor.api.js";
import type * as MonacoTypeScript from "monaco-editor/languages/features/typescript/register.js";
import type { SourceDiagnostic } from "./compiler/types";
import { starterSource } from "./starter";
import { getTypeLibraries, type TypeLibrary } from "./type-libraries";

let editorId = 0;

type CompilerOptions = Parameters<
  typeof MonacoTypeScript.typescriptDefaults.setCompilerOptions
>[0];

interface SharedTypeScriptDefaults {
  references: number;
  disposables: Monaco.IDisposable[];
  compilerOptions: CompilerOptions;
  diagnosticsOptions: DiagnosticsOptions;
  previousCompilerOptions: CompilerOptions;
  previousDiagnosticsOptions: DiagnosticsOptions;
}

const sharedTypeScriptDefaults = new WeakMap<
  object,
  SharedTypeScriptDefaults
>();

type DiagnosticsOptions = ReturnType<
  typeof MonacoTypeScript.typescriptDefaults.getDiagnosticsOptions
>;

type MonacoApi = typeof Monaco & { typescript: typeof MonacoTypeScript };

interface MonacoTypeScriptEnums {
  ModuleKind: { ESNext: number };
  ModuleResolutionKind: { NodeJs: number };
  ScriptTarget: { ESNext: number };
}

interface MarkerLike {
  code?: string | { value: string };
  severity: number;
  message: string;
  source?: string;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

export interface TypeScriptEnvironment {
  compilerOptions: CompilerOptions;
  extraLibs: Array<{ content: string; filePath: string }>;
}

export interface InitializeEditorOptions {
  source?: string;
  editorOptions?: Monaco.editor.IStandaloneEditorConstructionOptions;
  onDiagnostics?: (
    sourceVersion: number,
    diagnostics: SourceDiagnostic[],
  ) => void;
}

export interface PlaygroundEditor {
  editor: Monaco.editor.IStandaloneCodeEditor;
  model: Monaco.editor.ITextModel;
  getDiagnostics(): Promise<{
    sourceVersion: number;
    diagnostics: SourceDiagnostic[];
  }>;
  dispose(): void;
}

interface TypeScriptDiagnosticLike {
  code: number;
  category: number;
  messageText: string | { messageText: string; next?: TypeScriptDiagnosticLike["messageText"][] };
  start?: number;
  length?: number;
}

export interface EditorDependencies {
  configureWorkers(): Promise<() => void> | (() => void);
  loadMonaco(): Promise<MonacoApi>;
}

export function createCompilerOptions(
  typescript: MonacoTypeScriptEnums,
): CompilerOptions {
  return {
    allowNonTsExtensions: true,
    baseUrl: "file:///",
    lib: ["es2022"],
    module: typescript.ModuleKind.ESNext,
    moduleResolution: typescript.ModuleResolutionKind.NodeJs,
    noEmit: true,
    paths: createModulePaths(),
    strict: true,
    target: typescript.ScriptTarget.ESNext,
    typeRoots: ["file:///node_modules/@types"],
    types: ["node"],
  };
}

export function createTypeScriptEnvironment(
  libraries: readonly TypeLibrary[] = getTypeLibraries(),
  typescript: MonacoTypeScriptEnums = {
    ModuleKind: { ESNext: 99 },
    ModuleResolutionKind: { NodeJs: 2 },
    ScriptTarget: { ESNext: 99 },
  },
): TypeScriptEnvironment {
  return {
    compilerOptions: createCompilerOptions(typescript),
    extraLibs: libraries.map(({ content, filePath }) => ({
      content,
      filePath,
    })),
  };
}

export async function initializeEditor(
  container: HTMLElement,
  options: InitializeEditorOptions = {},
  dependencies: EditorDependencies = defaultEditorDependencies,
): Promise<PlaygroundEditor> {
  const releaseWorkers = await dependencies.configureWorkers();
  try {
    const monaco = await dependencies.loadMonaco();
    const editor = createEditor(monaco, container, options);
    return withDispose(editor, releaseWorkers);
  } catch (error) {
    releaseWorkers();
    throw error;
  }
}

export function createEditor(
  monaco: MonacoApi,
  container: HTMLElement,
  options: InitializeEditorOptions = {},
): PlaygroundEditor {
  const typescript = monaco.typescript;
  const environment = createTypeScriptEnvironment(
    getTypeLibraries(),
    typescript,
  );
  const releaseTypeScriptDefaults = retainTypeScriptDefaults(
    typescript,
    environment,
  );
  const uri = monaco.Uri.parse(
    `file:///playground/${++editorId}/hooks.config.ts`,
  );
  let model: Monaco.editor.ITextModel | undefined;
  let editor: Monaco.editor.IStandaloneCodeEditor | undefined;
  let markerDisposable: Monaco.IDisposable | undefined;
  try {
    model = monaco.editor.createModel(
      options.source ?? starterSource,
      "typescript",
      uri,
    );
    editor = monaco.editor.create(container, {
      automaticLayout: true,
      minimap: { enabled: false },
      ...options.editorOptions,
      model,
    });
    const activeModel = model;
    const readMarkers = () =>
      monaco.editor
        .getModelMarkers({ resource: uri })
        .map((marker) =>
          markerToDiagnostic(marker, "hooks.config.ts", activeModel.getValue()),
        );
    const readDiagnostics = async () => {
      const sourceVersion = activeModel.getVersionId();
      const getWorker = typescript.getTypeScriptWorker;
      if (getWorker) {
        const worker = await waitForTypeScriptWorker(getWorker);
        const client = await worker(uri);
        const [syntactic, semantic] = (await Promise.all([
          client.getSyntacticDiagnostics(uri.toString()),
          client.getSemanticDiagnostics(uri.toString()),
        ])) as [TypeScriptDiagnosticLike[], TypeScriptDiagnosticLike[]];
        if (activeModel.getVersionId() !== sourceVersion) {
          return readDiagnostics();
        }
        return {
          sourceVersion,
          diagnostics: [...syntactic, ...semantic].map((diagnostic) =>
            typeScriptDiagnosticToSourceDiagnostic(
              diagnostic,
              "hooks.config.ts",
              activeModel.getValue(),
            ),
          ),
        };
      }
      return { sourceVersion, diagnostics: readMarkers() };
    };
    markerDisposable = monaco.editor.onDidChangeMarkers((resources) => {
      if (
        resources.some((resource) => resource.toString() === uri.toString())
      ) {
        void readDiagnostics().then(({ sourceVersion, diagnostics }) =>
          options.onDiagnostics?.(sourceVersion, diagnostics),
        );
      }
    });
    let disposed = false;

    return {
      editor,
      model,
      getDiagnostics: readDiagnostics,
      dispose() {
        if (disposed) return;
        disposed = true;
        markerDisposable?.dispose();
        editor?.dispose();
        model?.dispose();
        releaseTypeScriptDefaults();
      },
    };
  } catch (error) {
    markerDisposable?.dispose();
    editor?.dispose();
    model?.dispose();
    releaseTypeScriptDefaults();
    throw error;
  }
}

async function waitForTypeScriptWorker(
  getWorker: NonNullable<typeof MonacoTypeScript.getTypeScriptWorker>,
): Promise<Awaited<ReturnType<typeof MonacoTypeScript.getTypeScriptWorker>>> {
  const attempts = 200;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await getWorker();
    } catch (error) {
      if (!isTypeScriptRegistrationError(error) || attempt === attempts - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  throw new Error("TypeScript language service did not register");
}

function isTypeScriptRegistrationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message === "TypeScript not registered!";
}

function retainTypeScriptDefaults(
  typescript: typeof MonacoTypeScript,
  environment: TypeScriptEnvironment,
): () => void {
  const defaults = typescript.typescriptDefaults;
  const existing = sharedTypeScriptDefaults.get(defaults);
  const diagnosticsOptions = {
    noSemanticValidation: false,
    noSyntaxValidation: false,
  };
  if (existing) {
    existing.references += 1;
    return releaseTypeScriptDefaults(defaults, existing);
  }
  const shared: SharedTypeScriptDefaults = {
    references: 0,
    compilerOptions: environment.compilerOptions,
    diagnosticsOptions,
    previousCompilerOptions: defaults.getCompilerOptions(),
    previousDiagnosticsOptions: defaults.getDiagnosticsOptions(),
    disposables: [],
  };
  try {
    for (const { content, filePath } of environment.extraLibs) {
      shared.disposables.push(defaults.addExtraLib(content, filePath));
    }
    defaults.setCompilerOptions(shared.compilerOptions);
    defaults.setDiagnosticsOptions(shared.diagnosticsOptions);
  } catch (error) {
    shared.disposables.forEach((disposable) => disposable.dispose());
    if (defaults.getCompilerOptions() === shared.compilerOptions) {
      defaults.setCompilerOptions(shared.previousCompilerOptions);
    }
    if (defaults.getDiagnosticsOptions() === shared.diagnosticsOptions) {
      defaults.setDiagnosticsOptions(shared.previousDiagnosticsOptions);
    }
    throw error;
  }
  shared.references = 1;
  sharedTypeScriptDefaults.set(defaults, shared);
  return releaseTypeScriptDefaults(defaults, shared);
}

function releaseTypeScriptDefaults(
  defaults: typeof MonacoTypeScript.typescriptDefaults,
  shared: SharedTypeScriptDefaults,
): () => void {
  let released = false;
  return () => {
    if (released) return;
    released = true;
    shared.references -= 1;
    if (shared.references === 0) {
      shared.disposables.forEach((disposable) => disposable.dispose());
      if (defaults.getCompilerOptions() === shared.compilerOptions) {
        defaults.setCompilerOptions(shared.previousCompilerOptions);
      }
      if (defaults.getDiagnosticsOptions() === shared.diagnosticsOptions) {
        defaults.setDiagnosticsOptions(shared.previousDiagnosticsOptions);
      }
      sharedTypeScriptDefaults.delete(defaults);
    }
  };
}

const defaultEditorDependencies: EditorDependencies = {
  async configureWorkers() {
    const { configureMonacoWorkers } = await import("./monaco-workers");
    return configureMonacoWorkers();
  },
  async loadMonaco() {
    const [monaco, typescript] = await Promise.all([
      import("monaco-editor"),
      import("monaco-editor/languages/features/typescript/register.js"),
    ]);
    return { ...monaco, typescript } as MonacoApi;
  },
};

function withDispose(
  editor: PlaygroundEditor,
  release: () => void,
): PlaygroundEditor {
  const disposeEditor = editor.dispose;
  return {
    ...editor,
    dispose() {
      disposeEditor();
      release();
    },
  };
}

export function markerToDiagnostic(
  marker: MarkerLike,
  fileName: string,
  source: string,
): SourceDiagnostic {
  const start = sourcePosition(
    source,
    marker.startLineNumber,
    marker.startColumn,
  );
  const end = sourcePosition(source, marker.endLineNumber, marker.endColumn);
  const code =
    typeof marker.code === "object" ? marker.code.value : marker.code;
  return {
    code: code ?? "MONACO_TYPESCRIPT",
    severity: marker.severity >= 8 ? "error" : "warning",
    message: marker.message,
    sourceLine: source.split(/\r?\n/)[marker.startLineNumber - 1] ?? "",
    fileName,
    start,
    end,
  };
}

function typeScriptDiagnosticToSourceDiagnostic(
  diagnostic: TypeScriptDiagnosticLike,
  fileName: string,
  source: string,
): SourceDiagnostic {
  const startOffset = diagnostic.start ?? 0;
  const endOffset = startOffset + (diagnostic.length ?? 0);
  return {
    code: String(diagnostic.code),
    severity: diagnostic.category === 1 ? "error" : "warning",
    message: flattenDiagnosticMessage(diagnostic.messageText),
    sourceLine: source.split(/\r?\n/)[positionFromOffset(source, startOffset).line - 1] ?? "",
    fileName,
    start: positionFromOffset(source, startOffset),
    end: positionFromOffset(source, endOffset),
  };
}

function flattenDiagnosticMessage(message: TypeScriptDiagnosticLike["messageText"]): string {
  if (typeof message === "string") return message;
  const next = message.next?.map(flattenDiagnosticMessage) ?? [];
  return [message.messageText, ...next].join("\n");
}

function positionFromOffset(source: string, offset: number) {
  const before = source.slice(0, offset);
  const lines = before.split(/\r?\n/);
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1, offset };
}

function createModulePaths(): Record<string, string[]> {
  return {
    "@typed-rocks/typed-claude-hooks": ["node_modules/@typed-rocks/typed-claude-hooks/index.d.ts"],
    "@typed-rocks/typed-claude-hooks/types": [
      "node_modules/@typed-rocks/typed-claude-hooks/types/index.d.ts",
    ],
    "undici-types": ["node_modules/undici-types/index.d.ts"],
    "undici-types/*": ["node_modules/undici-types/*"],
  };
}

function sourcePosition(source: string, line: number, column: number) {
  const lines = source.split(/(?<=\n)/);
  const offset =
    lines.slice(0, Math.max(0, line - 1)).join("").length + column - 1;
  return { line, column, offset };
}
