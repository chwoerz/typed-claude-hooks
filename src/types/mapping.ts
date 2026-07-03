import type {
  ConfigChangeHookInput,
  CwdChangedHookInput,
  CwdChangedHookSpecificOutput,
  ElicitationHookInput,
  ElicitationHookSpecificOutput,
  ElicitationResultHookInput,
  ElicitationResultHookSpecificOutput,
  FileChangedHookInput,
  FileChangedHookSpecificOutput,
  HookEvent,
  InstructionsLoadedHookInput,
  MessageDisplayHookInput,
  MessageDisplayHookSpecificOutput,
  NotificationHookInput,
  NotificationHookSpecificOutput,
  PermissionDeniedHookInput,
  PermissionDeniedHookSpecificOutput,
  PermissionRequestHookInput,
  PermissionRequestHookSpecificOutput,
  PostCompactHookInput,
  PostToolBatchHookInput,
  PostToolBatchHookSpecificOutput,
  PostToolUseFailureHookInput,
  PostToolUseFailureHookSpecificOutput,
  PostToolUseHookInput,
  PostToolUseHookSpecificOutput,
  PreCompactHookInput,
  PreToolUseHookInput,
  PreToolUseHookSpecificOutput,
  SessionEndHookInput,
  SessionStartHookInput,
  SessionStartHookSpecificOutput,
  SetupHookInput,
  SetupHookSpecificOutput,
  StopFailureHookInput,
  StopHookInput,
  StopHookSpecificOutput,
  SubagentStartHookInput,
  SubagentStartHookSpecificOutput,
  SubagentStopHookInput,
  SubagentStopHookSpecificOutput,
  SyncHookJSONOutput,
  TaskCompletedHookInput,
  TaskCreatedHookInput,
  TeammateIdleHookInput,
  UserPromptExpansionHookInput,
  UserPromptExpansionHookSpecificOutput,
  UserPromptSubmitHookInput,
  UserPromptSubmitHookSpecificOutput,
  WorktreeCreateHookInput,
  WorktreeCreateHookSpecificOutput,
  WorktreeRemoveHookInput,
} from "./generated/hooks.js";
import type { ToolInputMap } from "./generated/tool-inputs.js";

export interface HookInputMap {
  PreToolUse: PreToolUseHookInput;
  PostToolUse: PostToolUseHookInput;
  PostToolUseFailure: PostToolUseFailureHookInput;
  PostToolBatch: PostToolBatchHookInput;
  Notification: NotificationHookInput;
  UserPromptSubmit: UserPromptSubmitHookInput;
  UserPromptExpansion: UserPromptExpansionHookInput;
  SessionStart: SessionStartHookInput;
  SessionEnd: SessionEndHookInput;
  Stop: StopHookInput;
  StopFailure: StopFailureHookInput;
  SubagentStart: SubagentStartHookInput;
  SubagentStop: SubagentStopHookInput;
  PreCompact: PreCompactHookInput;
  PostCompact: PostCompactHookInput;
  PermissionRequest: PermissionRequestHookInput;
  PermissionDenied: PermissionDeniedHookInput;
  Setup: SetupHookInput;
  TeammateIdle: TeammateIdleHookInput;
  TaskCreated: TaskCreatedHookInput;
  TaskCompleted: TaskCompletedHookInput;
  Elicitation: ElicitationHookInput;
  ElicitationResult: ElicitationResultHookInput;
  ConfigChange: ConfigChangeHookInput;
  InstructionsLoaded: InstructionsLoadedHookInput;
  WorktreeCreate: WorktreeCreateHookInput;
  WorktreeRemove: WorktreeRemoveHookInput;
  CwdChanged: CwdChangedHookInput;
  FileChanged: FileChangedHookInput;
  MessageDisplay: MessageDisplayHookInput;
}

export type HookInputFor<E extends HookEvent> = E extends keyof HookInputMap
  ? HookInputMap[E]
  : never;

export interface HookSpecificOutputMap {
  PreToolUse: PreToolUseHookSpecificOutput;
  PostToolUse: PostToolUseHookSpecificOutput;
  PostToolUseFailure: PostToolUseFailureHookSpecificOutput;
  PostToolBatch: PostToolBatchHookSpecificOutput;
  UserPromptSubmit: UserPromptSubmitHookSpecificOutput;
  UserPromptExpansion: UserPromptExpansionHookSpecificOutput;
  SessionStart: SessionStartHookSpecificOutput;
  Setup: SetupHookSpecificOutput;
  Stop: StopHookSpecificOutput;
  SubagentStart: SubagentStartHookSpecificOutput;
  SubagentStop: SubagentStopHookSpecificOutput;
  PermissionDenied: PermissionDeniedHookSpecificOutput;
  Notification: NotificationHookSpecificOutput;
  PermissionRequest: PermissionRequestHookSpecificOutput;
  Elicitation: ElicitationHookSpecificOutput;
  ElicitationResult: ElicitationResultHookSpecificOutput;
  CwdChanged: CwdChangedHookSpecificOutput;
  FileChanged: FileChangedHookSpecificOutput;
  WorktreeCreate: WorktreeCreateHookSpecificOutput;
  MessageDisplay: MessageDisplayHookSpecificOutput;
}

type NoHookSpecific = Omit<SyncHookJSONOutput, "hookSpecificOutput">;
export type HookOutputFor<E extends HookEvent> =
  E extends keyof HookSpecificOutputMap
    ? NoHookSpecific & {
        hookSpecificOutput?: HookSpecificOutputMap[E];
      }
    : NoHookSpecific;

export type ParseMatcher<M extends string> =
  M extends `${infer Head}|${infer Tail}` ? Head | ParseMatcher<Tail> : M;

type ResolveToolInput<Name extends string> = Name extends keyof ToolInputMap
  ? ToolInputMap[Name]
  : unknown;

export type ToolHookEvent = "PreToolUse" | "PostToolUse";

export type NarrowedToolInput<
  E extends ToolHookEvent,
  M extends string,
> = HookInputMap[E] & {
  tool_name: ParseMatcher<M>;
  tool_input: ResolveToolInput<ParseMatcher<M>>;
};

export interface HandlerOptions {
  matcher?: string;
  timeout?: number;
  if?: string;
  shell?: "bash" | "powershell";
  statusMessage?: string;
  once?: boolean;
  async?: boolean;
  asyncRewake?: boolean;
}

export interface TypedHandler<E extends HookEvent>
  extends Readonly<HandlerOptions> {
  readonly event: E;
  readonly handler: (input: HookInputFor<E>) => Promise<HookOutputFor<E>>;
}
