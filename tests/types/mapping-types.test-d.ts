import { describe, expectTypeOf, it } from "vitest";
import type { HookInput } from "../../src/types/generated/hooks.js";
import type {
  HookInputFor,
  HookInputMap,
  HookOutputFor,
  HookSpecificOutputMap,
} from "../../src/types/mapping.js";

describe("SDK-derived hook mappings", () => {
  it("maps every input from its SDK discriminant", () => {
    expectTypeOf<HookInputMap[keyof HookInputMap]>().toEqualTypeOf<HookInput>();
    expectTypeOf<HookInputFor<"PermissionDenied">>().toEqualTypeOf<
      Extract<HookInput, { hook_event_name: "PermissionDenied" }>
    >();
  });

  it("maps specific outputs from their SDK discriminant", () => {
    expectTypeOf<HookSpecificOutputMap["PreToolUse"]>().toHaveProperty(
      "hookEventName",
    );
    expectTypeOf<
      keyof HookSpecificOutputMap
    >().not.toEqualTypeOf<"SessionEnd">();
  });
});

describe("HookOutputFor", () => {
  it("accepts an omitted hookEventName", () => {
    const output = {
      hookSpecificOutput: { permissionDecision: "deny" },
    } satisfies HookOutputFor<"PreToolUse">;

    expectTypeOf(
      output.hookSpecificOutput.permissionDecision,
    ).toEqualTypeOf<"deny">();
  });

  it("accepts the exact event hookEventName", () => {
    const output = {
      hookSpecificOutput: { hookEventName: "PreToolUse" },
    } satisfies HookOutputFor<"PreToolUse">;

    expectTypeOf(
      output.hookSpecificOutput.hookEventName,
    ).toEqualTypeOf<"PreToolUse">();
  });

  it("rejects another event hookEventName", () => {
    const output: HookOutputFor<"PreToolUse"> = {
      hookSpecificOutput: {
        // @ts-expect-error PostToolUse output cannot be returned from PreToolUse
        hookEventName: "PostToolUse",
      },
    };

    expectTypeOf(output).toEqualTypeOf<HookOutputFor<"PreToolUse">>();
  });

  it("rejects hookSpecificOutput for events without one", () => {
    const output: HookOutputFor<"SessionEnd"> = {
      // @ts-expect-error SessionEnd has no event-specific output
      hookSpecificOutput: {},
    };

    expectTypeOf(output).toEqualTypeOf<HookOutputFor<"SessionEnd">>();
  });

  it("rejects non-literal specific output for events without one", () => {
    const candidate = {
      continue: true,
      hookSpecificOutput: {},
    };

    // @ts-expect-error SessionEnd never accepts event-specific output
    const output: HookOutputFor<"SessionEnd"> = candidate;
    expectTypeOf(output).toEqualTypeOf<HookOutputFor<"SessionEnd">>();
  });
});
