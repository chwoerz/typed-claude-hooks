import { describe, expect, it } from "vitest";
import {
  buildHookEntries,
  createSettingsSnippet,
  createWrapperArtifact,
  type PlannedArtifactPaths,
  planArtifactPaths,
} from "../../src/compiler/artifact-plan.js";
import { projectRelativeLogicalPath } from "../../src/compiler/project-path.js";

describe("artifact plan", () => {
  it.each([
    [undefined, "node", "blockDangerous.sh", "command -v node"],
    ["bash", "deno", "blockDangerous.sh", "exec deno run --allow-all"],
    ["powershell", "bun", "blockDangerous.ps1", "Get-Command bun"],
  ] as const)("plans deterministic %s wrapper paths", (shell, runtime, wrapperName, wrapperCheck) => {
    const handler = {
      event: "PreToolUse",
      name: "blockDangerous",
      ...(shell ? { shell } : {}),
    };

    const artifact = planArtifactPaths(handler, "/project/.claude/hooks", runtime);

    expect(artifact.fileName).toBe("blockDangerous.mjs");
    expect(artifact.filePath).toBe("/project/.claude/hooks/PreToolUse/blockDangerous.mjs");
    expect(artifact.runtime).toBe(runtime);
    expect(artifact.wrapper.filePath).toBe(`/project/.claude/hooks/PreToolUse/${wrapperName}`);
    expect(artifact.wrapper.contents).toContain(wrapperCheck);
  });

  it("renders a wrapper artifact from an mjs path", () => {
    const wrapper = createWrapperArtifact(
      { event: "Stop", name: "onStop", shell: "powershell" },
      "/project/hooks/Stop/onStop.mjs",
      "deno",
    );

    expect(wrapper.filePath).toBe("/project/hooks/Stop/onStop.ps1");
    expect(wrapper.contents).toContain('$scriptPath = Join-Path $scriptDir "onStop.mjs"');
    expect(wrapper.contents).toContain("& deno run --allow-all $scriptPath @args");
  });

  it("groups artifacts by event and matcher while preserving handler order", () => {
    const artifacts: PlannedArtifactPaths[] = [
      createArtifact("first", "PreToolUse", "Bash"),
      createArtifact("stop", "Stop"),
      createArtifact("second", "PreToolUse", "Bash"),
      createArtifact("write", "PreToolUse", "Write"),
    ];

    const hooks = buildHookEntries(artifacts, "/project");

    expect(hooks.PreToolUse.map(({ matcher }) => matcher)).toEqual(["Bash", "Write"]);
    expect(hooks.PreToolUse[0].hooks.map(({ command }) => command)).toEqual([
      `"\${CLAUDE_PROJECT_DIR}/hooks/PreToolUse/first.sh"`,
      `"\${CLAUDE_PROJECT_DIR}/hooks/PreToolUse/second.sh"`,
    ]);
    expect(hooks.Stop[0]).not.toHaveProperty("matcher");
  });

  it("creates a fresh settings snippet with exact wrapper commands and defined options", () => {
    const bash = createArtifact("bashHook", "Stop");
    const powershell = createArtifact("psHook", "Stop", undefined, "powershell");
    powershell.timeout = 5000;
    const builtBash = { ...bash, contents: "bundled JavaScript" };

    const snippet = createSettingsSnippet([builtBash, powershell], "/project");

    expect(snippet).toEqual({
      hooks: {
        Stop: [
          {
            hooks: [
              {
                type: "command",
                command: `"\${CLAUDE_PROJECT_DIR}/hooks/Stop/bashHook.sh"`,
              },
              {
                type: "command",
                command: `& "\${CLAUDE_PROJECT_DIR}/hooks/Stop/psHook.ps1"`,
                shell: "powershell",
                timeout: 5000,
              },
            ],
          },
        ],
      },
    });
    expect(snippet.hooks.Stop[0].hooks[0]).not.toHaveProperty("contents");
  });

  it("creates Windows commands relative to case-insensitively equivalent project paths", () => {
    const artifact = planArtifactPaths(
      { event: "Stop", name: "onStop" },
      "c:\\users\\example\\project\\.claude\\hooks",
      "node",
    );

    const snippet = createSettingsSnippet([artifact], "C:\\Users\\Example\\Project");

    expect(snippet.hooks.Stop[0].hooks[0].command).toBe(`"\${CLAUDE_PROJECT_DIR}/.claude/hooks/Stop/onStop.sh"`);
  });

  it("rejects Windows settings paths on a different drive", () => {
    const artifact = planArtifactPaths({ event: "Stop", name: "onStop" }, "D:\\hooks", "node");

    expect(() => createSettingsSnippet([artifact], "C:\\project")).toThrow(/different drives.*C:.*D:/i);
  });

  it("creates UNC commands relative to a case-insensitively equivalent share", () => {
    const artifact = planArtifactPaths(
      { event: "Stop", name: "onStop" },
      "\\\\server\\share\\Project\\.claude\\hooks",
      "node",
    );

    const snippet = createSettingsSnippet([artifact], "//SERVER/SHARE/project");

    expect(snippet.hooks.Stop[0].hooks[0].command).toBe(`"\${CLAUDE_PROJECT_DIR}/.claude/hooks/Stop/onStop.sh"`);
  });

  it("rejects UNC settings paths on a different server or share", () => {
    const artifact = planArtifactPaths({ event: "Stop", name: "onStop" }, "\\\\server\\other-share\\hooks", "node");

    expect(() => createSettingsSnippet([artifact], "//server/share/project")).toThrow(
      /different UNC roots.*server\/share.*server\/other-share/i,
    );
  });
});

describe("project-relative logical paths", () => {
  it("handles Windows paths case-insensitively without malformed commands", () => {
    expect(
      projectRelativeLogicalPath(
        "C:\\Users\\Example\\Project",
        "c:\\users\\example\\project\\.claude\\hooks\\handler.sh",
        "win32",
      ),
    ).toBe(".claude/hooks/handler.sh");
  });

  it("rejects Windows targets on a different drive", () => {
    expect(() => projectRelativeLogicalPath("C:\\project", "D:\\hooks\\handler.sh", "win32")).toThrow(
      /different drives.*C:.*D:/i,
    );
  });
});

function createArtifact(
  name: string,
  event: string,
  matcher?: string,
  shell?: "bash" | "powershell",
): PlannedArtifactPaths {
  return planArtifactPaths({ event, name, matcher, shell }, "/project/hooks", "node");
}
