import generatedTypeLibraries from "./generated/type-libraries.json";

export interface TypeVirtualFile {
  filePath: string;
  content: string;
  kind: "declaration" | "package";
}

export type TypeLibrary = TypeVirtualFile & { kind: "declaration" };

export const typeVirtualFiles: TypeVirtualFile[] =
  generatedTypeLibraries as TypeVirtualFile[];

export const typeLibraries: TypeLibrary[] = typeVirtualFiles.filter(
  (file): file is TypeLibrary => file.kind === "declaration",
);

export const typeVirtualFileMap: Readonly<Record<string, string>> =
  Object.fromEntries(
    typeVirtualFiles.map(({ filePath, content }) => [filePath, content]),
  );

export const typeLibraryMap: Readonly<Record<string, string>> =
  Object.fromEntries(
    typeLibraries.map(({ filePath, content }) => [filePath, content]),
  );

export function getTypeLibraries(): readonly TypeLibrary[] {
  return typeLibraries;
}
