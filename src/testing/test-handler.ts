import type { HookEvent } from "../types/index.js";
import type {
  HookInputFor,
  HookOutputFor,
  TypedHandler,
} from "../types/mapping.js";

type PartialInput<E extends HookEvent> = Partial<HookInputFor<E>> &
  Omit<HookInputFor<E>, keyof BaseDefaults>;

interface BaseDefaults {
  session_id: string;
  transcript_path: string;
  cwd: string;
  hook_event_name: string;
}

const BASE_DEFAULTS: BaseDefaults = {
  session_id: "test-session",
  transcript_path: "/tmp/test-transcript.jsonl",
  cwd: "/tmp",
  hook_event_name: "",
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

  return handler.handler(input);
}
