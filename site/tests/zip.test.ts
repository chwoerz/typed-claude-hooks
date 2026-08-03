import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";
import type {
  PlaygroundArtifact,
  PlaygroundSettings,
} from "../src/playground/compiler/types";
import { createPlaygroundReadme } from "../src/playground/readme";
import {
  createPlaygroundZip,
  downloadPlaygroundZip,
} from "../src/playground/zip";

const settings: PlaygroundSettings = {
  hooks: {
    PreToolUse: [
      {
        matcher: "Bash",
        hooks: [
          {
            type: "command",
            command:
              '"${CLAUDE_PROJECT_DIR}/.claude/hooks/typed-claude-hooks/PreToolUse/blockRm.sh"',
          },
        ],
      },
    ],
  },
};

describe("playground ZIP", () => {
  it("contains exact deterministic names, source, settings, README, and artifacts", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2020-01-01T00:00:00Z"));
    const firstBytes = createPlaygroundZip("source\n", settings, [
      bashArtifact(),
    ]);
    vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
    const secondBytes = createPlaygroundZip("source\n", settings, [
      bashArtifact(),
    ]);
    const archive = unzip(firstBytes);
    expect(Object.keys(archive)).toEqual([
      "hooks.config.ts",
      "settings.hooks.snippet.json",
      "README.txt",
      ".claude/hooks/typed-claude-hooks/PreToolUse/blockRm.mjs",
      ".claude/hooks/typed-claude-hooks/PreToolUse/blockRm.sh",
    ]);
    expect(archive["hooks.config.ts"]).toBe("source\n");
    expect(archive["settings.hooks.snippet.json"]).toBe(
      `${JSON.stringify(settings, null, 2)}\n`,
    );
    expect(
      archive[".claude/hooks/typed-claude-hooks/PreToolUse/blockRm.mjs"],
    ).toBe("mjs contents");
    expect(
      archive[".claude/hooks/typed-claude-hooks/PreToolUse/blockRm.sh"],
    ).toBe("sh contents");
    expect(archive["README.txt"]).toBe(createPlaygroundReadme(settings));
    expect(firstBytes).toEqual(secondBytes);
    vi.useRealTimers();
  });

  it("includes PowerShell wrappers using their exact ps1 path", () => {
    const artifact = bashArtifact();
    artifact.shell = "powershell";
    artifact.wrapper = {
      filePath: ".claude/hooks/typed-claude-hooks/PreToolUse/blockRm.ps1",
      contents: "pwsh contents",
    };
    const archive = unzip(createPlaygroundZip("source", settings, [artifact]));
    expect(archive[artifact.wrapper.filePath]).toBe("pwsh contents");
    expect(Object.keys(archive)).not.toContain(
      ".claude/hooks/typed-claude-hooks/PreToolUse/blockRm.sh",
    );
  });

  it.each([
    "../escape.mjs",
    "/.claude/hooks/typed-claude-hooks/Stop/absolute.mjs",
    ".claude/hooks/typed-claude-hooks/Stop/../escape.mjs",
    ".claude\\hooks\\typed-claude-hooks\\Stop\\bad.mjs",
    ".claude/hooks/other/Stop/bad.mjs",
  ])("rejects unsafe artifact path %s", (filePath) => {
    const artifact = bashArtifact();
    artifact.filePath = filePath;
    expect(() => createPlaygroundZip("source", settings, [artifact])).toThrow(
      /Unsafe artifact path/,
    );
  });

  it.each([
    "../escape.sh",
    "/.claude/hooks/typed-claude-hooks/PreToolUse/blockRm.sh",
    ".claude/hooks/typed-claude-hooks/PreToolUse/../blockRm.sh",
    ".claude\\hooks\\typed-claude-hooks\\PreToolUse\\blockRm.sh",
    ".claude/hooks/other/PreToolUse/blockRm.sh",
  ])("rejects unsafe wrapper path %s", (filePath) => {
    const artifact = bashArtifact();
    artifact.wrapper.filePath = filePath;
    expect(() => createPlaygroundZip("source", settings, [artifact])).toThrow(
      /Unsafe artifact path/,
    );
  });

  it("rejects duplicate artifact and wrapper entry paths", () => {
    expect(() =>
      createPlaygroundZip("source", settings, [bashArtifact(), bashArtifact()]),
    ).toThrow(/Duplicate ZIP entry path/);
  });

  it("rejects unsafe handler metadata even when its artifact paths match", () => {
    const artifact = bashArtifact();
    artifact.name = "nested/blockRm";
    artifact.filePath =
      ".claude/hooks/typed-claude-hooks/PreToolUse/nested/blockRm.mjs";
    artifact.wrapper.filePath =
      ".claude/hooks/typed-claude-hooks/PreToolUse/nested/blockRm.sh";
    expect(() => createPlaygroundZip("source", settings, [artifact])).toThrow(
      /Unsafe artifact path/,
    );
  });

  it("documents merge-only installation precisely in plain ASCII", () => {
    const readme = createPlaygroundReadme(settings);
    expect(readme).toContain("DO NOT REPLACE .claude/settings.json");
    expect(readme).toContain(".typed-claude-hooks/hooks.config.ts");
    expect(readme).toContain(
      "Move the extracted .claude/hooks/typed-claude-hooks directory",
    );
    expect(readme).toContain("append each matcher entry");
    expect(readme).toContain("Node.js");
    expect(readme).toContain(
      "find .claude/hooks/typed-claude-hooks -type f -name '*.sh' -exec chmod +x {} +",
    );
    expect(readme).toContain("PowerShell .ps1 wrappers require PowerShell");
    expect(readme).toContain("do not require chmod");
    expect(readme).toContain("${CLAUDE_PROJECT_DIR}/.claude/hooks");
    expect(readme).toMatch(/PreToolUse.*Bash/s);
    expect(
      [...readme].every((character) => character.charCodeAt(0) < 128),
    ).toBe(true);
  });

  it("revokes the temporary object URL in a task after clicking", () => {
    const events: string[] = [];
    const click = vi.fn(() => events.push("click"));
    const anchor = { click, download: "", href: "" };
    const createObjectURL = vi.fn(() => "blob:test");
    const revokeObjectURL = vi.fn(() => events.push("revoke"));
    let scheduled: (() => void) | undefined;
    downloadPlaygroundZip(new Uint8Array([1, 2]), "hooks.zip", {
      createAnchor: () => anchor,
      createObjectURL,
      revokeObjectURL,
      schedule: (callback) => {
        scheduled = callback;
      },
    });
    expect(anchor).toMatchObject({ href: "blob:test", download: "hooks.zip" });
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    expect(events).toEqual(["click"]);

    scheduled?.();

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");
    expect(events).toEqual(["click", "revoke"]);
  });
});

function bashArtifact(): PlaygroundArtifact {
  return {
    name: "blockRm",
    event: "PreToolUse",
    matcher: "Bash",
    fileName: "blockRm.mjs",
    filePath: ".claude/hooks/typed-claude-hooks/PreToolUse/blockRm.mjs",
    contents: "mjs contents",
    wrapper: {
      filePath: ".claude/hooks/typed-claude-hooks/PreToolUse/blockRm.sh",
      contents: "sh contents",
    },
  };
}

function unzip(bytes: Uint8Array): Record<string, string> {
  return Object.fromEntries(
    Object.entries(unzipSync(bytes)).map(([path, contents]) => [
      path,
      strFromU8(contents),
    ]),
  );
}
