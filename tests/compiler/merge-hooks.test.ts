import { describe, expect, it } from "vitest";
import type { PlannedArtifact } from "../../src/compiler/bundle-handlers.js";
import { mergeHooksIntoSettings } from "../../src/compiler/merge-hooks.js";

describe("mergeHooksIntoSettings", () => {
  const managedCommandPrefix = `\${CLAUDE_PROJECT_DIR}/.claude/hooks/typed-claude-hooks/`;
  const bundledFiles: PlannedArtifact[] = [
    {
      fileName: "blockDangerous.mjs",
      filePath:
        "/project/.claude/hooks/typed-claude-hooks/PreToolUse/blockDangerous.mjs",
      event: "PreToolUse",
      name: "blockDangerous",
      runtime: "node",
      wrapper: {
        contents: "wrapper",
        filePath:
          "/project/.claude/hooks/typed-claude-hooks/PreToolUse/blockDangerous.sh",
      },
      matcher: "Bash",
      timeout: undefined,
      if: undefined,
      statusMessage: undefined,
      async: undefined,
      asyncRewake: undefined,
    },
    {
      fileName: "onStop.mjs",
      filePath: "/project/.claude/hooks/typed-claude-hooks/Stop/onStop.mjs",
      event: "Stop",
      name: "onStop",
      runtime: "node",
      wrapper: {
        contents: "wrapper",
        filePath: "/project/.claude/hooks/typed-claude-hooks/Stop/onStop.sh",
      },
      matcher: undefined,
      timeout: undefined,
      if: undefined,
      statusMessage: undefined,
      async: undefined,
      asyncRewake: undefined,
    },
  ];

  it("generates hook entries for bundled files", () => {
    const result = mergeHooksIntoSettings({
      existingSettings: {},
      bundledFiles,
      managedCommandPrefix,
      projectRoot: "/project",
    });

    expect(result.hooks.PreToolUse).toHaveLength(1);
    expect(result.hooks.PreToolUse[0].matcher).toBe("Bash");
    expect(result.hooks.PreToolUse[0].hooks[0].command).toBe(
      `"\${CLAUDE_PROJECT_DIR}/.claude/hooks/typed-claude-hooks/PreToolUse/blockDangerous.sh"`,
    );
    expect(result.hooks.PreToolUse[0].hooks[0]).not.toHaveProperty("__managed");
    expect(result.hooks.Stop).toHaveLength(1);
  });

  it("preserves non-hook settings", () => {
    const result = mergeHooksIntoSettings({
      existingSettings: {
        model: "claude-sonnet-4-6",
        statusLine: { type: "command" },
      },
      bundledFiles,
      managedCommandPrefix,
      projectRoot: "/project",
    });

    expect(result.model).toBe("claude-sonnet-4-6");
    expect(result.statusLine).toEqual({ type: "command" });
  });

  it("preserves unmanaged hooks and replaces managed ones", () => {
    const existing = {
      hooks: {
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [{ type: "command", command: "echo manual" }],
          },
          {
            matcher: "Write",
            hooks: [
              {
                type: "command",
                command: `"\${CLAUDE_PROJECT_DIR}/.claude/hooks/typed-claude-hooks/Write/oldHandler.sh"`,
              },
            ],
          },
        ],
      },
    };

    const result = mergeHooksIntoSettings({
      existingSettings: existing,
      bundledFiles,
      managedCommandPrefix,
      projectRoot: "/project",
    });

    const preToolUse = result.hooks.PreToolUse;
    const manualHook = preToolUse.find((m: Record<string, unknown>) =>
      m.hooks.some((h: Record<string, unknown>) => h.command === "echo manual"),
    );
    expect(manualHook).toBeTruthy();

    const oldManaged = preToolUse.find((m: Record<string, unknown>) =>
      m.hooks.some(
        (h: Record<string, unknown>) =>
          h.command ===
          `"\${CLAUDE_PROJECT_DIR}/.claude/hooks/typed-claude-hooks/Write/oldHandler.sh"`,
      ),
    );
    expect(oldManaged).toBeUndefined();

    const newManaged = preToolUse.find((m: Record<string, unknown>) =>
      m.hooks.some(
        (h: Record<string, unknown>) =>
          typeof h.command === "string" &&
          (h.command as string).includes("typed-claude-hooks") &&
          (h.command as string).endsWith('.sh"'),
      ),
    );
    expect(newManaged).toBeTruthy();
  });

  it("merges managed hooks into existing entry with same matcher", () => {
    const existing = {
      hooks: {
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [{ type: "command", command: "echo manual" }],
          },
        ],
      },
    };

    const result = mergeHooksIntoSettings({
      existingSettings: existing,
      bundledFiles,
      managedCommandPrefix,
      projectRoot: "/project",
    });

    const preToolUse = result.hooks.PreToolUse;
    expect(preToolUse).toHaveLength(1);

    const bashEntry = preToolUse[0];
    expect(bashEntry.matcher).toBe("Bash");
    expect(bashEntry.hooks).toHaveLength(2);
    expect(bashEntry.hooks[0].command).toBe("echo manual");
    expect(bashEntry.hooks[1].command).toBe(
      `"\${CLAUDE_PROJECT_DIR}/.claude/hooks/typed-claude-hooks/PreToolUse/blockDangerous.sh"`,
    );
  });

  it("cleans up stale managed hooks from merged entries on rebuild", () => {
    const existing = {
      hooks: {
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [
              { type: "command", command: "echo manual" },
              {
                type: "command",
                command: `"\${CLAUDE_PROJECT_DIR}/.claude/hooks/typed-claude-hooks/PreToolUse/oldHandler.sh"`,
              },
            ],
          },
        ],
      },
    };

    const result = mergeHooksIntoSettings({
      existingSettings: existing,
      bundledFiles,
      managedCommandPrefix,
      projectRoot: "/project",
    });

    const bashEntry = result.hooks.PreToolUse[0];
    expect(bashEntry.matcher).toBe("Bash");

    const managedHooks = bashEntry.hooks.filter(
      (h: Record<string, unknown>) =>
        typeof h.command === "string" &&
        (h.command as string).includes("typed-claude-hooks") &&
        (h.command as string).endsWith('.sh"'),
    );
    expect(managedHooks).toHaveLength(1);
    expect(managedHooks[0].command).toBe(
      `"\${CLAUDE_PROJECT_DIR}/.claude/hooks/typed-claude-hooks/PreToolUse/blockDangerous.sh"`,
    );

    const manualHooks = bashEntry.hooks.filter(
      (h: Record<string, unknown>) =>
        !(
          typeof h.command === "string" &&
          (h.command as string).includes("typed-claude-hooks") &&
          (h.command as string).endsWith('.sh"')
        ),
    );
    expect(manualHooks).toHaveLength(1);
    expect(manualHooks[0].command).toBe("echo manual");
  });

  it("removes matcher entry when all hooks were managed and handler is removed", () => {
    const existing = {
      hooks: {
        PreToolUse: [
          {
            matcher: "Write",
            hooks: [
              {
                type: "command",
                command: `"\${CLAUDE_PROJECT_DIR}/.claude/hooks/typed-claude-hooks/Write/oldHandler.sh"`,
              },
            ],
          },
        ],
      },
    };

    const noWriteHandlers: PlannedArtifact[] = [
      {
        fileName: "blockDangerous.mjs",
        filePath:
          "/project/.claude/hooks/typed-claude-hooks/PreToolUse/blockDangerous.mjs",
        event: "PreToolUse",
        name: "blockDangerous",
        runtime: "node",
        wrapper: {
          contents: "wrapper",
          filePath:
            "/project/.claude/hooks/typed-claude-hooks/PreToolUse/blockDangerous.sh",
        },
        matcher: "Bash",
        timeout: undefined,
        if: undefined,
        statusMessage: undefined,
        async: undefined,
        asyncRewake: undefined,
      },
    ];

    const result = mergeHooksIntoSettings({
      existingSettings: existing,
      bundledFiles: noWriteHandlers,
      managedCommandPrefix,
      projectRoot: "/project",
    });

    const writeEntry = result.hooks.PreToolUse.find(
      (m: Record<string, unknown>) => m.matcher === "Write",
    );
    expect(writeEntry).toBeUndefined();
  });

  it("includes timeout in hook entry when set", () => {
    const filesWithTimeout: PlannedArtifact[] = [
      {
        fileName: "onStop.mjs",
        filePath: "/project/.claude/hooks/typed-claude-hooks/Stop/onStop.mjs",
        event: "Stop",
        name: "onStop",
        runtime: "node",
        wrapper: {
          contents: "wrapper",
          filePath: "/project/.claude/hooks/typed-claude-hooks/Stop/onStop.sh",
        },
        matcher: undefined,
        timeout: 5000,
        if: undefined,
        statusMessage: undefined,
        async: undefined,
        asyncRewake: undefined,
      },
    ];

    const result = mergeHooksIntoSettings({
      existingSettings: {},
      bundledFiles: filesWithTimeout,
      managedCommandPrefix,
      projectRoot: "/project",
    });

    expect(result.hooks.Stop[0].hooks[0].timeout).toBe(5000);
  });

  it("omits timeout from hook entry when not set", () => {
    const result = mergeHooksIntoSettings({
      existingSettings: {},
      bundledFiles,
      managedCommandPrefix,
      projectRoot: "/project",
    });

    expect(result.hooks.Stop[0].hooks[0]).not.toHaveProperty("timeout");
  });

  it("uses CLAUDE_PROJECT_DIR variable in hook command paths", () => {
    const result = mergeHooksIntoSettings({
      existingSettings: {},
      bundledFiles,
      managedCommandPrefix,
      projectRoot: "/project",
    });

    const hookEntry = result.hooks.PreToolUse[0].hooks[0];
    expect(hookEntry.command).toBe(
      `"\${CLAUDE_PROJECT_DIR}/.claude/hooks/typed-claude-hooks/PreToolUse/blockDangerous.sh"`,
    );
    expect(hookEntry).not.toHaveProperty("args");
  });

  it("keeps runtime selection out of the settings command", () => {
    const result = mergeHooksIntoSettings({
      existingSettings: {},
      bundledFiles: [{ ...bundledFiles[1], runtime: "deno" }],
      managedCommandPrefix,
      projectRoot: "/project",
    });

    expect(result.hooks.Stop[0].hooks[0].command).toBe(
      `"\${CLAUDE_PROJECT_DIR}/.claude/hooks/typed-claude-hooks/Stop/onStop.sh"`,
    );
  });

  it.each([
    [
      "bash",
      "onStop.sh",
      `"\${CLAUDE_PROJECT_DIR}/.claude/hooks/typed-claude-hooks/Stop/onStop.sh"`,
    ],
    [
      "powershell",
      "onStop.ps1",
      `& "\${CLAUDE_PROJECT_DIR}/.claude/hooks/typed-claude-hooks/Stop/onStop.ps1"`,
    ],
  ] as const)("invokes an explicit %s wrapper", (shell, wrapperName, command) => {
    const file = bundledFiles[1];
    const result = mergeHooksIntoSettings({
      existingSettings: {},
      bundledFiles: [
        {
          ...file,
          shell,
          wrapper: {
            contents: "wrapper",
            filePath: `/project/.claude/hooks/typed-claude-hooks/Stop/${wrapperName}`,
          },
        },
      ],
      managedCommandPrefix,
      projectRoot: "/project",
    });

    expect(result.hooks.Stop[0].hooks[0].command).toBe(command);
    expect(result.hooks.Stop[0].hooks[0].shell).toBe(shell);
  });

  it("preserves user commands whose paths merely contain typed-claude-hooks", () => {
    const auditCommand = `"\${CLAUDE_PROJECT_DIR}/audit/typed-claude-hooks/report.sh"`;
    const result = mergeHooksIntoSettings({
      existingSettings: {
        hooks: {
          Stop: [{ hooks: [{ type: "command", command: auditCommand }] }],
        },
      },
      bundledFiles,
      managedCommandPrefix,
      projectRoot: "/project",
    });

    expect(result.hooks.Stop[0].hooks[0].command).toBe(auditCommand);
  });

  it("preserves PowerShell user commands outside the managed prefix", () => {
    const auditCommand = `& "\${CLAUDE_PROJECT_DIR}/audit/typed-claude-hooks/report.ps1"`;
    const result = mergeHooksIntoSettings({
      existingSettings: {
        hooks: {
          Stop: [{ hooks: [{ type: "command", command: auditCommand }] }],
        },
      },
      bundledFiles,
      managedCommandPrefix,
      projectRoot: "/project",
    });

    expect(result.hooks.Stop[0].hooks[0].command).toBe(auditCommand);
  });

  it.each([
    "oldHandler.sh",
    "oldHandler.ps1",
  ])("removes an exact managed %s wrapper command", (fileName) => {
    const result = mergeHooksIntoSettings({
      existingSettings: {
        hooks: {
          PreToolUse: [
            {
              matcher: "Write",
              hooks: [
                {
                  type: "command",
                  command: `"${managedCommandPrefix}PreToolUse/${fileName}"`,
                },
              ],
            },
          ],
        },
      },
      bundledFiles,
      managedCommandPrefix,
      projectRoot: "/project",
    });

    expect(
      result.hooks.PreToolUse.some(
        (entry: { matcher?: string }) => entry.matcher === "Write",
      ),
    ).toBe(false);
  });

  it("removes a legacy unquoted managed bash wrapper command", () => {
    const result = mergeHooksIntoSettings({
      existingSettings: {
        hooks: {
          PreToolUse: [
            {
              matcher: "Write",
              hooks: [
                {
                  type: "command",
                  command: `${managedCommandPrefix}PreToolUse/oldHandler.sh`,
                },
              ],
            },
          ],
        },
      },
      bundledFiles,
      managedCommandPrefix,
      projectRoot: "/project",
    });

    expect(
      result.hooks.PreToolUse.some(
        (entry: { matcher?: string }) => entry.matcher === "Write",
      ),
    ).toBe(false);
  });

  it("replaces an existing managed PowerShell call command", () => {
    const file = bundledFiles[1];
    const result = mergeHooksIntoSettings({
      existingSettings: {
        hooks: {
          Stop: [
            {
              hooks: [
                {
                  type: "command",
                  command: `& "${managedCommandPrefix}Stop/oldHandler.ps1"`,
                },
              ],
            },
          ],
        },
      },
      bundledFiles: [
        {
          ...file,
          shell: "powershell",
          wrapper: {
            ...file.wrapper,
            filePath:
              "/project/.claude/hooks/typed-claude-hooks/Stop/onStop.ps1",
          },
        },
      ],
      managedCommandPrefix,
      projectRoot: "/project",
    });

    expect(result.hooks.Stop[0].hooks).toEqual([
      {
        type: "command",
        command: `& "${managedCommandPrefix}Stop/onStop.ps1"`,
        shell: "powershell",
      },
    ]);
  });

  it("appends managed hooks only to the first duplicate matcher entry", () => {
    const result = mergeHooksIntoSettings({
      existingSettings: {
        hooks: {
          PreToolUse: [
            {
              matcher: "Bash",
              hooks: [{ type: "command", command: "echo first" }],
            },
            {
              matcher: "Bash",
              hooks: [{ type: "command", command: "echo second" }],
            },
          ],
        },
      },
      bundledFiles,
      managedCommandPrefix,
      projectRoot: "/project",
    });

    expect(result.hooks.PreToolUse[0].hooks).toHaveLength(2);
    expect(result.hooks.PreToolUse[1].hooks).toEqual([
      { type: "command", command: "echo second" },
    ]);
  });

  it("is idempotent across repeated merges", () => {
    const first = mergeHooksIntoSettings({
      existingSettings: { permissions: { allow: ["Bash(npm test)"] } },
      bundledFiles,
      managedCommandPrefix,
      projectRoot: "/project",
    });
    const second = mergeHooksIntoSettings({
      existingSettings: first,
      bundledFiles,
      managedCommandPrefix,
      projectRoot: "/project",
    });

    expect(second).toEqual(first);
  });

  it("normalizes Windows separators in generated commands", () => {
    const file = bundledFiles[1];
    const result = mergeHooksIntoSettings({
      existingSettings: {},
      bundledFiles: [
        {
          ...file,
          shell: "powershell",
          wrapper: {
            ...file.wrapper,
            filePath:
              "/project/.claude\\hooks\\typed-claude-hooks\\Stop\\onStop.ps1",
          },
        },
      ],
      managedCommandPrefix,
      projectRoot: "/project",
    });

    expect(result.hooks.Stop[0].hooks[0].command).toBe(
      `& "\${CLAUDE_PROJECT_DIR}/.claude/hooks/typed-claude-hooks/Stop/onStop.ps1"`,
    );
  });
});
