import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { afterEach, describe, expect, it } from "vitest";
import { collectDeclarationLibraries } from "../scripts/prepare-playground-types.mjs";

const temporaryDirectories: string[] = [];

const createFixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "playground-types-"));
  temporaryDirectories.push(root);
  return root;
};

const write = async (path: string, content: string) => {
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, content);
};

const resolveVirtualModule = (
  specifier: string,
  importer: string,
  files: Array<{ filePath: string; content: string }>,
) => {
  const fileMap = Object.fromEntries(
    files.map(({ filePath, content }) => [filePath, content]),
  );
  const host: ts.ModuleResolutionHost = {
    fileExists: (filePath) => filePath in fileMap,
    readFile: (filePath) => fileMap[filePath],
    directoryExists: (directoryPath) =>
      files.some(({ filePath }) => filePath.startsWith(`${directoryPath}/`)),
    getCurrentDirectory: () => "file:///",
    getDirectories: () => [],
    realpath: (filePath) => filePath,
  };
  return ts.resolveModuleName(
    specifier,
    importer,
    {
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
    },
    host,
  ).resolvedModule?.resolvedFileName;
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true })),
  );
});

describe("collectDeclarationLibraries", () => {
  it("skips bare Node built-ins without dropping seeded Node declarations", async () => {
    const root = await createFixture();
    const consumer = join(root, "node_modules/consumer/index.d.ts");
    const nodeTypes = join(root, "node_modules/@types/node/index.d.ts");
    await write(
      consumer,
      'import type { Buffer } from "buffer"; export type Value = Buffer;',
    );
    await write(
      join(root, "node_modules/consumer/package.json"),
      JSON.stringify({ name: "consumer", types: "index.d.ts" }),
    );
    await write(
      nodeTypes,
      'declare module "buffer" { export class Buffer {} }',
    );
    await write(
      join(root, "node_modules/@types/node/package.json"),
      JSON.stringify({ name: "@types/node", types: "index.d.ts" }),
    );
    await write(
      join(root, "node_modules/buffer/package.json"),
      JSON.stringify({ name: "buffer", types: "index.d.ts" }),
    );
    await write(
      join(root, "node_modules/buffer/index.d.ts"),
      "export interface NpmBuffer {}",
    );

    const libraries = await collectDeclarationLibraries(
      [consumer, nodeTypes],
      root,
    );
    const filePaths = libraries.map(({ filePath }) => filePath);

    expect(filePaths).toContain("file:///node_modules/@types/node/index.d.ts");
    expect(filePaths).not.toContain("file:///node_modules/buffer/index.d.ts");
    expect(filePaths).not.toContain("file:///node_modules/buffer/package.json");
  });

  it("resolves bare dependencies from the importing package", async () => {
    const root = await createFixture();
    const outer = join(root, "node_modules/outer");
    const nestedDependency = join(outer, "node_modules/dependency");
    await write(
      join(outer, "package.json"),
      JSON.stringify({ name: "outer", types: "index.d.ts" }),
    );
    await write(
      join(outer, "index.d.ts"),
      'export type { Nested } from "dependency";',
    );
    await write(
      join(nestedDependency, "package.json"),
      JSON.stringify({ name: "dependency", types: "nested.d.ts" }),
    );
    await write(
      join(nestedDependency, "nested.d.ts"),
      "export interface Nested { nested: true }",
    );
    await write(
      join(root, "node_modules/dependency/package.json"),
      JSON.stringify({ name: "dependency", types: "root.d.ts" }),
    );
    await write(
      join(root, "node_modules/dependency/root.d.ts"),
      "export interface Nested { nested: false }",
    );

    const libraries = await collectDeclarationLibraries(
      [join(outer, "index.d.ts")],
      root,
    );

    expect(libraries.map(({ filePath }) => filePath)).toContain(
      "file:///node_modules/outer/node_modules/dependency/nested.d.ts",
    );
    expect(libraries.map(({ filePath }) => filePath)).not.toContain(
      "file:///node_modules/dependency/root.d.ts",
    );
    expect(libraries.map(({ filePath }) => filePath)).toContain(
      "file:///node_modules/outer/node_modules/dependency/package.json",
    );
    expect(
      resolveVirtualModule(
        "dependency",
        "file:///node_modules/outer/index.d.ts",
        libraries,
      ),
    ).toBe("file:///node_modules/outer/node_modules/dependency/nested.d.ts");
  });

  it("follows declaration conditions without adding runtime JavaScript", async () => {
    const root = await createFixture();
    const consumer = join(root, "node_modules/consumer");
    const dependency = join(root, "node_modules/runtime-package");
    await write(
      join(consumer, "index.d.ts"),
      'export type { Value } from "runtime-package";',
    );
    await write(
      join(dependency, "package.json"),
      JSON.stringify({
        name: "runtime-package",
        exports: { ".": { types: "./types.d.mts", import: "./runtime.mjs" } },
      }),
    );
    await write(
      join(dependency, "types.d.mts"),
      "export interface Value { typed: true }",
    );
    await write(
      join(dependency, "runtime.mjs"),
      "throw new Error('runtime only')",
    );

    const libraries = await collectDeclarationLibraries(
      [join(consumer, "index.d.ts")],
      root,
    );
    const filePaths = libraries.map(({ filePath }) => filePath);

    expect(filePaths).toContain(
      "file:///node_modules/runtime-package/types.d.mts",
    );
    expect(filePaths.some((filePath) => filePath.endsWith(".mjs"))).toBe(false);
    expect(filePaths).toContain(
      "file:///node_modules/runtime-package/package.json",
    );
    expect(
      resolveVirtualModule("runtime-package", "file:///consumer.ts", libraries),
    ).toBe("file:///node_modules/runtime-package/types.d.mts");
  });
});
