import { strToU8, zipSync, type Zippable } from "fflate";
import type { PlaygroundArtifact, PlaygroundSettings } from "./compiler/types";
import { createPlaygroundReadme } from "./readme";

export function createPlaygroundZip(
  source: string,
  settings: PlaygroundSettings,
  artifacts: PlaygroundArtifact[],
): Uint8Array {
  const files: Zippable = {};
  addZipEntry(files, "hooks.config.ts", source);
  addZipEntry(
    files,
    "settings.hooks.snippet.json",
    `${JSON.stringify({ hooks: settings.hooks }, null, 2)}\n`,
  );
  addZipEntry(files, "README.txt", createPlaygroundReadme(settings));
  for (const artifact of artifacts) {
    validateArtifact(artifact);
    addZipEntry(files, artifact.filePath, artifact.contents);
    addZipEntry(files, artifact.wrapper.filePath, artifact.wrapper.contents);
  }
  return zipSync(files, { level: 9 });
}

const fixedMtime = new Date(1980, 0, 1, 0, 0, 0);

function addZipEntry(
  files: Zippable,
  filePath: string,
  contents: string,
): void {
  if (Object.hasOwn(files, filePath)) {
    throw new Error(`Duplicate ZIP entry path: ${filePath}`);
  }
  files[filePath] = [strToU8(contents), { mtime: fixedMtime }];
}

export interface DownloadDependencies {
  createAnchor(): { href: string; download: string; click(): void };
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
  schedule(callback: () => void): void;
}

export function downloadPlaygroundZip(
  contents: Uint8Array,
  fileName = "typed-claude-hooks.zip",
  dependencies: DownloadDependencies = defaultDownloadDependencies,
): void {
  const blob = new Blob([contents as BlobPart], { type: "application/zip" });
  const url = dependencies.createObjectURL(blob);
  try {
    const anchor = dependencies.createAnchor();
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
  } finally {
    dependencies.schedule(() => dependencies.revokeObjectURL(url));
  }
}

function validateArtifact(artifact: PlaygroundArtifact): void {
  const root = ".claude/hooks/typed-claude-hooks";
  const expectedMjs = `${root}/${artifact.event}/${artifact.name}.mjs`;
  const wrapperExtension = artifact.shell === "powershell" ? "ps1" : "sh";
  const expectedWrapper = `${root}/${artifact.event}/${artifact.name}.${wrapperExtension}`;
  if (
    !isSafeSegment(artifact.event) ||
    !isSafeSegment(artifact.name) ||
    !isSafePath(artifact.filePath) ||
    artifact.filePath !== expectedMjs ||
    !isSafePath(artifact.wrapper.filePath) ||
    artifact.wrapper.filePath !== expectedWrapper
  ) {
    throw new Error(
      `Unsafe artifact path: ${artifact.filePath} or ${artifact.wrapper.filePath}`,
    );
  }
}

function isSafeSegment(segment: string): boolean {
  return (
    segment !== "" &&
    segment !== "." &&
    segment !== ".." &&
    !/[\\/]/.test(segment)
  );
}

function isSafePath(filePath: string): boolean {
  return (
    !filePath.startsWith("/") &&
    !filePath.includes("\\") &&
    filePath
      .split("/")
      .every((part) => part !== "" && part !== "." && part !== "..")
  );
}

const defaultDownloadDependencies: DownloadDependencies = {
  createAnchor: () => document.createElement("a"),
  createObjectURL: (blob) => URL.createObjectURL(blob),
  revokeObjectURL: (url) => URL.revokeObjectURL(url),
  schedule: (callback) => globalThis.setTimeout(callback, 0),
};
