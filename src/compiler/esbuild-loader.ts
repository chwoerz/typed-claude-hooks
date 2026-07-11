import { extname } from "node:path";
import type { Loader } from "esbuild";

const LOADERS: Record<string, Loader> = {
  ".ts": "ts",
  ".tsx": "tsx",
  ".mts": "ts",
  ".cts": "ts",
  ".js": "js",
  ".jsx": "jsx",
  ".mjs": "js",
  ".cjs": "js",
};

export function loaderForPath(filePath: string): Loader {
  const extension = extname(filePath).toLowerCase();
  const loader = LOADERS[extension];
  if (!loader) {
    throw new Error(
      `Unsupported config file extension: ${extension || "none"}`,
    );
  }
  return loader;
}
