import { execSync } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build } from "../../src/cli/build.js";

const FIXTURE_CONFIG = resolve(
  import.meta.dirname,
  "../fixtures/sample-hooks.config.ts",
);
const TMP_DIR = resolve(
  import.meta.dirname,
  "../fixtures/.tmp-generated-files",
);
const SNAPSHOT_DIR = resolve(import.meta.dirname, "__snapshots__/generated");
const SETTINGS_PATH = resolve(TMP_DIR, "settings.json");
const HOOKS_DIR = resolve(TMP_DIR, "hooks");
const MANAGED_DIR = resolve(HOOKS_DIR, "typed-claude-hooks");

function stabilize(content: string): string {
  return content.replace(/\/\/ tests\/fixtures\/.+/g, "// <fixture>");
}

describe("generated files", () => {
  beforeAll(async () => {
    rmSync(TMP_DIR, { recursive: true, force: true });
    mkdirSync(TMP_DIR, { recursive: true });
    writeFileSync(
      SETTINGS_PATH,
      JSON.stringify({ model: "claude-sonnet-4-6" }),
    );

    await build({
      config: FIXTURE_CONFIG,
      output: SETTINGS_PATH,
      hooksDir: HOOKS_DIR,
    });
  });

  afterAll(() => {
    rmSync(TMP_DIR, { recursive: true, force: true });
  });

  describe("file snapshots", () => {
    it("PreToolUse/blockDangerous.mjs", async () => {
      const content = readFileSync(
        resolve(MANAGED_DIR, "PreToolUse/blockDangerous.mjs"),
        "utf-8",
      );
      await expect(stabilize(content)).toMatchFileSnapshot(
        resolve(SNAPSHOT_DIR, "PreToolUse/blockDangerous.mjs"),
      );
    });

    it("PreToolUse/blockDangerous.sh", async () => {
      const content = readFileSync(
        resolve(MANAGED_DIR, "PreToolUse/blockDangerous.sh"),
        "utf-8",
      );
      await expect(content).toMatchFileSnapshot(
        resolve(SNAPSHOT_DIR, "PreToolUse/blockDangerous.sh"),
      );
    });

    it("Stop/onStop.mjs", async () => {
      const content = readFileSync(
        resolve(MANAGED_DIR, "Stop/onStop.mjs"),
        "utf-8",
      );
      await expect(stabilize(content)).toMatchFileSnapshot(
        resolve(SNAPSHOT_DIR, "Stop/onStop.mjs"),
      );
    });

    it("Stop/onStop.sh", async () => {
      const content = readFileSync(
        resolve(MANAGED_DIR, "Stop/onStop.sh"),
        "utf-8",
      );
      await expect(content).toMatchFileSnapshot(
        resolve(SNAPSHOT_DIR, "Stop/onStop.sh"),
      );
    });

    it("settings.json", async () => {
      const content = readFileSync(SETTINGS_PATH, "utf-8");
      const settings = JSON.parse(content);
      const normalized = JSON.parse(
        JSON.stringify(settings, (_key, value) => {
          if (typeof value === "string" && value.includes("hooks/")) {
            return value.slice(value.indexOf("hooks/"));
          }
          return value;
        }),
      );
      await expect(
        `${JSON.stringify(normalized, null, 2)}\n`,
      ).toMatchFileSnapshot(resolve(SNAPSHOT_DIR, "settings.json"));
    });
  });

  describe("structural checks", () => {
    it("handler bundles are syntactically valid Node.js", () => {
      execSync(`node --check blockDangerous.mjs`, {
        cwd: resolve(MANAGED_DIR, "PreToolUse"),
        timeout: 5000,
      });
      execSync(`node --check onStop.mjs`, {
        cwd: resolve(MANAGED_DIR, "Stop"),
        timeout: 5000,
      });
    });

    it("handler bundles are self-contained (no runtime.mjs)", () => {
      const content = readFileSync(
        resolve(MANAGED_DIR, "PreToolUse/blockDangerous.mjs"),
        "utf-8",
      );
      expect(content).toContain("process.stdin");
      expect(content).not.toContain('require("./runtime.mjs")');
    });

    it("wrapper scripts are executable", () => {
      const mode = statSync(
        resolve(MANAGED_DIR, "PreToolUse/blockDangerous.sh"),
      ).mode;
      expect(mode & 0o111).toBeGreaterThan(0);
    });
  });

  describe("handler execution", () => {
    it("PreToolUse handler passes through safe commands", () => {
      const payload = JSON.stringify({
        session_id: "test",
        transcript_path: "/tmp/test.jsonl",
        cwd: "/tmp",
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: "ls" },
        tool_use_id: "tu_1",
      });

      const result = execSync(`echo '${payload}' | node blockDangerous.mjs`, {
        encoding: "utf-8",
        cwd: resolve(MANAGED_DIR, "PreToolUse"),
      });
      expect(result.trim()).toBe("");
    });

    it("PreToolUse wrapper script passes through safe commands", () => {
      const payload = JSON.stringify({
        session_id: "test",
        transcript_path: "/tmp/test.jsonl",
        cwd: "/tmp",
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: "ls" },
        tool_use_id: "tu_1",
      });

      const result = execSync(`echo '${payload}' | ./blockDangerous.sh`, {
        encoding: "utf-8",
        cwd: resolve(MANAGED_DIR, "PreToolUse"),
      });
      expect(result.trim()).toBe("");
    });

    it("Stop handler produces empty output", () => {
      const payload = JSON.stringify({
        session_id: "test",
        transcript_path: "/tmp/test.jsonl",
        cwd: "/tmp",
        hook_event_name: "Stop",
        stop_hook_active: false,
      });

      const result = execSync(`echo '${payload}' | node onStop.mjs`, {
        encoding: "utf-8",
        cwd: resolve(MANAGED_DIR, "Stop"),
      });
      expect(result.trim()).toBe("");
    });
  });
});
