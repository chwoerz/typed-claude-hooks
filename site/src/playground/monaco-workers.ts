import EditorWorker from "monaco-editor/editor/editor.worker.js?worker";
import TypeScriptWorker from "monaco-editor/language/typescript/ts.worker.js?worker";

interface MonacoEnvironment {
  getWorker(_moduleId: string, label: string): Worker;
}

interface MonacoGlobal {
  MonacoEnvironment?: MonacoEnvironment;
}

interface WorkerEnvironmentState {
  environment: MonacoEnvironment;
  previous?: MonacoEnvironment;
  references: number;
}

const workerEnvironments = new WeakMap<object, WorkerEnvironmentState>();

export function configureMonacoWorkers(
  globalScope: MonacoGlobal = globalThis as MonacoGlobal,
): () => void {
  const existing = workerEnvironments.get(globalScope);
  const state = existing ?? {
    environment: {
      getWorker(_moduleId, label) {
        return label === "typescript" || label === "javascript"
          ? new TypeScriptWorker()
          : new EditorWorker();
      },
    },
    previous: globalScope.MonacoEnvironment,
    references: 0,
  };
  state.references += 1;
  workerEnvironments.set(globalScope, state);
  globalScope.MonacoEnvironment = state.environment;
  let released = false;

  return () => {
    if (released) return;
    released = true;
    state.references -= 1;
    if (state.references !== 0) return;
    if (globalScope.MonacoEnvironment === state.environment) {
      globalScope.MonacoEnvironment = state.previous;
    }
    workerEnvironments.delete(globalScope);
  };
}
