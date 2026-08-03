import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("../src/", import.meta.url);

async function source(path: string): Promise<string> {
  return readFile(new URL(path, root), "utf8");
}

describe("playground page", () => {
  it("provides the semantic workspace and all required output sections", async () => {
    const component = await source("components/Playground.astro");

    expect(component).toContain('<main id="main-content"');
    expect(component).toContain('aria-live="polite"');
    expect(component).toContain('data-playground="diagnostics"');
    expect(component).toContain('data-playground="handlers"');
    expect(component).toContain('data-playground="settings"');
    expect(component).toContain('data-playground="files"');
    expect(component).toContain(".typed-claude-hooks/hooks.config.ts");
    expect(component).toContain(".claude/hooks/typed-claude-hooks/");
    expect(component).toContain('data-action="reset"');
    expect(component).toContain('data-action="download"');
    expect(component).toContain('data-action="retry"');
  });

  it("wires Monaco, diagnostics, reset confirmation, ZIP creation, and cleanup safely", async () => {
    const app = await source("playground/app.ts");

    expect(app).toContain("initializeEditor(");
    expect(app).toContain("updateDiagnostics");
    expect(app).toContain("onDidChangeContent");
    expect(app).toContain("globalThis.confirm(");
    expect(app).toContain("controller.reset()");
    expect(app).toContain("createPlaygroundZip(");
    expect(app).toContain("downloadPlaygroundZip(");
    expect(app).toContain("textContent");
    expect(app).not.toContain("innerHTML");
    expect(app).toContain('addEventListener("beforeunload"');
  });

  it("uses a responsive split layout without horizontal page overflow", async () => {
    const styles = await source("styles/playground.css");

    expect(styles).toMatch(
      /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/,
    );
    expect(styles).toContain("overflow-x: hidden");
    expect(styles).toMatch(/@media\s*\(max-width:/);
    expect(styles).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\);/);
    expect(styles).toMatch(/min-height:\s*(?:28rem|4[5-9]vh|[5-9][0-9]vh)/);
    expect(styles).toMatch(/height:\s*clamp\(/);
    expect(styles).toContain("grid-template-rows: minmax(0, 1fr)");
    expect(styles).toMatch(
      /\.playground__editor\s*>\s*\.monaco-editor\s*{[^}]*position:\s*absolute/s,
    );
  });

  it("marks the loading fallback for removal after editor initialization", async () => {
    const component = await source("components/Playground.astro");
    const app = await source("playground/app.ts");

    expect(component).toContain('data-playground="editor-loading"');
    expect(app).toContain("loading?.remove()");
  });

  it("adds a base-safe current Playground navigation link", async () => {
    const header = await source("components/Header.astro");

    expect(header).toContain(
      'const base = `${import.meta.env.BASE_URL.replace(/\\/$/, "")}/`',
    );
    expect(header).toContain("const playground = `${base}playground/`");
    expect(header).toContain("Playground</a>");
    expect(header).toContain('currentPath === playground ? "page"');
  });

  it("documents the Playground workflow and limitations with base-safe links", async () => {
    const docs = await source("components/Docs.astro");
    const quickStart = await source("components/QuickStart.astro");

    expect(docs).toContain("const playground = `${base}playground/`");
    expect(quickStart).toContain("const playground = `${base}playground/`");
    expect(docs).toContain("Monaco");
    expect(docs).toContain("does not execute hooks");
    expect(docs).toContain("arbitrary or extra npm packages");
    expect(docs).toContain("one <code>hooks.config.ts</code>");
    expect(docs).toContain("Node only");
    expect(docs).toContain("direct named <code>export const</code>");
    expect(docs).toContain("not persisted or uploaded");
    expect(docs).toContain("do not replace");
    expect(quickStart).toContain("Try the Playground");
  });

  it("defines page metadata and delegates the sole main landmark", async () => {
    const page = await source("pages/playground.astro");

    expect(page).toContain("Hook Playground | typed-claude-hooks");
    expect(page).toContain(
      "Build type-safe Claude Code hook artifacts in your browser",
    );
    expect(page).toContain("<Playground />");
    expect(page).not.toContain("<main");
  });
});
