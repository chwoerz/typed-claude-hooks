import type {
  CompileRequest,
  CompileResponse,
  HandlerMetadata,
  PlaygroundArtifact,
  PlaygroundSettings,
  SourceDiagnostic,
} from "./compiler/types";
import { starterSource } from "./starter";

export type PlaygroundStatus =
  | "loading"
  | "building"
  | "valid"
  | "error"
  | "init-failure";

export interface PlaygroundSnapshot {
  status: PlaygroundStatus;
  source: string;
  diagnostics: SourceDiagnostic[];
  handlers: HandlerMetadata[];
  settings: PlaygroundSettings;
  artifacts: PlaygroundArtifact[];
  canDownload: boolean;
  initializationError?: string;
}

type MessageListener = (event: MessageEvent<CompileResponse>) => void;
type ErrorListener = (event: ErrorEvent) => void;

export interface WorkerLike {
  postMessage(request: CompileRequest): void;
  addEventListener(type: "message", listener: MessageListener): void;
  addEventListener(type: "error", listener: ErrorListener): void;
  removeEventListener(type: "message", listener: MessageListener): void;
  removeEventListener(type: "error", listener: ErrorListener): void;
  terminate?(): void;
}

export interface ControllerTimers {
  setTimeout(callback: () => void, delay: number): unknown;
  clearTimeout(timer: unknown): void;
}

export interface PlaygroundControllerOptions {
  createWorker(): WorkerLike;
  source?: string;
  debounceMs?: number;
  timers?: ControllerTimers;
}

export interface PlaygroundController {
  getSnapshot(): PlaygroundSnapshot;
  subscribe(listener: () => void): () => void;
  updateSource(source: string, sourceVersion?: number): void;
  updateDiagnostics(sourceVersion: number, diagnostics: SourceDiagnostic[]): void;
  reset(sourceVersion?: number): void;
  retry(): void;
  dispose(): void;
}

const emptySettings: PlaygroundSettings = { hooks: {} };

export function createPlaygroundController(
  options: PlaygroundControllerOptions,
): PlaygroundController {
  const debounceMs = options.debounceMs ?? 300;
  const timers = options.timers ?? defaultTimers;
  const listeners = new Set<() => void>();
  let source = options.source ?? starterSource;
  let sourceVersion = 1;
  let settledDiagnosticsVersion: number | undefined;
  let workerStatus: PlaygroundStatus = "loading";
  let editorDiagnostics: SourceDiagnostic[] = [];
  let workerDiagnostics: SourceDiagnostic[] = [];
  let handlers: HandlerMetadata[] = [];
  let settings = emptySettings;
  let artifacts: PlaygroundArtifact[] = [];
  let initializationError: string | undefined;
  let latestRequestId = 0;
  let timer: unknown;
  let worker: WorkerLike | undefined;
  let disposed = false;

  const notify = () => listeners.forEach((listener) => listener());
  const clearBuildTimer = () => {
    if (timer !== undefined) timers.clearTimeout(timer);
    timer = undefined;
  };
  const diagnostics = () =>
    mergeDiagnostics(editorDiagnostics, workerDiagnostics);
  const hasErrors = () =>
    diagnostics().some(({ severity }) => severity === "error");
  const diagnosticsSettled = () => settledDiagnosticsVersion === sourceVersion;
  const status = (): PlaygroundStatus => {
    if (workerStatus !== "valid") return workerStatus;
    return !diagnosticsSettled() || hasErrors() || handlers.length === 0 || artifacts.length === 0
      ? "error"
      : "valid";
  };
  const snapshot = (): PlaygroundSnapshot => ({
    status: status(),
    source,
    diagnostics: diagnostics(),
    handlers,
    settings,
    artifacts,
    canDownload:
      workerStatus === "valid" &&
      diagnosticsSettled() &&
      !hasErrors() &&
      handlers.length > 0 &&
      artifacts.length > 0,
    ...(initializationError ? { initializationError } : {}),
  });
  const detachWorker = () => {
    worker?.removeEventListener("message", onMessage);
    worker?.removeEventListener("error", onError);
    worker?.terminate?.();
    worker = undefined;
  };
  const onMessage: MessageListener = ({ data }) => {
    if (
      disposed ||
      data.type !== "compile-result" ||
      data.requestId !== latestRequestId
    ) {
      return;
    }
    workerDiagnostics = data.diagnostics;
    handlers = data.handlers;
    settings = data.settings;
    artifacts = data.artifacts;
    initializationError = undefined;
    const initializationDiagnostic = data.diagnostics.find(
      ({ code }) => code === "PLAYGROUND_INITIALIZATION_FAILED",
    );
    if (initializationDiagnostic) {
      workerStatus = "init-failure";
      initializationError = initializationDiagnostic.message;
    } else {
      workerStatus = data.status === "error" ? "error" : "valid";
    }
    notify();
  };
  const onError: ErrorListener = (event) => {
    if (disposed) return;
    clearBuildTimer();
    latestRequestId += 1;
    detachWorker();
    workerStatus = "init-failure";
    initializationError = event.error?.message ?? event.message;
    handlers = [];
    artifacts = [];
    settings = emptySettings;
    notify();
  };
  const attachWorker = () => {
    try {
      worker = options.createWorker();
      worker.addEventListener("message", onMessage);
      worker.addEventListener("error", onError);
    } catch (error) {
      workerStatus = "init-failure";
      initializationError =
        error instanceof Error ? error.message : String(error);
    }
  };
  const scheduleBuild = () => {
    clearBuildTimer();
    const requestId = ++latestRequestId;
    timer = timers.setTimeout(() => {
      timer = undefined;
      if (disposed || !worker) return;
      workerStatus = "building";
      notify();
      worker.postMessage({ type: "compile", requestId, source });
    }, debounceMs);
  };

  attachWorker();
  if (worker) scheduleBuild();

  return {
    getSnapshot: snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    updateSource(nextSource, nextSourceVersion) {
      if (disposed) return;
      source = nextSource;
      sourceVersion = nextSourceVersion ?? sourceVersion + 1;
      settledDiagnosticsVersion = undefined;
      editorDiagnostics = [];
      workerDiagnostics = [];
      handlers = [];
      settings = emptySettings;
      artifacts = [];
      workerStatus = worker ? "loading" : "init-failure";
      if (worker) scheduleBuild();
      notify();
    },
    updateDiagnostics(diagnosticsSourceVersion, nextDiagnostics) {
      if (disposed || diagnosticsSourceVersion !== sourceVersion) return;
      editorDiagnostics = nextDiagnostics;
      settledDiagnosticsVersion = diagnosticsSourceVersion;
      notify();
    },
    reset(resetSourceVersion) {
      this.updateSource(starterSource, resetSourceVersion);
    },
    retry() {
      if (disposed) return;
      clearBuildTimer();
      detachWorker();
      initializationError = undefined;
      workerDiagnostics = [];
      workerStatus = "loading";
      attachWorker();
      if (worker) scheduleBuild();
      notify();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      clearBuildTimer();
      detachWorker();
      listeners.clear();
    },
  };
}

function mergeDiagnostics(
  editorDiagnostics: SourceDiagnostic[],
  workerDiagnostics: SourceDiagnostic[],
): SourceDiagnostic[] {
  const seen = new Set<string>();
  return [...editorDiagnostics, ...workerDiagnostics].filter((diagnostic) => {
    const key = [
      diagnostic.code,
      diagnostic.message,
      diagnostic.fileName,
      diagnostic.start.offset,
      diagnostic.end.offset,
    ].join(":");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const defaultTimers: ControllerTimers = {
  setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay),
  clearTimeout: (timer) => globalThis.clearTimeout(timer as number),
};
