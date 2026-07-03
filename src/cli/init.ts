import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export interface InitOptions {
  output?: string;
}

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
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["hooks.config.ts"]
}
`;

function writeIfMissing(path: string, content: string): void {
  if (existsSync(path)) {
    console.log(`${path} already exists, skipping.`);
  } else {
    writeFileSync(path, content);
    console.log(`Created ${path}`);
  }
}

export async function init(options: InitOptions): Promise<void> {
  writeIfMissing(resolve("hooks.config.ts"), CONFIG_TEMPLATE);
  writeIfMissing(resolve("tsconfig.json"), TSCONFIG_TEMPLATE);

  const output = options.output ?? ".claude/settings.json";
  console.log(`\nBuild with: npx typed-claude-hooks build -o ${output}`);
}
