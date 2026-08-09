import type { HookEvent, HookInput, SyncHookJSONOutput } from "./generated/hooks.js";
import type { ToolInputMap } from "./generated/tool-inputs.js";

export type Runtime = "node" | "bun" | "deno";

export type HookInputMap = {
  [E in HookEvent]: Extract<HookInput, { hook_event_name: E }>;
};

export type HookInputFor<E extends HookEvent> = E extends keyof HookInputMap ? HookInputMap[E] : never;

type HookSpecificOutput = NonNullable<SyncHookJSONOutput["hookSpecificOutput"]>;

export type HookSpecificOutputMap = {
  [E in HookSpecificOutput["hookEventName"]]: Extract<HookSpecificOutput, { hookEventName: E }>;
};

type NoHookSpecific = Omit<SyncHookJSONOutput, "hookSpecificOutput">;
export type HookOutputFor<E extends HookEvent> = E extends keyof HookSpecificOutputMap
  ? NoHookSpecific & {
      hookSpecificOutput?: Omit<HookSpecificOutputMap[E], "hookEventName"> & {
        hookEventName?: E;
      };
    }
  : NoHookSpecific & { hookSpecificOutput?: never };

export type ParseMatcher<M extends string> = M extends `${infer Head}|${infer Tail}` ? Head | ParseMatcher<Tail> : M;

type ResolveToolInput<Name extends string> = Name extends keyof ToolInputMap ? ToolInputMap[Name] : unknown;

export type ToolHookEvent = HookInput extends infer Input
  ? Input extends {
      hook_event_name: infer E extends HookEvent;
      tool_name: string;
      tool_input: unknown;
    }
    ? E
    : never
  : never;

type NarrowedToolInputForName<E extends ToolHookEvent, Name extends string> = E extends ToolHookEvent
  ? Omit<HookInputMap[E], "tool_name" | "tool_input"> & {
      tool_name: Name;
      tool_input: ResolveToolInput<Name>;
    }
  : never;

type NarrowedToolInputCandidate<E extends ToolHookEvent, M extends string> =
  ParseMatcher<M> extends infer Name extends string
    ? Name extends ParseMatcher<M>
      ? NarrowedToolInputForName<E, Name>
      : never
    : never;

export type NarrowedToolInput<E extends ToolHookEvent, M extends string> = Extract<
  NarrowedToolInputCandidate<E, M>,
  HookInputFor<E>
>;

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

export interface TypedHandler<E extends HookEvent, Input extends HookInputFor<E> = HookInputFor<E>>
  extends Readonly<HandlerOptions> {
  readonly event: E;
  readonly handler: (input: Input) => Promise<HookOutputFor<E>>;
}
