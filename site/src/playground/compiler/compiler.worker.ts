import * as esbuild from "esbuild-wasm";
import wasmUrl from "esbuild-wasm/esbuild.wasm?url";
import { buildHandlers, type EsbuildApi } from "./build-handlers";
import type {
  CompileRequest,
  CompileResponse,
  SourceDiagnostic,
} from "./types";

interface WorkerEsbuildApi extends EsbuildApi {
  initialize(options: { wasmURL: string; worker?: boolean }): Promise<void>;
}

export function createCompiler(api: WorkerEsbuildApi, wasmURL: string) {
  const initialized = api.initialize({ wasmURL, worker: false });
  let active = false;
  let pending:
    | {
        request: CompileRequest;
        resolve(response: CompileResponse): void;
      }
    | undefined;
  const run = async (request: CompileRequest): Promise<CompileResponse> => {
    active = true;
    try {
      try {
        await initialized;
        return await buildHandlers(request, api);
      } catch (error) {
        return initializationError(request, error);
      }
    } finally {
      active = false;
      const next = pending;
      pending = undefined;
      if (next) void run(next.request).then(next.resolve);
    }
  };
  return (request: CompileRequest): Promise<CompileResponse> => {
    if (!active) return run(request);
    return new Promise((resolve) => {
      pending?.resolve(supersededResponse(pending.request));
      pending = { request, resolve };
    });
  };
}

function supersededResponse(request: CompileRequest): CompileResponse {
  return {
    type: "compile-result",
    requestId: request.requestId,
    status: "superseded",
    handlers: [],
    artifacts: [],
    diagnostics: [],
    settings: { hooks: {} },
  };
}

function initializationError(
  request: CompileRequest,
  error: unknown,
): CompileResponse {
  const start = { line: 1, column: 1, offset: 0 };
  const diagnostic: SourceDiagnostic = {
    code: "PLAYGROUND_INITIALIZATION_FAILED",
    severity: "error",
    message: error instanceof Error ? error.message : String(error),
    fileName: request.fileName ?? "hooks.config.ts",
    start,
    end: start,
  };
  return {
    type: "compile-result",
    requestId: request.requestId,
    status: "error",
    handlers: [],
    artifacts: [],
    diagnostics: [diagnostic],
    settings: { hooks: {} },
  };
}

interface CompilerWorkerScope {
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<CompileRequest>) => void,
  ): void;
  postMessage(response: CompileResponse): void;
}

const workerScope =
  typeof document === "undefined" &&
  globalThis.constructor.name === "DedicatedWorkerGlobalScope"
    ? (globalThis as unknown as CompilerWorkerScope)
    : undefined;

if (workerScope) {
  const compile = createCompiler(esbuild, wasmUrl);
  workerScope.addEventListener(
    "message",
    ({ data }: MessageEvent<CompileRequest>) => {
      if (data?.type !== "compile") return;
      void compile(data).then((response) => workerScope.postMessage(response));
    },
  );
}
