import { mkdir, readFile, writeFile } from "node:fs/promises";
import { builtinModules } from "node:module";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(siteRoot, "..");
const outputPath = join(
  siteRoot,
  "src/playground/generated/type-libraries.json",
);
const declarationPattern = /\.d\.(?:ts|mts|cts)$/;
const compilerOptions = {
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
};
const nodeBuiltins = new Set(
  builtinModules.flatMap((moduleName) => [
    moduleName.replace(/^node:/, ""),
    moduleName.startsWith("node:") ? moduleName : `node:${moduleName}`,
  ]),
);

const ordinalCompare = (left, right) =>
  left < right ? -1 : left > right ? 1 : 0;

const findPackageJson = (physicalPath, root) => {
  const directory = dirname(physicalPath);
  const packageJsonPath = join(directory, "package.json");
  if (ts.sys.fileExists(packageJsonPath)) {
    return packageJsonPath;
  }
  const parent = dirname(directory);
  return parent === directory || !parent.startsWith(root)
    ? undefined
    : findPackageJson(parent, root);
};

const defaultVirtualPath = (physicalPath, root) => {
  const relativePath = relative(root, physicalPath).split(sep).join("/");
  if (!relativePath.startsWith("node_modules/")) {
    throw new Error(`Declaration is outside node_modules: ${physicalPath}`);
  }
  return `file:///${relativePath}`;
};

const declarationEntry = (physicalPath, virtualPath, root) => {
  if (!physicalPath || !declarationPattern.test(physicalPath)) {
    return undefined;
  }
  const canonicalPath = ts.sys.realpath?.(physicalPath) ?? physicalPath;
  return {
    physicalPath: canonicalPath,
    virtualPath: virtualPath ?? defaultVirtualPath(canonicalPath, root),
  };
};

const resolvedDeclarationEntry = (physicalPath, importer, root) => {
  if (!physicalPath || !declarationPattern.test(physicalPath)) {
    return undefined;
  }
  const canonicalPath = ts.sys.realpath?.(physicalPath) ?? physicalPath;
  const relativePath = relative(root, canonicalPath).split(sep).join("/");
  const virtualPath = relativePath.startsWith("node_modules/")
    ? `file:///${relativePath}`
    : new URL(
        relative(dirname(importer.physicalPath), canonicalPath)
          .split(sep)
          .join("/"),
        importer.virtualPath,
      ).href;
  return { physicalPath: canonicalPath, virtualPath };
};

export const collectDeclarationLibraries = async (roots, root) => {
  const canonicalRoot = ts.sys.realpath?.(root) ?? root;
  const libraries = [];
  const visited = new Set();
  const visitedPackages = new Set();

  const addPackageMetadata = async (entry) => {
    const packageJsonPath = findPackageJson(entry.physicalPath, canonicalRoot);
    if (!packageJsonPath || visitedPackages.has(packageJsonPath)) {
      return;
    }
    visitedPackages.add(packageJsonPath);
    const content = await readFile(packageJsonPath, "utf8");
    const relativePath = relative(canonicalRoot, packageJsonPath)
      .split(sep)
      .join("/");
    const filePath = relativePath.startsWith("node_modules/")
      ? `file:///${relativePath}`
      : `file:///node_modules/${JSON.parse(content).name}/package.json`;
    libraries.push({ filePath, content, kind: "package" });
  };

  const visit = async (entry) => {
    if (!entry || visited.has(entry.physicalPath)) {
      return;
    }
    visited.add(entry.physicalPath);

    const content = await readFile(entry.physicalPath, "utf8");
    libraries.push({
      filePath: entry.virtualPath,
      content,
      kind: "declaration",
    });
    await addPackageMetadata(entry);
    const dependencies = ts.preProcessFile(content, true, true);
    const importedEntries = dependencies.importedFiles
      .filter(({ fileName }) => !nodeBuiltins.has(fileName))
      .map(({ fileName }) => {
        const resolvedModule = ts.resolveModuleName(
          fileName,
          entry.physicalPath,
          compilerOptions,
          ts.sys,
        ).resolvedModule;
        return resolvedDeclarationEntry(
          resolvedModule?.resolvedFileName,
          entry,
          canonicalRoot,
        );
      });
    const typeEntries = dependencies.typeReferenceDirectives.map(
      ({ fileName }) => {
        const resolvedType = ts.resolveTypeReferenceDirective(
          fileName,
          entry.physicalPath,
          compilerOptions,
          ts.sys,
        ).resolvedTypeReferenceDirective;
        return resolvedDeclarationEntry(
          resolvedType?.resolvedFileName,
          entry,
          canonicalRoot,
        );
      },
    );
    const referenceEntries = dependencies.referencedFiles.map(
      ({ fileName }) => {
        const physicalPath = resolve(dirname(entry.physicalPath), fileName);
        const virtualPath = new URL(fileName, entry.virtualPath).href;
        return declarationEntry(physicalPath, virtualPath, canonicalRoot);
      },
    );

    await Promise.all(
      [...importedEntries, ...typeEntries, ...referenceEntries].map(visit),
    );
  };

  await Promise.all(
    roots.map((rootEntry) => {
      const entry =
        typeof rootEntry === "string"
          ? declarationEntry(rootEntry, undefined, canonicalRoot)
          : declarationEntry(
              rootEntry.physicalPath,
              rootEntry.virtualPath,
              canonicalRoot,
            );
      return visit(entry);
    }),
  );

  return libraries.sort(({ filePath: left }, { filePath: right }) =>
    ordinalCompare(left, right),
  );
};

const prepareManifest = async () => {
  const syntheticImporter = join(repositoryRoot, "site/playground-types.ts");
  const nodeTypes = ts.resolveTypeReferenceDirective(
    "node",
    syntheticImporter,
    compilerOptions,
    ts.sys,
  ).resolvedTypeReferenceDirective?.resolvedFileName;
  if (!nodeTypes) {
    throw new Error("Cannot resolve @types/node declarations");
  }

  const libraries = await collectDeclarationLibraries(
    [
      {
        physicalPath: join(repositoryRoot, "dist/index.d.ts"),
        virtualPath: "file:///node_modules/typed-claude-hooks/index.d.ts",
      },
      {
        physicalPath: join(repositoryRoot, "dist/types/index.d.ts"),
        virtualPath: "file:///node_modules/typed-claude-hooks/types/index.d.ts",
      },
      nodeTypes,
    ],
    repositoryRoot,
  );
  const rootPackageMetadata = libraries.find(
    ({ filePath }) =>
      filePath === "file:///node_modules/typed-claude-hooks/package.json",
  );
  if (rootPackageMetadata) {
    rootPackageMetadata.content = rootPackageMetadata.content.replaceAll(
      "./dist/",
      "./",
    );
  }
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(libraries)}\n`);
  console.log(`Prepared ${libraries.length} playground type files.`);
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await prepareManifest();
}
