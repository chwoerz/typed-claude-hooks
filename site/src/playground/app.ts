import type { PlaygroundController, PlaygroundSnapshot } from "./controller";
import { createPlaygroundController } from "./controller";
import type { SourceDiagnostic } from "./compiler/types";
import { initializeEditor, type PlaygroundEditor } from "./editor";
import { createPlaygroundReadme } from "./readme";
import { starterSource } from "./starter";
import { createPlaygroundZip, downloadPlaygroundZip } from "./zip";

export interface PlaygroundAppState {
  snapshot: PlaygroundSnapshot;
  editor?: PlaygroundEditor;
  editorInitializationError?: string;
}

export interface PlaygroundViewState {
  status: string;
  statusKind: PlaygroundSnapshot["status"];
  diagnostics: SourceDiagnostic[];
  initializationError?: string;
  retryVisible: boolean;
  canDownload: boolean;
}

export interface CreatePlaygroundAppOptions {
  controller: PlaygroundController;
  initializeEditor(): Promise<PlaygroundEditor>;
  render(state: PlaygroundAppState): void;
}

export interface PlaygroundApp {
  start(): Promise<void>;
  retry(): Promise<void>;
  reset(): void;
  getState(): PlaygroundAppState;
  dispose(): void;
}

export function createPlaygroundApp(
  options: CreatePlaygroundAppOptions,
): PlaygroundApp {
  const { controller } = options;
  let editor: PlaygroundEditor | undefined;
  let contentListener: { dispose(): void } | undefined;
  let editorInitializationError: string | undefined;
  let settingModelValue = false;
  let initialization: Promise<void> | undefined;
  let unsubscribe: (() => void) | undefined;
  let started = false;
  let disposed = false;

  const state = (): PlaygroundAppState => ({
    snapshot: controller.getSnapshot(),
    ...(editor ? { editor } : {}),
    ...(editorInitializationError ? { editorInitializationError } : {}),
  });
  const render = () => options.render(state());
  const refreshDiagnostics = async (activeEditor: PlaygroundEditor) => {
    const { sourceVersion, diagnostics } = await activeEditor.getDiagnostics();
    if (!disposed) controller.updateDiagnostics(sourceVersion, diagnostics);
  };
  const initialize = (): Promise<void> => {
    if (disposed || editor) return Promise.resolve();
    if (initialization) return initialization;
    initialization = (async () => {
      let candidate: PlaygroundEditor | undefined;
      try {
        candidate = await options.initializeEditor();
        if (disposed) {
          candidate.dispose();
          return;
        }
        const activeEditor = candidate;
        const listener = activeEditor.model.onDidChangeContent(() => {
          if (!settingModelValue) {
            controller.updateSource(
              activeEditor.model.getValue(),
              activeEditor.model.getVersionId(),
            );
            void refreshDiagnostics(activeEditor);
          }
        });
        await refreshDiagnostics(activeEditor);
        editor = activeEditor;
        contentListener = listener;
        editorInitializationError = undefined;
      } catch (error) {
        candidate?.dispose();
        editorInitializationError = errorMessage(error);
      } finally {
        initialization = undefined;
        if (!disposed) render();
      }
    })();
    return initialization;
  };

  return {
    async start() {
      if (disposed || started) return;
      started = true;
      unsubscribe = controller.subscribe(render);
      render();
      await initialize();
    },
    async retry() {
      if (disposed) return;
      if (controller.getSnapshot().status === "init-failure") {
        controller.retry();
      }
      await initialize();
    },
    reset() {
      if (disposed) return;
      if (!editor) {
        controller.reset();
        return;
      }
      if (editor.model.getValue() !== starterSource) {
        settingModelValue = true;
        try {
          editor.model.setValue(starterSource);
        } finally {
          settingModelValue = false;
        }
      }
      controller.reset(editor.model.getVersionId());
      void refreshDiagnostics(editor);
    },
    getState: state,
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe?.();
      contentListener?.dispose();
      editor?.dispose();
      controller.dispose();
      unsubscribe = undefined;
      contentListener = undefined;
      editor = undefined;
    },
  };
}

export function createPlaygroundViewState(
  state: PlaygroundAppState,
): PlaygroundViewState {
  const { snapshot, editorInitializationError } = state;
  if (editorInitializationError) {
    const position = { line: 1, column: 1, offset: 0 };
    return {
      status: "Editor initialization failed",
      statusKind: "init-failure",
      diagnostics: [
        {
          code: "PLAYGROUND_EDITOR_INITIALIZATION_FAILED",
          severity: "error",
          message: editorInitializationError,
          fileName: "hooks.config.ts",
          start: position,
          end: position,
        },
        ...snapshot.diagnostics,
      ],
      initializationError: editorInitializationError,
      retryVisible: true,
      canDownload: false,
    };
  }
  return {
    status: statusLabel(snapshot.status),
    statusKind: snapshot.status,
    diagnostics: snapshot.diagnostics,
    ...(snapshot.initializationError
      ? { initializationError: snapshot.initializationError }
      : {}),
    retryVisible: snapshot.status === "init-failure",
    canDownload: snapshot.canDownload && Boolean(state.editor),
  };
}

export async function initializePlayground(root: HTMLElement): Promise<void> {
  const editorContainer = requiredElement<HTMLElement>(root, "editor");
  const resetButton = requiredAction(root, "reset");
  const downloadButton = requiredAction(root, "download");
  const retryButton = requiredAction(root, "retry");
  const controller = createPlaygroundController({
    createWorker: () =>
      new Worker(new URL("./compiler/compiler.worker.ts", import.meta.url), {
        type: "module",
      }),
  });
  const app = createPlaygroundApp({
    controller,
    initializeEditor: () =>
      initializeEditor(editorContainer, {
        source: controller.getSnapshot().source,
        editorOptions: {
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          fontSize: 14,
          lineHeight: 22,
          padding: { top: 16 },
          scrollBeyondLastLine: false,
          theme: "vs-dark",
        },
        onDiagnostics: (sourceVersion, diagnostics) =>
          controller.updateDiagnostics(sourceVersion, diagnostics),
      }),
    render: (state) => renderPlaygroundState(root, state),
  });
  const onReset = () => {
    if (
      !globalThis.confirm(
        "Reset the editor to the starter hook? Your current source will be lost.",
      )
    )
      return;
    app.reset();
  };
  const onDownload = () => {
    const state = app.getState();
    const snapshot = state.snapshot;
    if (!createPlaygroundViewState(state).canDownload) return;
    downloadPlaygroundZip(
      createPlaygroundZip(
        snapshot.source,
        snapshot.settings,
        snapshot.artifacts,
      ),
    );
  };
  const onRetry = () => void app.retry();
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    app.dispose();
    resetButton.removeEventListener("click", onReset);
    downloadButton.removeEventListener("click", onDownload);
    retryButton.removeEventListener("click", onRetry);
    globalThis.removeEventListener("beforeunload", dispose);
  };

  resetButton.addEventListener("click", onReset);
  downloadButton.addEventListener("click", onDownload);
  retryButton.addEventListener("click", onRetry);
  globalThis.addEventListener("beforeunload", dispose, { once: true });
  await app.start();
}

export function renderPlaygroundState(
  root: HTMLElement,
  state: PlaygroundAppState,
): void {
  const { snapshot, editor } = state;
  const loading = root.querySelector<HTMLElement>(
    '[data-playground="editor-loading"]',
  );
  if (editor) loading?.remove();
  const view = createPlaygroundViewState(state);
  const status = requiredElement(root, "status");
  const statusDot = requiredElement(root, "status-dot");
  const count = view.diagnostics.length;
  status.textContent = view.status;
  statusDot.dataset.status = view.statusKind;
  requiredElement(root, "diagnostic-count").textContent =
    `${count} ${count === 1 ? "diagnostic" : "diagnostics"}`;
  requiredElement(root, "diagnostic-badge").textContent = String(count);

  const initializationError = requiredElement(root, "init-error");
  const retryButton = requiredAction(root, "retry");
  initializationError.hidden = !view.initializationError;
  initializationError.textContent = view.initializationError ?? "";
  retryButton.hidden = !view.retryVisible;
  requiredAction(root, "download").disabled = !view.canDownload;

  renderDiagnostics(
    requiredElement(root, "diagnostics"),
    view.diagnostics,
    editor,
  );
  renderHandlers(requiredElement(root, "handlers"), snapshot);
  requiredElement(root, "settings").textContent = JSON.stringify(
    { hooks: snapshot.settings.hooks },
    null,
    2,
  );
  renderFiles(requiredElement(root, "files"), snapshot);
}

function renderDiagnostics(
  list: HTMLElement,
  diagnostics: SourceDiagnostic[],
  editor?: PlaygroundEditor,
): void {
  list.replaceChildren();
  if (diagnostics.length === 0) {
    list.append(emptyItem("No diagnostics."));
    return;
  }
  diagnostics.forEach((diagnostic) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = `diagnostic diagnostic--${diagnostic.severity}`;
    button.textContent = `${diagnostic.fileName}:${diagnostic.start.line}:${diagnostic.start.column} ${diagnostic.message}`;
    button.addEventListener("click", () => {
      if (!editor) return;
      editor.editor.setPosition({
        lineNumber: diagnostic.start.line,
        column: diagnostic.start.column,
      });
      editor.editor.revealLineInCenter(diagnostic.start.line);
      editor.editor.focus();
    });
    item.append(button);
    list.append(item);
  });
}

function renderHandlers(list: HTMLElement, snapshot: PlaygroundSnapshot): void {
  list.replaceChildren();
  if (snapshot.handlers.length === 0) {
    list.append(emptyItem("No handlers discovered."));
    return;
  }
  snapshot.handlers.forEach(({ name, event, matcher }) => {
    const item = document.createElement("li");
    const handlerName = document.createElement("strong");
    const metadata = document.createElement("span");
    handlerName.textContent = name;
    metadata.textContent = matcher ? `${event} / ${matcher}` : event;
    item.append(handlerName, metadata);
    list.append(item);
  });
}

function renderFiles(list: HTMLElement, snapshot: PlaygroundSnapshot): void {
  list.replaceChildren();
  const settings = `${JSON.stringify({ hooks: snapshot.settings.hooks }, null, 2)}\n`;
  const files = [
    { path: "hooks.config.ts", contents: snapshot.source },
    { path: "settings.hooks.snippet.json", contents: settings },
    { path: "README.txt", contents: createPlaygroundReadme(snapshot.settings) },
    ...snapshot.artifacts.flatMap((artifact) => [
      { path: artifact.filePath, contents: artifact.contents },
      { path: artifact.wrapper.filePath, contents: artifact.wrapper.contents },
    ]),
  ];
  files.forEach(({ path, contents }) => {
    const item = document.createElement("li");
    const filePath = document.createElement("code");
    const size = document.createElement("span");
    filePath.textContent = path;
    size.textContent = formatBytes(
      new TextEncoder().encode(contents).byteLength,
    );
    item.append(filePath, size);
    list.append(item);
  });
}

function requiredElement<T extends HTMLElement>(
  root: HTMLElement,
  name: string,
): T {
  const element = root.querySelector<T>(`[data-playground="${name}"]`);
  if (!element) throw new Error(`Missing playground element: ${name}`);
  return element;
}

function requiredAction(root: HTMLElement, name: string): HTMLButtonElement {
  const element = root.querySelector<HTMLButtonElement>(
    `[data-action="${name}"]`,
  );
  if (!element) throw new Error(`Missing playground action: ${name}`);
  return element;
}

function emptyItem(message: string): HTMLLIElement {
  const item = document.createElement("li");
  item.className = "empty-state";
  item.textContent = message;
  return item;
}

function statusLabel(status: PlaygroundSnapshot["status"]): string {
  return {
    loading: "Loading compiler",
    building: "Building hooks",
    valid: "Build valid",
    error: "Build has errors",
    "init-failure": "Compiler initialization failed",
  }[status];
}

function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
