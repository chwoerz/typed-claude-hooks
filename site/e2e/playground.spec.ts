import { expect, test, type Page } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";

const browserErrors = new WeakMap<Page, string[]>();
const pasteShortcut = process.platform === "darwin" ? "Meta+V" : "Control+V";

const starterSource = `import { defineHandler } from "typed-claude-hooks"

export const blockRm = defineHandler(
  "PreToolUse",
  { matcher: "Bash" },
  async (input) => ({
    hookSpecificOutput: input.tool_input.command.includes("rm ")
      ? {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: "Blocked rm",
        }
      : undefined,
  }),
)
`;

const editedSource = `import { defineHandler } from "typed-claude-hooks"

export const guardWrite = defineHandler(
  "PreToolUse",
  { matcher: "Write" },
  async (input) => ({
    systemMessage: input.tool_input.file_path.includes("secret-token-e2e")
      ? "review write"
      : undefined,
  }),
)
`;

test.describe("hook playground", () => {
  test.beforeEach(async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    browserErrors.set(page, errors);
  });

  test.afterEach(async ({ page }) => {
    expect(browserErrors.get(page), "browser errors").toEqual([]);
  });

  test("loads Monaco, builds the starter, and offers typed completions", async ({
    page,
  }) => {
    await openReadyPlayground(page);
    expect(
      await page
        .locator("[data-playground-root]")
        .evaluate((root) => Object.hasOwn(root, "playgroundApp")),
    ).toBe(false);
    await expect(page.locator(".monaco-editor")).toBeVisible();
    await expect(page.locator('[data-playground="diagnostics"]')).toHaveText(
      "No diagnostics.",
    );
    await expect(page.locator('[data-action="download"]')).toBeEnabled();

    await setSource(page, completionSource("input.tool_input."));
    await page.keyboard.press("Control+Space");
    await expect(page.locator(".suggest-widget")).toBeVisible();
    await expect(page.locator(".suggest-widget")).toContainText(
      /file_path|content/,
    );
    await page.keyboard.press("Escape");

    await setSource(page, 'import * as fs from "node:fs"\nfs.');
    await triggerCompletion(page);
    await expect(page.locator(".suggest-widget")).toBeVisible();
    await expect(page.locator(".suggest-widget")).toContainText(
      /ReadStream|appendFile/,
    );
  });

  test("updates the settings preview automatically without transmitting source", async ({
    page,
  }) => {
    const requests: Array<{ url: string; postData: string }> = [];
    page.on("request", (request) => {
      requests.push({ url: request.url(), postData: request.postData() ?? "" });
    });
    await openReadyPlayground(page);
    await setSource(page, editedSource);

    await expect(page.locator('[data-playground="status"]')).toHaveText(
      "Build valid",
    );
    await expect(page.locator('[data-playground="handlers"]')).toContainText(
      "guardWrite",
    );
    await expect(page.locator('[data-playground="settings"]')).toContainText(
      '"matcher": "Write"',
    );
    expect(
      requests.every(
        ({ url, postData }) =>
          !`${url}${postData}`.includes("secret-token-e2e"),
      ),
    ).toBe(true);
    const editedRequests = requests.slice();
    expect(
      editedRequests.every(({ url }) => {
        const { hostname } = new URL(url);
        return (
          hostname === "127.0.0.1" ||
          hostname === "fonts.googleapis.com" ||
          hostname === "fonts.gstatic.com"
        );
      }),
    ).toBe(true);
  });

  test("disables download for invalid source and recovers", async ({
    page,
  }) => {
    await openReadyPlayground(page);
    await setSource(page, "export const broken = (");
    await expect(page.locator('[data-playground="status"]')).toHaveText(
      "Build has errors",
    );
    await expect(
      page.locator('[data-playground="diagnostic-badge"]'),
    ).not.toHaveText("0");
    await expect(page.locator('[data-action="download"]')).toBeDisabled();

    await setSource(page, starterSource);
    await expectReady(page);
  });

  test("reset respects cancellation and restores the starter after acceptance", async ({
    page,
  }) => {
    await openReadyPlayground(page);
    await setSource(page, editedSource);
    await expect(page.locator('[data-playground="handlers"]')).toContainText(
      "guardWrite",
    );

    page.once("dialog", (dialog) => dialog.dismiss());
    await page.locator('[data-action="reset"]').click();
    await expect(page.locator('[data-playground="handlers"]')).toContainText(
      "guardWrite",
    );

    page.once("dialog", (dialog) => dialog.accept());
    await page.locator('[data-action="reset"]').click();
    await expect(page.locator('[data-playground="handlers"]')).toContainText(
      "blockRm",
    );
    await expectReady(page);
  });

  test("downloads the exact generated archive", async ({ page }) => {
    await openReadyPlayground(page);
    const downloadPromise = page.waitForEvent("download");
    await page.locator('[data-action="download"]').click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const files = Object.fromEntries(
      Object.entries(unzipSync(Buffer.concat(chunks))).map(([path, bytes]) => [
        path,
        strFromU8(bytes),
      ]),
    );

    expect(download.suggestedFilename()).toBe("typed-claude-hooks.zip");
    expect(Object.keys(files)).toEqual([
      "hooks.config.ts",
      "settings.hooks.snippet.json",
      "README.txt",
      ".claude/hooks/typed-claude-hooks/PreToolUse/blockRm.mjs",
      ".claude/hooks/typed-claude-hooks/PreToolUse/blockRm.sh",
    ]);
    expect(files["hooks.config.ts"]).toBe(starterSource);
    expect(JSON.parse(files["settings.hooks.snippet.json"])).toMatchObject({
      hooks: { PreToolUse: [{ matcher: "Bash" }] },
    });
    expect(files["README.txt"]).toContain(
      "DO NOT REPLACE .claude/settings.json",
    );
    expect(
      files[".claude/hooks/typed-claude-hooks/PreToolUse/blockRm.mjs"],
    ).toContain("// Generated by typed-claude-hooks - do not edit");
    const mjs =
      files[".claude/hooks/typed-claude-hooks/PreToolUse/blockRm.mjs"];
    expect(mjs).toContain('process.stdin.setEncoding("utf8")');
    expect(mjs).toContain("JSON.parse(__stdin)");
    expect(mjs).toContain('input.tool_input.command.includes("rm ")');
    expect(mjs).toContain("blockRm.handler(__input)");
    expect(mjs).not.toContain("guardWrite");

    const wrapper =
      files[".claude/hooks/typed-claude-hooks/PreToolUse/blockRm.sh"];
    expect(wrapper.split("\n")).toEqual([
      "#!/usr/bin/env bash",
      "# Generated by typed-claude-hooks - do not edit",
      "if ! command -v node >/dev/null 2>&1; then",
      '  echo "typed-claude-hooks: node is required but not installed" >&2',
      "  exit 2",
      "fi",
      'SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"',
      'exec node "$SCRIPT_DIR/blockRm.mjs" "$@"',
      "",
    ]);
  });

  test("recovers after compiler initialization failure", async ({ page }) => {
    let aborted = false;
    const failedRequests: Array<{
      url: string;
      errorText: string | undefined;
    }> = [];
    page.on("requestfailed", (request) => {
      failedRequests.push({
        url: request.url(),
        errorText: request.failure()?.errorText,
      });
    });
    await page.route(/esbuild.*\.wasm/, async (route) => {
      if (!aborted) {
        aborted = true;
        await route.abort("failed");
        return;
      }
      await route.continue();
    });
    await page.goto("playground/");
    await expect(page.locator('[data-playground="status"]')).toHaveText(
      "Compiler initialization failed",
    );
    await expect(page.locator('[data-action="retry"]')).toBeVisible();
    await page.locator('[data-action="retry"]').click();
    await expectReady(page);
    expect(aborted).toBe(true);
    expect(failedRequests).toHaveLength(1);
    expect(failedRequests[0]?.url).toMatch(
      /^http:\/\/127\.0\.0\.1:4173\/typed-claude-hooks\/_astro\/esbuild-.+\.wasm$/,
    );
    expect(failedRequests[0]?.errorText).toBe("net::ERR_FAILED");
  });

  test("stacks at mobile width without horizontal overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openReadyPlayground(page);
    const dimensions = await page
      .locator("[data-playground-root]")
      .evaluate((root) => {
        const editor = root.querySelector<HTMLElement>(
          ".playground__editor-panel",
        );
        const output = root.querySelector<HTMLElement>(".playground__output");
        if (!editor || !output) throw new Error("Missing playground panels");
        const editorBox = editor.getBoundingClientRect();
        const outputBox = output.getBoundingClientRect();
        return {
          editorBottom: editorBox.bottom,
          editorHeight: editorBox.height,
          outputTop: outputBox.top,
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
        };
      });
    expect(dimensions.editorHeight).toBeGreaterThan(300);
    expect(dimensions.outputTop).toBeGreaterThanOrEqual(
      dimensions.editorBottom - 1,
    );
    expect(dimensions.documentWidth).toBe(dimensions.viewportWidth);
  });
});

async function openReadyPlayground(page: Page): Promise<void> {
  await page.goto("playground/");
  await expect(page.locator(".monaco-editor textarea")).toBeAttached();
  await expectReady(page);
}

async function expectReady(page: Page): Promise<void> {
  await expect(page.locator('[data-playground="status"]')).toHaveText(
    "Build valid",
    { timeout: 20_000 },
  );
  await expect(page.locator('[data-playground="diagnostic-badge"]')).toHaveText(
    "0",
  );
  await expect(page.locator('[data-action="download"]')).toBeEnabled();
}

async function setSource(page: Page, source: string): Promise<void> {
  await page.evaluate((value) => navigator.clipboard.writeText(value), source);
  await page.locator(".monaco-editor .view-lines").click();
  await page.keyboard.press("Control+Home");
  await page.keyboard.press("Control+Shift+End");
  await expect(
    page.locator(".monaco-editor .selected-text").first(),
  ).toBeVisible();
  await page.keyboard.press(pasteShortcut);
  await expect(page.locator(".view-lines")).toContainText(
    source.split("\n").find((line) => line.trim()) ?? source,
  );
}

async function triggerCompletion(page: Page): Promise<void> {
  await page.keyboard.press("Control+Space");
}

function completionSource(expression: string): string {
  return `import { readFile } from "node:fs"
import { defineHandler } from "typed-claude-hooks"

export const inspectWrite = defineHandler("PreToolUse", { matcher: "Write" }, async (input) => {
  ${expression}`;
}
