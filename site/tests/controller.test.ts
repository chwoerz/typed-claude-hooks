import { describe, expect, it, vi } from "vitest";
import {
  createPlaygroundController,
  type WorkerLike,
} from "../src/playground/controller";
import type {
  CompileRequest,
  CompileResponse,
  PlaygroundArtifact,
  SourceDiagnostic,
} from "../src/playground/compiler/types";
import { starterSource } from "../src/playground/starter";

describe("playground controller", () => {
  it("debounces edits and sends increasing request IDs", () => {
    vi.useFakeTimers();
    const worker = createWorker();
    const controller = createPlaygroundController({
      createWorker: () => worker,
      debounceMs: 100,
    });

    controller.updateSource("first");
    vi.advanceTimersByTime(50);
    controller.updateSource("second");
    vi.advanceTimersByTime(99);
    expect(worker.requests).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(worker.requests).toEqual([
      { type: "compile", requestId: 3, source: "second" },
    ]);
    expect(controller.getSnapshot().status).toBe("building");

    controller.updateSource("third");
    vi.advanceTimersByTime(100);
    expect(worker.requests[1]?.requestId).toBe(4);
    controller.dispose();
    vi.useRealTimers();
  });

  it("ignores old and non-current worker responses", () => {
    vi.useFakeTimers();
    const worker = createWorker();
    const controller = createPlaygroundController({
      createWorker: () => worker,
      debounceMs: 10,
    });
    vi.advanceTimersByTime(10);
    const firstId = worker.requests[0].requestId;
    controller.updateSource("new source");
    worker.respond(success(firstId, "old"));
    expect(controller.getSnapshot().handlers).toEqual([]);

    vi.advanceTimersByTime(10);
    const currentId = worker.requests[1].requestId;
    worker.respond(success(999, "foreign"));
    expect(controller.getSnapshot().status).toBe("building");
    worker.respond(success(currentId, "current"));
    expect(controller.getSnapshot().handlers[0]?.name).toBe("current");
    controller.dispose();
    vi.useRealTimers();
  });

  it("retains newer editor errors when a worker result arrives", () => {
    vi.useFakeTimers();
    const worker = createWorker();
    const controller = createPlaygroundController({
      createWorker: () => worker,
      debounceMs: 10,
    });
    vi.advanceTimersByTime(10);
    const requestId = worker.requests[0].requestId;
    const editorError = diagnostic("TS2304", "editor error");
    controller.updateDiagnostics(1, [editorError]);
    expect(controller.getSnapshot().canDownload).toBe(false);

    worker.respond(success(requestId, "handler"));
    expect(controller.getSnapshot().diagnostics).toContainEqual(editorError);
    expect(controller.getSnapshot().canDownload).toBe(false);
    controller.dispose();
    vi.useRealTimers();
  });

  it("waits for diagnostics for the current source version before enabling download", () => {
    vi.useFakeTimers();
    const worker = createWorker();
    const controller = createPlaygroundController({
      createWorker: () => worker,
      debounceMs: 10,
    });

    controller.updateDiagnostics(1, []);
    controller.updateSource("const unresolved = missingName", 2);
    vi.advanceTimersByTime(10);
    worker.respond(success(worker.requests[0].requestId, "handler"));

    expect(controller.getSnapshot().canDownload).toBe(false);
    controller.updateDiagnostics(1, []);
    expect(controller.getSnapshot().canDownload).toBe(false);
    controller.updateDiagnostics(2, [diagnostic("TS2304", "Cannot find name 'missingName'.")]);
    expect(controller.getSnapshot().canDownload).toBe(false);

    controller.updateSource("const resolved = 1", 3);
    vi.advanceTimersByTime(10);
    worker.respond(success(worker.requests[1].requestId, "handler"));
    expect(controller.getSnapshot().canDownload).toBe(false);
    controller.updateDiagnostics(3, []);
    expect(controller.getSnapshot()).toMatchObject({ status: "valid", canDownload: true });
    controller.dispose();
    vi.useRealTimers();
  });

  it("does not let editor diagnostics clear a worker build error", () => {
    vi.useFakeTimers();
    const worker = createWorker();
    const controller = createPlaygroundController({
      createWorker: () => worker,
      debounceMs: 10,
    });
    vi.advanceTimersByTime(10);
    worker.respond(
      failed(
        worker.requests[0].requestId,
        diagnostic("BUILD_FAILED", "worker error", "warning"),
        true,
      ),
    );

    controller.updateDiagnostics(1, [diagnostic("TS1", "editor error")]);
    controller.updateDiagnostics(1, []);

    expect(controller.getSnapshot()).toMatchObject({
      status: "error",
      canDownload: false,
    });
    expect(controller.getSnapshot().diagnostics).toContainEqual(
      diagnostic("BUILD_FAILED", "worker error", "warning"),
    );
    controller.dispose();
    vi.useRealTimers();
  });

  it("enforces every download eligibility rule", () => {
    vi.useFakeTimers();
    const worker = createWorker();
    const controller = createPlaygroundController({
      createWorker: () => worker,
      debounceMs: 10,
    });
    expect(controller.getSnapshot()).toMatchObject({
      status: "loading",
      canDownload: false,
    });
    vi.advanceTimersByTime(10);
    expect(controller.getSnapshot()).toMatchObject({
      status: "building",
      canDownload: false,
    });
    const requestId = worker.requests[0].requestId;
    controller.updateDiagnostics(1, []);
    worker.respond(success(requestId, "handler"));
    expect(controller.getSnapshot()).toMatchObject({
      status: "valid",
      canDownload: true,
    });
    controller.updateDiagnostics(1, [diagnostic("TS1", "bad")]);
    expect(controller.getSnapshot().canDownload).toBe(false);
    controller.updateDiagnostics(1, []);
    expect(controller.getSnapshot().canDownload).toBe(true);

    controller.updateSource("empty");
    vi.advanceTimersByTime(10);
    worker.respond(empty(worker.requests[1].requestId));
    expect(controller.getSnapshot()).toMatchObject({
      status: "error",
      canDownload: false,
    });
    controller.dispose();
    vi.useRealTimers();
  });

  it.each([
    ["no handlers", empty],
    ["no artifacts", noArtifacts],
    [
      "worker error",
      (requestId: string | number) =>
        failed(requestId, diagnostic("BUILD_FAILED", "failed"), true),
    ],
  ])("disables download independently for %s", (_case, response) => {
    vi.useFakeTimers();
    const worker = createWorker();
    const controller = createPlaygroundController({
      createWorker: () => worker,
      debounceMs: 10,
    });
    vi.advanceTimersByTime(10);
    worker.respond(response(worker.requests[0].requestId));
    expect(controller.getSnapshot().canDownload).toBe(false);
    controller.dispose();
    vi.useRealTimers();
  });

  it("notifies subscribers for source, build, and result transitions", () => {
    vi.useFakeTimers();
    const worker = createWorker();
    const controller = createPlaygroundController({
      createWorker: () => worker,
      debounceMs: 10,
    });
    const snapshots: string[] = [];
    controller.subscribe(() => snapshots.push(controller.getSnapshot().status));

    controller.updateSource("changed");
    controller.updateDiagnostics(2, []);
    vi.advanceTimersByTime(10);
    worker.respond(success(worker.requests[0].requestId, "handler"));

    expect(snapshots).toEqual(["loading", "loading", "building", "valid"]);
    controller.dispose();
    vi.useRealTimers();
  });

  it("resets to the starter without confirmation or persistence", () => {
    vi.useFakeTimers();
    const worker = createWorker();
    const controller = createPlaygroundController({
      createWorker: () => worker,
      debounceMs: 10,
      source: "custom",
    });
    controller.reset();
    expect(controller.getSnapshot().source).toBe(starterSource);
    vi.advanceTimersByTime(10);
    expect(worker.requests).toEqual([
      { type: "compile", requestId: 2, source: starterSource },
    ]);
    controller.dispose();
    vi.useRealTimers();
  });

  it("reports initialization failure and retries with a new worker", () => {
    vi.useFakeTimers();
    const first = createWorker();
    const second = createWorker();
    const workers = [first, second];
    const controller = createPlaygroundController({
      createWorker: () => workers.shift() as TestWorker,
      debounceMs: 10,
    });
    first.fail(new Error("WASM unavailable"));
    expect(controller.getSnapshot()).toMatchObject({
      status: "init-failure",
      canDownload: false,
      initializationError: "WASM unavailable",
    });

    controller.retry();
    expect(first.terminated).toBe(true);
    expect(controller.getSnapshot().status).toBe("loading");
    vi.advanceTimersByTime(10);
    expect(second.requests).toHaveLength(1);
    controller.dispose();
    vi.useRealTimers();
  });

  it("stops a fatally failed worker until retry builds the latest source", () => {
    vi.useFakeTimers();
    const first = createWorker();
    const second = createWorker();
    const workers = [first, second];
    const controller = createPlaygroundController({
      createWorker: () => workers.shift() as TestWorker,
      debounceMs: 10,
    });
    vi.advanceTimersByTime(10);
    expect(first.requests).toHaveLength(1);

    first.fail(new Error("worker crashed"));
    controller.updateSource("latest source");
    vi.advanceTimersByTime(20);

    expect(first.terminated).toBe(true);
    expect(first.listenerCount()).toBe(0);
    expect(first.requests).toHaveLength(1);
    expect(controller.getSnapshot()).toMatchObject({
      status: "init-failure",
      source: "latest source",
      initializationError: "worker crashed",
    });

    controller.retry();
    vi.advanceTimersByTime(10);
    expect(second.requests).toEqual([
      expect.objectContaining({ source: "latest source" }),
    ]);
    controller.dispose();
    vi.useRealTimers();
  });

  it("retries after synchronous worker factory creation failure", () => {
    vi.useFakeTimers();
    const worker = createWorker();
    let attempt = 0;
    const controller = createPlaygroundController({
      createWorker: () => {
        attempt += 1;
        if (attempt === 1) throw new Error("worker creation failed");
        return worker;
      },
      debounceMs: 10,
    });
    expect(controller.getSnapshot()).toMatchObject({
      status: "init-failure",
      initializationError: "worker creation failed",
      canDownload: false,
    });

    controller.retry();
    vi.advanceTimersByTime(10);
    controller.updateDiagnostics(1, []);
    worker.respond(success(worker.requests[0].requestId, "recovered"));

    expect(controller.getSnapshot()).toMatchObject({
      status: "valid",
      canDownload: true,
    });
    expect(controller.getSnapshot()).not.toHaveProperty("initializationError");
    controller.dispose();
    vi.useRealTimers();
  });

  it("recovers from an initialization failure response after retry", () => {
    vi.useFakeTimers();
    const first = createWorker();
    const second = createWorker();
    const workers = [first, second];
    const controller = createPlaygroundController({
      createWorker: () => workers.shift() as TestWorker,
      debounceMs: 10,
    });
    vi.advanceTimersByTime(10);
    first.respond(
      failed(
        first.requests[0].requestId,
        diagnostic("PLAYGROUND_INITIALIZATION_FAILED", "WASM failed"),
      ),
    );
    controller.updateDiagnostics(1, []);
    expect(controller.getSnapshot()).toMatchObject({
      status: "init-failure",
      initializationError: "WASM failed",
      canDownload: false,
    });

    controller.retry();
    vi.advanceTimersByTime(10);
    second.respond(success(second.requests[0].requestId, "recovered"));
    controller.updateDiagnostics(1, []);

    expect(controller.getSnapshot()).toMatchObject({
      status: "valid",
      diagnostics: [],
      canDownload: true,
    });
    expect(controller.getSnapshot()).not.toHaveProperty("initializationError");
    controller.dispose();
    vi.useRealTimers();
  });

  it("unsubscribes and clears listeners and timers on disposal", () => {
    vi.useFakeTimers();
    const worker = createWorker();
    const listener = vi.fn();
    const controller = createPlaygroundController({
      createWorker: () => worker,
      debounceMs: 10,
    });
    const unsubscribe = controller.subscribe(listener);
    controller.updateSource("pending");
    unsubscribe();
    controller.dispose();
    vi.advanceTimersByTime(20);
    worker.respond(success(2, "late"));
    expect(worker.requests).toEqual([]);
    expect(worker.listenerCount()).toBe(0);
    expect(worker.terminated).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

interface TestWorker extends WorkerLike {
  requests: CompileRequest[];
  terminated: boolean;
  respond(response: CompileResponse): void;
  fail(error: Error): void;
  listenerCount(): number;
}

function createWorker(): TestWorker {
  const messageListeners = new Set<
    (event: MessageEvent<CompileResponse>) => void
  >();
  const errorListeners = new Set<(event: ErrorEvent) => void>();
  return {
    requests: [],
    terminated: false,
    postMessage(request) {
      this.requests.push(request);
    },
    addEventListener(type, listener) {
      if (type === "message") messageListeners.add(listener as never);
      else errorListeners.add(listener as never);
    },
    removeEventListener(type, listener) {
      if (type === "message") messageListeners.delete(listener as never);
      else errorListeners.delete(listener as never);
    },
    terminate() {
      this.terminated = true;
    },
    respond(response) {
      messageListeners.forEach((listener) =>
        listener({ data: response } as MessageEvent<CompileResponse>),
      );
    },
    fail(error) {
      errorListeners.forEach((listener) =>
        listener({ error, message: error.message } as ErrorEvent),
      );
    },
    listenerCount: () => messageListeners.size + errorListeners.size,
  };
}

function success(requestId: string | number, name: string): CompileResponse {
  const artifact: PlaygroundArtifact = {
    name,
    event: "Stop",
    fileName: `${name}.mjs`,
    filePath: `.claude/hooks/typed-claude-hooks/Stop/${name}.mjs`,
    contents: "bundle",
    wrapper: {
      filePath: `.claude/hooks/typed-claude-hooks/Stop/${name}.sh`,
      contents: "wrapper",
    },
  };
  return {
    type: "compile-result",
    requestId,
    status: "success",
    handlers: [{ name, event: "Stop" }],
    artifacts: [artifact],
    diagnostics: [],
    settings: { hooks: { Stop: [{ hooks: [] }] } },
  };
}

function empty(requestId: string | number): CompileResponse {
  return {
    type: "compile-result",
    requestId,
    status: "success",
    handlers: [],
    artifacts: [],
    diagnostics: [],
    settings: { hooks: {} },
  };
}

function noArtifacts(requestId: string | number): CompileResponse {
  const response = success(requestId, "handler");
  return { ...response, artifacts: [] };
}

function failed(
  requestId: string | number,
  failure: SourceDiagnostic,
  includeOutput = false,
): CompileResponse {
  const response = success(requestId, "handler");
  return {
    ...response,
    status: "error",
    diagnostics: [failure],
    handlers: includeOutput ? response.handlers : [],
    artifacts: includeOutput ? response.artifacts : [],
  };
}

function diagnostic(
  code: string,
  message: string,
  severity: SourceDiagnostic["severity"] = "error",
): SourceDiagnostic {
  const position = { line: 1, column: 1, offset: 0 };
  return {
    code,
    message,
    severity,
    fileName: "hooks.config.ts",
    start: position,
    end: position,
  };
}
