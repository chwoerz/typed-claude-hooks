export interface SourcePosition {
  line: number;
  column: number;
  offset: number;
}

export interface SourceDiagnostic {
  code: string;
  severity: "error" | "warning";
  message: string;
  sourceLine?: string;
  fileName: string;
  start: SourcePosition;
  end: SourcePosition;
}

export interface HandlerMetadata {
  name: string;
  event: string;
  matcher?: string;
  timeout?: number;
  if?: string;
  shell?: "bash" | "powershell";
  statusMessage?: string;
  once?: boolean;
  async?: boolean;
  asyncRewake?: boolean;
}

export interface DiscoverHandlersResult {
  handlers: HandlerMetadata[];
  diagnostics: SourceDiagnostic[];
}

export interface PlaygroundArtifact {
  name: string;
  event: string;
  matcher?: string;
  timeout?: number;
  if?: string;
  shell?: "bash" | "powershell";
  statusMessage?: string;
  once?: boolean;
  async?: boolean;
  asyncRewake?: boolean;
  fileName: string;
  filePath: string;
  contents: string;
  wrapper: {
    filePath: string;
    contents: string;
  };
}

export type RequestId = string | number;

export interface CompileInput {
  requestId: RequestId;
  source: string;
  fileName?: string;
}

export interface CompileRequest extends CompileInput {
  type: "compile";
}

export interface PlaygroundHookCommand {
  type: "command";
  command: string;
  timeout?: number;
  if?: string;
  shell?: "bash" | "powershell";
  statusMessage?: string;
  once?: boolean;
  async?: boolean;
  asyncRewake?: boolean;
}

export interface PlaygroundSettings {
  hooks: Record<
    string,
    Array<{ matcher?: string; hooks: PlaygroundHookCommand[] }>
  >;
}

export interface CompileResponse {
  type: "compile-result";
  requestId: RequestId;
  status: "success" | "error" | "superseded";
  handlers: HandlerMetadata[];
  artifacts: PlaygroundArtifact[];
  diagnostics: SourceDiagnostic[];
  settings: PlaygroundSettings;
}
