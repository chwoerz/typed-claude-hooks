import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageJsonPath = resolve(fileURLToPath(import.meta.url), "../../../package.json");

export const cliVersion = (JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version: string }).version;
