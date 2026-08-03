import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const SANDBOX_DIR = ".typed-claude-hooks";
export const CONFIG_FILE_NAME = "hooks.config.ts";
export const SANDBOX_FILES = ["package.json", CONFIG_FILE_NAME, "tsconfig.json", ".gitignore"] as const;

const CONFIG_TEMPLATE = `import { defineHandler } from "typed-claude-hooks"

export const protectEnvFiles = defineHandler("PreToolUse", { matcher: "Write|Edit" }, async (input) => {
  if (input.tool_input.file_path.endsWith(".env")) {
    return {
      hookSpecificOutput: {
        permissionDecision: "deny" as const,
        permissionDecisionReason: "Cannot modify .env files",
      },
    }
  }
  return {}
})
`;

const TSCONFIG_TEMPLATE = `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "types": ["node"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["**/*.ts"]
}
`;

const GITIGNORE_TEMPLATE = "node_modules/\n";

function packageJsonTemplate(version: string): string {
  const manifest = {
    name: "typed-claude-hooks-config",
    private: true,
    type: "module",
    dependencies: { "typed-claude-hooks": version },
    devDependencies: { "@types/node": "^22" },
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function scaffoldSandbox(sandboxDir: string, version: string): string[] {
  mkdirSync(sandboxDir, { recursive: true });

  const templates: Record<(typeof SANDBOX_FILES)[number], string> = {
    "package.json": packageJsonTemplate(version),
    [CONFIG_FILE_NAME]: CONFIG_TEMPLATE,
    "tsconfig.json": TSCONFIG_TEMPLATE,
    ".gitignore": GITIGNORE_TEMPLATE,
  };
  const files: Array<[string, string]> = SANDBOX_FILES.map((name) => [name, templates[name]]);

  return files
    .filter(([name]) => !existsSync(resolve(sandboxDir, name)))
    .map(([name, contents]) => {
      writeFileSync(resolve(sandboxDir, name), contents);
      return name;
    });
}
