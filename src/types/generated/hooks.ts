// Auto-extracted from @anthropic-ai/claude-agent-sdk sdk.d.ts
// Do not edit manually — regenerate with: npm run extract-types

export type AsyncHookJSONOutput = {
  async: true;
  asyncTimeout?: number;
};

export type BackgroundTaskSummary = {
  id: string;
  /**
   * Friendly task-type label (e.g. 'shell', 'subagent', 'monitor', 'workflow'). Falls back to the raw discriminant for unknown types.
   */
  type: string;
  status: string;
  /**
   * Free-text description. Capped at 1000 chars; clipped values append an in-string "… [+N chars]" marker.
   */
  description: string;
  /**
   * Shell command line. Only present for 'shell' tasks. Capped at 1000 chars with the same "… [+N chars]" marker.
   */
  command?: string;
  /**
   * Subagent type name. Only present for 'subagent' tasks.
   */
  agent_type?: string;
  /**
   * MCP server name. Only present for 'monitor' / 'MCP task' tasks.
   */
  server?: string;
  /**
   * MCP tool name. Only present for 'monitor' / 'MCP task' tasks.
   */
  tool?: string;
  /**
   * Workflow name. Only present for 'workflow' tasks.
   */
  name?: string;
};

export type BaseHookInput = {
  session_id: string;
  transcript_path: string;
  cwd: string;
  permission_mode?: string;
  /**
   * Subagent identifier. Present only when the hook fires from within a subagent (e.g., a tool called by an AgentTool worker). Absent for the main thread, even in --agent sessions. Use this field (not agent_type) to distinguish subagent calls from main-thread calls.
   */
  agent_id?: string;
  /**
   * Agent type name (e.g., "general-purpose", "code-reviewer"). Present when the hook fires from within a subagent (alongside agent_id), or on the main thread of a session started with --agent (without agent_id).
   */
  agent_type?: string;
  /**
   * Reasoning effort applied to the current turn. Same shape as StatusLineCommandInput.effort. Present for hooks that fire within a tool-use context (PreToolUse, PostToolUse, Stop, SubagentStop, etc.) on a model that supports the effort parameter; absent for session-lifecycle hooks and models without effort support.
   */
  effort?: {
    /**
     * Active effort level for the current turn (e.g., "low", "medium", "high", "xhigh", "max"), after any silent downgrade for the selected model. Also exposed to hook commands and Bash as the CLAUDE_EFFORT env var.
     */
    level: string;
  };
};

export type ConfigChangeHookInput = BaseHookInput & {
  hook_event_name: "ConfigChange";
  source:
    | "user_settings"
    | "project_settings"
    | "local_settings"
    | "policy_settings"
    | "skills";
  file_path?: string;
};

export type CwdChangedHookInput = BaseHookInput & {
  hook_event_name: "CwdChanged";
  old_cwd: string;
  new_cwd: string;
};

export type CwdChangedHookSpecificOutput = {
  hookEventName: "CwdChanged";
  watchPaths?: string[];
};

export type ElicitationHookInput = BaseHookInput & {
  hook_event_name: "Elicitation";
  mcp_server_name: string;
  message: string;
  mode?: "form" | "url";
  url?: string;
  elicitation_id?: string;
  requested_schema?: Record<string, unknown>;
};

export type ElicitationHookSpecificOutput = {
  hookEventName: "Elicitation";
  action?: "accept" | "decline" | "cancel";
  content?: Record<string, unknown>;
};

export type ElicitationResultHookInput = BaseHookInput & {
  hook_event_name: "ElicitationResult";
  mcp_server_name: string;
  elicitation_id?: string;
  mode?: "form" | "url";
  action: "accept" | "decline" | "cancel";
  content?: Record<string, unknown>;
};

export type ElicitationResultHookSpecificOutput = {
  hookEventName: "ElicitationResult";
  action?: "accept" | "decline" | "cancel";
  content?: Record<string, unknown>;
};

export type ExitReason =
  | "clear"
  | "resume"
  | "logout"
  | "prompt_input_exit"
  | "other"
  | "bypass_permissions_disabled";

export type FileChangedHookInput = BaseHookInput & {
  hook_event_name: "FileChanged";
  file_path: string;
  event: "change" | "add" | "unlink";
};

export type FileChangedHookSpecificOutput = {
  hookEventName: "FileChanged";
  watchPaths?: string[];
};

export type HookEvent =
  | "PreToolUse"
  | "PostToolUse"
  | "PostToolUseFailure"
  | "PostToolBatch"
  | "Notification"
  | "UserPromptSubmit"
  | "UserPromptExpansion"
  | "SessionStart"
  | "SessionEnd"
  | "Stop"
  | "StopFailure"
  | "SubagentStart"
  | "SubagentStop"
  | "PreCompact"
  | "PostCompact"
  | "PermissionRequest"
  | "PermissionDenied"
  | "Setup"
  | "TeammateIdle"
  | "TaskCreated"
  | "TaskCompleted"
  | "Elicitation"
  | "ElicitationResult"
  | "ConfigChange"
  | "WorktreeCreate"
  | "WorktreeRemove"
  | "InstructionsLoaded"
  | "CwdChanged"
  | "FileChanged"
  | "MessageDisplay";

export type HookInput =
  | PreToolUseHookInput
  | PostToolUseHookInput
  | PostToolUseFailureHookInput
  | PostToolBatchHookInput
  | PermissionDeniedHookInput
  | NotificationHookInput
  | UserPromptSubmitHookInput
  | UserPromptExpansionHookInput
  | SessionStartHookInput
  | SessionEndHookInput
  | StopHookInput
  | StopFailureHookInput
  | SubagentStartHookInput
  | SubagentStopHookInput
  | PreCompactHookInput
  | PostCompactHookInput
  | PermissionRequestHookInput
  | SetupHookInput
  | TeammateIdleHookInput
  | TaskCreatedHookInput
  | TaskCompletedHookInput
  | ElicitationHookInput
  | ElicitationResultHookInput
  | ConfigChangeHookInput
  | InstructionsLoadedHookInput
  | WorktreeCreateHookInput
  | WorktreeRemoveHookInput
  | CwdChangedHookInput
  | FileChangedHookInput
  | MessageDisplayHookInput;

export type HookJSONOutput = AsyncHookJSONOutput | SyncHookJSONOutput;

export type HookPermissionDecision = "allow" | "deny" | "ask" | "defer";

export type InstructionsLoadedHookInput = BaseHookInput & {
  hook_event_name: "InstructionsLoaded";
  file_path: string;
  memory_type: "User" | "Project" | "Local" | "Managed";
  load_reason:
    | "session_start"
    | "nested_traversal"
    | "path_glob_match"
    | "include"
    | "compact";
  globs?: string[];
  trigger_file_path?: string;
  parent_file_path?: string;
};

export type MessageDisplayHookInput = BaseHookInput & {
  hook_event_name: "MessageDisplay";
  /**
   * UUID of the current turn.
   */
  turn_id: string;
  /**
   * UUID of the assistant message being displayed. Stable across every flush of the same message. Not the API msg_… id.
   */
  message_id: string;
  /**
   * Zero-based index of this delta within the message. Increments by one per flush.
   */
  index: number;
  /**
   * True on the message's last flush. Exactly one flush per message has it.
   */
  final: boolean;
  /**
   * The newly completed lines since the prior flush. Always whole lines, except on the final flush which may end mid-line. The delta of the final flush is empty when the message ends on a newline; treat final as the end-of-message signal regardless.
   */
  delta: string;
};

export type MessageDisplayHookSpecificOutput = {
  hookEventName: "MessageDisplay";
  /**
   * Text displayed in place of the delta. Omit (or return the delta unchanged) to display the original.
   */
  displayContent?: string;
};

export type NotificationHookInput = BaseHookInput & {
  hook_event_name: "Notification";
  message: string;
  title?: string;
  notification_type: string;
};

export type NotificationHookSpecificOutput = {
  hookEventName: "Notification";
  additionalContext?: string;
};

export type PermissionBehavior = "allow" | "deny" | "ask";

export type PermissionDecisionClassification =
  | "user_temporary"
  | "user_permanent"
  | "user_reject";

export type PermissionDeniedHookInput = BaseHookInput & {
  hook_event_name: "PermissionDenied";
  tool_name: string;
  tool_input: unknown;
  tool_use_id: string;
  reason: string;
};

export type PermissionDeniedHookSpecificOutput = {
  hookEventName: "PermissionDenied";
  retry?: boolean;
};

export type PermissionMode =
  | "default"
  | "acceptEdits"
  | "bypassPermissions"
  | "plan"
  | "dontAsk"
  | "auto";

export type PermissionRequestHookInput = BaseHookInput & {
  hook_event_name: "PermissionRequest";
  tool_name: string;
  tool_input: unknown;
  permission_suggestions?: PermissionUpdate[];
};

export type PermissionRequestHookSpecificOutput = {
  hookEventName: "PermissionRequest";
  decision:
    | {
        behavior: "allow";
        updatedInput?: Record<string, unknown>;
        updatedPermissions?: PermissionUpdate[];
      }
    | {
        behavior: "deny";
        message?: string;
        interrupt?: boolean;
      };
};

export type PermissionResult =
  | {
      behavior: "allow";
      updatedInput?: Record<string, unknown>;
      updatedPermissions?: PermissionUpdate[];
      toolUseID?: string;
      decisionClassification?: PermissionDecisionClassification;
    }
  | {
      behavior: "deny";
      message: string;
      interrupt?: boolean;
      toolUseID?: string;
      decisionClassification?: PermissionDecisionClassification;
    };

export type PermissionRuleValue = {
  toolName: string;
  ruleContent?: string;
};

export type PermissionUpdate =
  | {
      type: "addRules";
      rules: PermissionRuleValue[];
      behavior: PermissionBehavior;
      destination: PermissionUpdateDestination;
    }
  | {
      type: "replaceRules";
      rules: PermissionRuleValue[];
      behavior: PermissionBehavior;
      destination: PermissionUpdateDestination;
    }
  | {
      type: "removeRules";
      rules: PermissionRuleValue[];
      behavior: PermissionBehavior;
      destination: PermissionUpdateDestination;
    }
  | {
      type: "setMode";
      mode: PermissionMode;
      destination: PermissionUpdateDestination;
    }
  | {
      type: "addDirectories";
      directories: string[];
      destination: PermissionUpdateDestination;
    }
  | {
      type: "removeDirectories";
      directories: string[];
      destination: PermissionUpdateDestination;
    };

export type PermissionUpdateDestination =
  | "userSettings"
  | "projectSettings"
  | "localSettings"
  | "session"
  | "cliArg";

export type PostCompactHookInput = BaseHookInput & {
  hook_event_name: "PostCompact";
  trigger: "manual" | "auto";
  /**
   * The conversation summary produced by compaction
   */
  compact_summary: string;
};

export type PostToolBatchHookInput = BaseHookInput & {
  hook_event_name: "PostToolBatch";
  tool_calls: PostToolBatchToolCall[];
};

export type PostToolBatchHookSpecificOutput = {
  hookEventName: "PostToolBatch";
  additionalContext?: string;
};

export type PostToolBatchToolCall = {
  tool_name: string;
  tool_input: unknown;
  tool_use_id: string;
  tool_response?: unknown;
};

export type PostToolUseFailureHookInput = BaseHookInput & {
  hook_event_name: "PostToolUseFailure";
  tool_name: string;
  tool_input: unknown;
  tool_use_id: string;
  error: string;
  is_interrupt?: boolean;
  /**
   * Tool execution time in milliseconds. Excludes permission-prompt and hook time.
   */
  duration_ms?: number;
};

export type PostToolUseFailureHookSpecificOutput = {
  hookEventName: "PostToolUseFailure";
  additionalContext?: string;
};

export type PostToolUseHookInput = BaseHookInput & {
  hook_event_name: "PostToolUse";
  tool_name: string;
  tool_input: unknown;
  tool_response: unknown;
  tool_use_id: string;
  /**
   * Tool execution time in milliseconds. Excludes permission-prompt and hook time.
   */
  duration_ms?: number;
};

export type PostToolUseHookSpecificOutput = {
  hookEventName: "PostToolUse";
  additionalContext?: string;
  /**
   * Replaces the tool output before it is sent to the model
   */
  updatedToolOutput?: unknown;
  /**
   * Replaces the output for MCP tools only. Prefer updatedToolOutput, which works for all tools
   */
  updatedMCPToolOutput?: unknown;
};

export type PreCompactHookInput = BaseHookInput & {
  hook_event_name: "PreCompact";
  trigger: "manual" | "auto";
  custom_instructions: string | null;
};

export type PreToolUseHookInput = BaseHookInput & {
  hook_event_name: "PreToolUse";
  tool_name: string;
  tool_input: unknown;
  tool_use_id: string;
};

export type PreToolUseHookSpecificOutput = {
  hookEventName: "PreToolUse";
  permissionDecision?: HookPermissionDecision;
  permissionDecisionReason?: string;
  updatedInput?: Record<string, unknown>;
  additionalContext?: string;
};

export type SDKAssistantMessageError =
  | "authentication_failed"
  | "oauth_org_not_allowed"
  | "billing_error"
  | "rate_limit"
  | "overloaded"
  | "invalid_request"
  | "model_not_found"
  | "server_error"
  | "unknown"
  | "max_output_tokens";

export type SessionCronSummary = {
  id: string;
  /**
   * Cron expression, e.g. "0 9 * * 1-5".
   */
  schedule: string;
  /**
   * False for one-shot wakeups whose cron field encodes a single fire time; true for tasks that re-fire on every match.
   */
  recurring: boolean;
  /**
   * Prompt text submitted when the cron fires. Capped at 1000 chars; clipped values append an in-string "… [+N chars]" marker.
   */
  prompt: string;
};

export type SessionEndHookInput = BaseHookInput & {
  hook_event_name: "SessionEnd";
  reason: ExitReason;
};

export type SessionStartHookInput = BaseHookInput & {
  hook_event_name: "SessionStart";
  source: "startup" | "resume" | "clear" | "compact";
  agent_type?: string;
  model?: string;
  session_title?: string;
};

export type SessionStartHookSpecificOutput = {
  hookEventName: "SessionStart";
  additionalContext?: string;
  initialUserMessage?: string;
  sessionTitle?: string;
  watchPaths?: string[];
  /**
   * Re-scan skill and command directories after SessionStart hooks complete, so skills installed by the hook are available in the same session
   */
  reloadSkills?: boolean;
};

export type SetupHookInput = BaseHookInput & {
  hook_event_name: "Setup";
  trigger: "init" | "maintenance";
};

export type SetupHookSpecificOutput = {
  hookEventName: "Setup";
  additionalContext?: string;
};

export type StopFailureHookInput = BaseHookInput & {
  hook_event_name: "StopFailure";
  error: SDKAssistantMessageError;
  error_details?: string;
  last_assistant_message?: string;
};

export type StopHookInput = BaseHookInput & {
  hook_event_name: "Stop";
  stop_hook_active: boolean;
  /**
   * Text content of the last assistant message before stopping. Avoids the need to read and parse the transcript file.
   */
  last_assistant_message?: string;
  /**
   * In-flight background work (running/pending + backgrounded) registered in this session. Lets hooks distinguish "session is done" from "session is paused waiting for background work to wake it". Empty array when nothing is in flight.
   */
  background_tasks?: BackgroundTaskSummary[];
  /**
   * Session-scoped cron tasks (CronCreate, ScheduleWakeup, /loop) that will wake this session later. Empty array when none are scheduled.
   */
  session_crons?: SessionCronSummary[];
};

export type StopHookSpecificOutput = {
  hookEventName: "Stop";
  additionalContext?: string;
};

export type SubagentStartHookInput = BaseHookInput & {
  hook_event_name: "SubagentStart";
  agent_id: string;
  agent_type: string;
};

export type SubagentStartHookSpecificOutput = {
  hookEventName: "SubagentStart";
  additionalContext?: string;
};

export type SubagentStopHookInput = BaseHookInput & {
  hook_event_name: "SubagentStop";
  stop_hook_active: boolean;
  agent_id: string;
  agent_transcript_path: string;
  agent_type: string;
  /**
   * Text content of the last assistant message before stopping. Avoids the need to read and parse the transcript file.
   */
  last_assistant_message?: string;
  /**
   * In-flight background work (running/pending + backgrounded) registered in this session. Lets hooks distinguish "session is done" from "session is paused waiting for background work to wake it". Empty array when nothing is in flight.
   */
  background_tasks?: BackgroundTaskSummary[];
  /**
   * Session-scoped cron tasks (CronCreate, ScheduleWakeup, /loop) that will wake this session later. Empty array when none are scheduled.
   */
  session_crons?: SessionCronSummary[];
};

export type SubagentStopHookSpecificOutput = {
  hookEventName: "SubagentStop";
  additionalContext?: string;
};

export type SyncHookJSONOutput = {
  continue?: boolean;
  suppressOutput?: boolean;
  stopReason?: string;
  decision?: "approve" | "block";
  systemMessage?: string;
  /**
   * A terminal escape sequence (e.g. OSC 9 / OSC 777 desktop-notification) for Claude Code to emit on your behalf. Only notification/title OSCs (0, 1, 2, 9, 99, 777) and BEL are permitted; anything else is dropped.
   */
  terminalSequence?: string;
  reason?: string;

  hookSpecificOutput?:
    | PreToolUseHookSpecificOutput
    | UserPromptSubmitHookSpecificOutput
    | UserPromptExpansionHookSpecificOutput
    | SessionStartHookSpecificOutput
    | SetupHookSpecificOutput
    | SubagentStartHookSpecificOutput
    | PostToolUseHookSpecificOutput
    | PostToolUseFailureHookSpecificOutput
    | PostToolBatchHookSpecificOutput
    | StopHookSpecificOutput
    | SubagentStopHookSpecificOutput
    | PermissionDeniedHookSpecificOutput
    | NotificationHookSpecificOutput
    | PermissionRequestHookSpecificOutput
    | ElicitationHookSpecificOutput
    | ElicitationResultHookSpecificOutput
    | CwdChangedHookSpecificOutput
    | FileChangedHookSpecificOutput
    | WorktreeCreateHookSpecificOutput
    | MessageDisplayHookSpecificOutput;
};

export type TaskCompletedHookInput = BaseHookInput & {
  hook_event_name: "TaskCompleted";
  task_id: string;
  task_subject: string;
  task_description?: string;
  teammate_name?: string;
  team_name?: string;
};

export type TaskCreatedHookInput = BaseHookInput & {
  hook_event_name: "TaskCreated";
  task_id: string;
  task_subject: string;
  task_description?: string;
  teammate_name?: string;
  team_name?: string;
};

export type TeammateIdleHookInput = BaseHookInput & {
  hook_event_name: "TeammateIdle";
  teammate_name: string;
  team_name: string;
};

export type UserPromptExpansionHookInput = BaseHookInput & {
  hook_event_name: "UserPromptExpansion";
  expansion_type: "slash_command" | "mcp_prompt";
  command_name: string;
  command_args: string;
  command_source?: string;
  prompt: string;
};

export type UserPromptExpansionHookSpecificOutput = {
  hookEventName: "UserPromptExpansion";
  additionalContext?: string;
};

export type UserPromptSubmitHookInput = BaseHookInput & {
  hook_event_name: "UserPromptSubmit";
  prompt: string;
  session_title?: string;
};

export type UserPromptSubmitHookSpecificOutput = {
  hookEventName: "UserPromptSubmit";
  additionalContext?: string;
  sessionTitle?: string;
  /**
   * When decision is "block", omit the original prompt from the block message
   */
  suppressOriginalPrompt?: boolean;
};

export type WorktreeCreateHookInput = BaseHookInput & {
  hook_event_name: "WorktreeCreate";
  name: string;
};

export type WorktreeCreateHookSpecificOutput = {
  hookEventName: "WorktreeCreate";
  worktreePath: string;
};

export type WorktreeRemoveHookInput = BaseHookInput & {
  hook_event_name: "WorktreeRemove";
  worktree_path: string;
};
