import type { BaseHookInput, HookEvent } from "../types/index.js";
import type { HookInputFor, HookOutputFor, TypedHandler } from "../types/mapping.js";

type BaseDefaults = Pick<BaseHookInput, "session_id" | "transcript_path" | "cwd">;

type PartialInput<Input extends BaseHookInput> = Partial<BaseDefaults> &
  Omit<Input, keyof BaseDefaults | "hook_event_name">;

const BASE_DEFAULTS: BaseDefaults = {
  session_id: "test-session",
  transcript_path: "/tmp/test-transcript.jsonl",
  cwd: "/tmp",
};

export async function testHandler<E extends HookEvent, Input extends HookInputFor<E>>(
  handler: TypedHandler<E, Input>,
  partialInput: PartialInput<Input>,
): Promise<HookOutputFor<E>> {
  const input = {
    ...BASE_DEFAULTS,
    hook_event_name: handler.event,
    ...partialInput,
  } as Input;

  const result = await handler.handler(input);
  const hookSpecificOutput = result.hookSpecificOutput;
  if (hookSpecificOutput && !("hookEventName" in hookSpecificOutput)) {
    return {
      ...result,
      hookSpecificOutput: {
        ...hookSpecificOutput,
        hookEventName: input.hook_event_name,
      },
    } as HookOutputFor<E>;
  }

  return result;
}
