import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const consumerRoot = mkdtempSync(resolve(tmpdir(), "tch-package-export-"));

try {
  const packOutput = JSON.parse(
    execFileSync("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", consumerRoot], {
      cwd: projectRoot,
      encoding: "utf8",
    }),
  );
  const packed = packOutput[0];
  const packedFiles = packed.files.map(({ path }) => path);
  assert(packedFiles.includes("dist/compiler/index.js"));
  assert(packedFiles.includes("dist/compiler/index.d.ts"));

  const packageRoot = resolve(consumerRoot, "node_modules/typed-claude-hooks");
  mkdirSync(packageRoot, { recursive: true });
  execFileSync("tar", ["-xzf", resolve(consumerRoot, packed.filename), "--strip-components=1", "-C", packageRoot], {
    cwd: projectRoot,
  });

  const runtimeOutput = execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      'import { runtimeCommand } from "typed-claude-hooks/compiler"; process.stdout.write(runtimeCommand("node"))',
    ],
    { cwd: consumerRoot, encoding: "utf8" },
  );
  assert.equal(runtimeOutput, "node");

  const sourcePath = resolve(consumerRoot, "consumer.ts");
  writeFileSync(
    sourcePath,
    'import { planArtifactPaths } from "typed-claude-hooks/compiler"\nconst artifact = planArtifactPaths({ event: "Stop", name: "stop" }, ".claude/hooks", "node")\nartifact.runtime satisfies "node" | "bun" | "deno"\n',
  );
  execFileSync(
    process.execPath,
    [
      resolve(projectRoot, "node_modules/typescript/bin/tsc"),
      "--noEmit",
      "--strict",
      "--skipLibCheck",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      sourcePath,
    ],
    { cwd: consumerRoot },
  );
  assert.match(readFileSync(resolve(packageRoot, "package.json"), "utf8"), /"\.\/compiler"/);
  console.log("Packed compiler export resolves at runtime and in TypeScript.");
} finally {
  rmSync(consumerRoot, { force: true, recursive: true });
}
