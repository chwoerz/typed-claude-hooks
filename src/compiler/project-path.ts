import path from "node:path";

export function projectRelativeLogicalPath(
  projectRoot: string,
  targetPath: string,
  platform: NodeJS.Platform = process.platform,
): string {
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  if (platform === "win32") {
    const projectDrive = pathApi.parse(projectRoot).root;
    const targetDrive = pathApi.parse(targetPath).root;
    if (projectDrive.toLowerCase() !== targetDrive.toLowerCase()) {
      throw new Error(
        `Cannot create a project-relative hook command across different drives (${projectDrive} and ${targetDrive})`,
      );
    }
  }
  const relativePath = pathApi.relative(projectRoot, targetPath);
  // Only Windows separators become "/" — on POSIX a backslash is part of the file name, and
  // rewriting it would silently point the hook command at a different path.
  return platform === "win32" ? relativePath.replaceAll("\\", "/") : relativePath;
}
