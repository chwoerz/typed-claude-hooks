import { describe, expect, it, vi } from "vitest";
import {
  createPlaygroundApp,
  createPlaygroundViewState,
  renderPlaygroundState,
  type PlaygroundAppState,
} from "../src/playground/app";
import type {
  PlaygroundController,
  PlaygroundSnapshot,
  WorkerLike,
} from "../src/playground/controller";
import { createPlaygroundController } from "../src/playground/controller";
import type { CompileRequest, CompileResponse, SourceDiagnostic } from "../src/playground/compiler/types";
import type { PlaygroundEditor } from "../src/playground/editor";

describe("playground app", () => {
  it("never enables download before diagnostics for the edited model version settle", async () => {
    vi.useFakeTimers();
    const worker = createWorker();
    const controller = createPlaygroundController({ createWorker: () => worker, debounceMs: 1 });
    const editor = createVersionedEditor();
    const app = createPlaygroundApp({
      controller,
      initializeEditor: async () => editor.editor,
      render: vi.fn(),
    });
    await app.start();

    editor.changeSource("const unresolved = missingName");
    vi.advanceTimersByTime(1);
    worker.respond(successResponse(worker.requests.at(-1)?.requestId ?? 0));
    expect(createPlaygroundViewState(app.getState()).canDownload).toBe(false);

    editor.settle([diagnostic("2304", "Cannot find name 'missingName'.")]);
    await vi.waitFor(() => expect(app.getState().snapshot.diagnostics).toHaveLength(1));
    expect(createPlaygroundViewState(app.getState()).canDownload).toBe(false);

    editor.changeSource("const resolved = 1");
    vi.advanceTimersByTime(1);
    worker.respond(successResponse(worker.requests.at(-1)?.requestId ?? 0));
    expect(createPlaygroundViewState(app.getState()).canDownload).toBe(false);
    editor.settle([]);
    await vi.waitFor(() => expect(createPlaygroundViewState(app.getState()).canDownload).toBe(true));

    app.dispose();
    vi.useRealTimers();
  });

  it("settles diagnostics for the Monaco version created by reset", async () => {
    const controller = createController(validSnapshot());
    const editor = createEditor();
    const app = createPlaygroundApp({
      controller,
      initializeEditor: async () => editor.editor,
      render: vi.fn(),
    });
    await app.start();

    app.reset();
    await vi.waitFor(() =>
      expect(controller.updatedDiagnostics.at(-1)).toEqual({
        sourceVersion: 2,
        diagnostics: [],
      }),
    );

    expect(controller.reset).toHaveBeenCalledWith(2);
    app.dispose();
  });
  it("keeps editor initialization failure authoritative across controller renders", async () => {
    const controller = createController(validSnapshot());
    const states: PlaygroundAppState[] = [];
    const app = createPlaygroundApp({
      controller,
      initializeEditor: vi.fn().mockRejectedValue(new Error("Monaco unavailable")),
      render: (state) => states.push(state),
    });

    await app.start();
    controller.emit({ ...validSnapshot(), status: "building", canDownload: false });
    controller.emit(validSnapshot());

    expect(states.at(-1)?.editorInitializationError).toBe("Monaco unavailable");
    expect(states.at(-1)?.snapshot.canDownload).toBe(true);
    expect(states.at(-1)?.editor).toBeUndefined();
    const view = createPlaygroundViewState(states.at(-1) as PlaygroundAppState);
    expect(view).toMatchObject({
      status: "Editor initialization failed",
      statusKind: "init-failure",
      initializationError: "Monaco unavailable",
      retryVisible: true,
      canDownload: false,
    });
    expect(view.diagnostics[0]).toMatchObject({
      code: "PLAYGROUND_EDITOR_INITIALIZATION_FAILED",
      severity: "error",
      message: "Monaco unavailable",
    });
    app.dispose();
  });

  it("retries editor initialization and wires one content listener after success", async () => {
    const controller = createController(validSnapshot());
    const editor = createEditor();
    const initializeEditor = vi
      .fn()
      .mockRejectedValueOnce(new Error("first failure"))
      .mockResolvedValueOnce(editor.editor);
    const states: PlaygroundAppState[] = [];
    const app = createPlaygroundApp({
      controller,
      initializeEditor,
      render: (state) => states.push(state),
    });

    await app.start();
    await app.retry();
    editor.changeSource("updated source");
    await vi.waitFor(() => expect(controller.updatedSources).toEqual(["updated source"]));

    expect(initializeEditor).toHaveBeenCalledTimes(2);
    expect(editor.listenerCount()).toBe(1);
    expect(controller.updatedSources).toEqual(["updated source"]);
    expect(controller.updatedDiagnostics).toEqual([
      { sourceVersion: 1, diagnostics: [] },
      { sourceVersion: 2, diagnostics: [] },
    ]);
    expect(states.at(-1)?.editorInitializationError).toBeUndefined();
    expect(states.at(-1)?.editor).toBe(editor.editor);
    app.dispose();
  });

  it("retries the worker only when its initialization also failed", async () => {
    const controller = createController({
      ...validSnapshot(),
      status: "init-failure",
      canDownload: false,
      initializationError: "worker failed",
    });
    const editor = createEditor();
    const app = createPlaygroundApp({
      controller,
      initializeEditor: vi
        .fn()
        .mockRejectedValueOnce(new Error("editor failed"))
        .mockResolvedValueOnce(editor.editor),
      render: vi.fn(),
    });

    await app.start();
    await app.retry();

    expect(controller.retry).toHaveBeenCalledOnce();
    expect(editor.listenerCount()).toBe(1);
    app.dispose();
  });

  it("cleans partial initialization and is safe to dispose repeatedly", async () => {
    const controller = createController(validSnapshot());
    const editor = createEditor({ failListener: true });
    const app = createPlaygroundApp({
      controller,
      initializeEditor: vi.fn().mockResolvedValue(editor.editor),
      render: vi.fn(),
    });

    await app.start();
    app.dispose();
    app.dispose();

    expect(editor.editor.dispose).toHaveBeenCalledOnce();
    expect(controller.dispose).toHaveBeenCalledOnce();
  });

  it("renders editor failure into disabled controls and a visible retry", () => {
    const dom = createDom();
    vi.stubGlobal("document", dom.document);

    renderPlaygroundState(dom.root as unknown as HTMLElement, {
      snapshot: validSnapshot(),
      editorInitializationError: "Monaco unavailable",
    });

    expect(dom.elements.status.textContent).toBe("Editor initialization failed");
    expect(dom.elements["init-error"].textContent).toBe("Monaco unavailable");
    expect(dom.elements["init-error"].hidden).toBe(false);
    expect(dom.actions.retry.hidden).toBe(false);
    expect(dom.actions.download.disabled).toBe(true);
    expect(dom.elements.diagnostics.children[0]?.children[0]?.textContent).toContain(
      "Monaco unavailable",
    );
    vi.unstubAllGlobals();
  });
});

function validSnapshot(): PlaygroundSnapshot {
  return {
    status: "valid",
    source: "source",
    diagnostics: [],
    handlers: [{ name: "handler", event: "PreToolUse" }],
    settings: { hooks: {} },
    artifacts: [
      {
        name: "handler",
        event: "PreToolUse",
        fileName: "handler.mjs",
        filePath: ".claude/hooks/typed-claude-hooks/PreToolUse/handler.mjs",
        contents: "bundle",
        wrapper: {
          filePath: ".claude/hooks/typed-claude-hooks/PreToolUse/handler.sh",
          contents: "wrapper",
        },
      },
    ],
    canDownload: true,
  };
}

function createVersionedEditor() {
  let source = "source";
  let version = 1;
  let listener: (() => void) | undefined;
  let pending: ((value: { sourceVersion: number; diagnostics: SourceDiagnostic[] }) => void) | undefined;
  const editor = {
    model: {
      getValue: () => source,
      getVersionId: () => version,
      setValue: () => {},
      onDidChangeContent(nextListener: () => void) {
        listener = nextListener;
        return { dispose: () => (listener = undefined) };
      },
    },
    editor: {},
    getDiagnostics: () =>
      version === 1
        ? Promise.resolve({ sourceVersion: 1, diagnostics: [] })
        : new Promise<{ sourceVersion: number; diagnostics: SourceDiagnostic[] }>(
            (resolve) => (pending = resolve),
          ),
    dispose: vi.fn(),
  } as unknown as PlaygroundEditor;
  return {
    editor,
    changeSource(value: string) {
      source = value;
      version += 1;
      listener?.();
    },
    settle(diagnostics: SourceDiagnostic[]) {
      pending?.({ sourceVersion: version, diagnostics });
      pending = undefined;
    },
  };
}

function createWorker() {
  const listeners = new Set<(event: MessageEvent<CompileResponse>) => void>();
  const requests: CompileRequest[] = [];
  return {
    requests,
    postMessage(request: CompileRequest) {
      requests.push(request);
    },
    addEventListener(type: string, listener: (event: MessageEvent<CompileResponse>) => void) {
      if (type === "message") listeners.add(listener);
    },
    removeEventListener(type: string, listener: (event: MessageEvent<CompileResponse>) => void) {
      if (type === "message") listeners.delete(listener);
    },
    terminate() {},
    respond(response: CompileResponse) {
      listeners.forEach((listener) => listener({ data: response } as MessageEvent<CompileResponse>));
    },
  } as unknown as WorkerLike & { requests: CompileRequest[]; respond(response: CompileResponse): void };
}

function successResponse(requestId: string | number): CompileResponse {
  return {
    type: "compile-result",
    requestId,
    status: "success",
    handlers: [{ name: "handler", event: "Stop" }],
    artifacts: [validSnapshot().artifacts[0]],
    diagnostics: [],
    settings: { hooks: {} },
  };
}

function diagnostic(code: string, message: string): SourceDiagnostic {
  const position = { line: 1, column: 1, offset: 0 };
  return { code, message, severity: "error", fileName: "hooks.config.ts", start: position, end: position };
}

function createController(initialSnapshot: PlaygroundSnapshot) {
  let snapshot = initialSnapshot;
  const listeners = new Set<() => void>();
  const controller = {
    updatedSources: [] as string[],
    updatedDiagnostics: [] as Array<{ sourceVersion: number; diagnostics: PlaygroundSnapshot["diagnostics"] }>,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    updateSource(source: string) {
      controller.updatedSources.push(source);
    },
    updateDiagnostics(sourceVersion: number, diagnostics: PlaygroundSnapshot["diagnostics"]) {
      controller.updatedDiagnostics.push({ sourceVersion, diagnostics });
    },
    reset: vi.fn((_sourceVersion?: number) => {}),
    retry: vi.fn(),
    dispose: vi.fn(),
    emit(nextSnapshot: PlaygroundSnapshot) {
      snapshot = nextSnapshot;
      listeners.forEach((listener) => listener());
    },
  } satisfies PlaygroundController & {
    updatedSources: string[];
    updatedDiagnostics: Array<{ sourceVersion: number; diagnostics: PlaygroundSnapshot["diagnostics"] }>;
    emit(snapshot: PlaygroundSnapshot): void;
  };
  return controller;
}

function createEditor(options: { failListener?: boolean } = {}) {
  let source = "source";
  let version = 1;
  let listener: (() => void) | undefined;
  const listenerDisposable = { dispose: vi.fn(() => (listener = undefined)) };
  const editor = {
    model: {
      getValue: () => source,
      getVersionId: () => version,
      setValue: (value: string) => {
        source = value;
        version += 1;
        listener?.();
      },
      onDidChangeContent: vi.fn((nextListener: () => void) => {
        if (options.failListener) throw new Error("listener setup failed");
        listener = nextListener;
        return listenerDisposable;
      }),
    },
    editor: {},
    getDiagnostics: async () => ({ sourceVersion: version, diagnostics: [] }),
    dispose: vi.fn(),
  } as unknown as PlaygroundEditor;
  return {
    editor,
    changeSource(value: string) {
      source = value;
      version += 1;
      listener?.();
    },
    listenerCount: () => (listener ? 1 : 0),
  };
}

function createDom() {
  class FakeElement {
    textContent = "";
    hidden = false;
    disabled = false;
    type = "";
    className = "";
    dataset: Record<string, string> = {};
    children: FakeElement[] = [];
    append(...children: FakeElement[]) {
      this.children.push(...children);
    }
    replaceChildren(...children: FakeElement[]) {
      this.children = children;
    }
    addEventListener() {}
  }
  const names = [
    "status",
    "status-dot",
    "diagnostic-count",
    "diagnostic-badge",
    "init-error",
    "diagnostics",
    "handlers",
    "settings",
    "files",
  ] as const;
  const elements = Object.fromEntries(
    names.map((name) => [name, new FakeElement()]),
  ) as Record<(typeof names)[number], FakeElement>;
  const actions = {
    retry: new FakeElement(),
    download: new FakeElement(),
  };
  return {
    elements,
    actions,
    root: {
      querySelector(selector: string) {
        const playground = selector.match(/data-playground="([^"]+)"/)?.[1];
        const action = selector.match(/data-action="([^"]+)"/)?.[1];
        return playground
          ? elements[playground as keyof typeof elements]
          : actions[action as keyof typeof actions];
      },
    },
    document: { createElement: () => new FakeElement() },
  };
}
