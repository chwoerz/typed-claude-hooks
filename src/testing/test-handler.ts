import type { BaseHookInput, HookEvent } from "../types/index.js";
import type {
  HookInputFor,
  HookOutputFor,
  TypedHandler,
} from "../types/mapping.js";

type BaseDefaults = Pick<
  BaseHookInput,
  "session_id" | "transcript_path" | "cwd"
>;

type PartialInput<E extends HookEvent> = Partial<BaseDefaults> &
  Omit<HookInputFor<E>, keyof BaseDefaults | "hook_event_name">;

const BASE_DEFAULTS: BaseDefaults = {
  session_id: "test-session",
  transcript_path: "/tmp/test-transcript.jsonl",
  cwd: "/tmp",
};

export async function testHandler<E extends HookEvent>(
  handler: TypedHandler<E>,
  partialInput: PartialInput<E>,
): Promise<HookOutputFor<E>> {
  const input = {
    ...BASE_DEFAULTS,
    hook_event_name: handler.event,
    ...partialInput,
  } as HookInputFor<E>;

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
