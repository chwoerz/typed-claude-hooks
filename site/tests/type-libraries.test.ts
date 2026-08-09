import { isBuiltin } from "node:module";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  typeLibraries,
  typeLibraryMap,
  typeVirtualFileMap,
  typeVirtualFiles,
} from "../src/playground/type-libraries";

const compilerOptions: ts.CompilerOptions = {
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  typeRoots: ["file:///node_modules/@types"],
};
const fileExists = (filePath: string) => filePath in typeVirtualFileMap;
const directoryExists = (directoryPath: string) =>
  typeVirtualFiles.some(({ filePath }) =>
    filePath.startsWith(`${directoryPath}/`),
  );
const resolutionHost: ts.ModuleResolutionHost = {
  fileExists,
  readFile: (filePath) => typeVirtualFileMap[filePath],
  directoryExists,
  getCurrentDirectory: () => "file:///",
  getDirectories: () => [],
  realpath: (filePath) => filePath,
};

describe("playground type libraries", () => {
  it("loads package entry points and their declaration dependencies", () => {
    const filePaths = typeLibraries.map(({ filePath }) => filePath);

    expect(filePaths).toContain(
      "file:///node_modules/@typed-rocks/typed-claude-hooks/index.d.ts",
    );
    expect(filePaths).toContain(
      "file:///node_modules/@typed-rocks/typed-claude-hooks/types/index.d.ts",
    );
    expect(filePaths).toContain("file:///node_modules/@types/node/index.d.ts");
    expect(
      filePaths.some((filePath) =>
        filePath.startsWith("file:///node_modules/undici-types/"),
      ),
    ).toBe(true);
  });

  it("exports a map keyed by Monaco virtual file path", () => {
    expect(
      typeLibraryMap["file:///node_modules/@typed-rocks/typed-claude-hooks/index.d.ts"],
    ).toContain("defineHandler");
    expect(Object.keys(typeLibraryMap)).toHaveLength(typeLibraries.length);
  });

  it("resolves public bare imports from the complete virtual filesystem", () => {
    expect(
      typeVirtualFileMap[
        "file:///node_modules/@typed-rocks/typed-claude-hooks/package.json"
      ],
    ).toBeDefined();
    expect(
      typeVirtualFileMap["file:///node_modules/@types/node/package.json"],
    ).toBeDefined();
    expect(
      typeVirtualFileMap["file:///node_modules/undici-types/package.json"],
    ).toBeDefined();

    const resolve = (specifier: string) =>
      ts.resolveModuleName(
        specifier,
        "file:///playground.ts",
        compilerOptions,
        resolutionHost,
      ).resolvedModule?.resolvedFileName;
    expect(resolve("@typed-rocks/typed-claude-hooks")).toBe(
      "file:///node_modules/@typed-rocks/typed-claude-hooks/index.d.ts",
    );
    expect(resolve("@typed-rocks/typed-claude-hooks/types")).toBe(
      "file:///node_modules/@typed-rocks/typed-claude-hooks/types/index.d.ts",
    );
    expect(resolve("undici-types")).toBe(
      "file:///node_modules/undici-types/index.d.ts",
    );
  });

  it("contains only the TypeScript-resolvable public declaration graph", () => {
    expect(
      typeLibraries.some(({ filePath }) =>
        filePath.includes("/typed-claude-hooks/compiler/"),
      ),
    ).toBe(false);

    const unresolved = typeLibraries.flatMap(({ filePath, content }) => {
      const dependencies = ts.preProcessFile(content, true, true);
      const unresolvedModules = dependencies.importedFiles.flatMap(
        ({ fileName }) => {
          // isBuiltin, unlike the builtinModules list, reports the
          // prefix-only modules (node:test, node:sqlite, node:sea,
          // node:test/reporters) on every Node version. builtinModules only
          // began listing them in Node 23.5, so an allowlist derived from it
          // flags those as unresolved on any Node below that.
          if (isBuiltin(fileName)) {
            return [];
          }
          const result = ts.resolveModuleName(
            fileName,
            filePath,
            compilerOptions,
            resolutionHost,
          );
          return result.resolvedModule ? [] : [`${filePath}: ${fileName}`];
        },
      );
      const unresolvedTypes = dependencies.typeReferenceDirectives.flatMap(
        ({ fileName }) => {
          const result = ts.resolveTypeReferenceDirective(
            fileName,
            filePath,
            compilerOptions,
            resolutionHost,
          );
          return result.resolvedTypeReferenceDirective
            ? []
            : [`${filePath}: types ${fileName}`];
        },
      );
      const unresolvedReferences = dependencies.referencedFiles.flatMap(
        ({ fileName }) => {
          const referencePath = new URL(fileName, filePath).href;
          return fileExists(referencePath)
            ? []
            : [`${filePath}: reference ${fileName}`];
        },
      );

      return [
        ...unresolvedModules,
        ...unresolvedTypes,
        ...unresolvedReferences,
      ];
    });

    expect(unresolved).toEqual([]);
  });
});
