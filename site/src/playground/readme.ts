import type { PlaygroundSettings } from "./compiler/types";

export function createPlaygroundReadme(settings: PlaygroundSettings): string {
  const entries = Object.entries(settings.hooks).flatMap(([event, matchers]) =>
    matchers.map(
      ({ matcher }, index) =>
        `- ${event}: append matcher entry ${index + 1}${matcher === undefined ? " (no matcher)" : ` (matcher: ${matcher})`}`,
    ),
  );
  return `TYPED CLAUDE HOOKS INSTALLATION
=====================================

IMPORTANT: DO NOT REPLACE .claude/settings.json

This archive contains only a settings snippet. Open
settings.hooks.snippet.json and append each matcher entry below to the
corresponding event array under the existing top-level "hooks" property in
.claude/settings.json. Keep every existing setting, event, matcher entry, and
hook command.

Entries to merge:
${entries.join("\n") || "- No generated entries."}

Files to place:
1. Move the extracted .claude/hooks/typed-claude-hooks directory into the
   project at .claude/hooks/typed-claude-hooks.
2. Move hooks.config.ts to .typed-claude-hooks/hooks.config.ts if you want to
   keep the editable source used to generate these artifacts.

The generated commands use project-relative paths beginning with
\${CLAUDE_PROJECT_DIR}/.claude/hooks, so keep the generated hook directory at
that exact project location.

Runtime requirements:
- Install Node.js before running these hooks.
- ZIP extraction may not preserve executable permissions for Bash wrappers.
  After extraction, run: find .claude/hooks/typed-claude-hooks -type f -name '*.sh' -exec chmod +x {} +
- PowerShell .ps1 wrappers require PowerShell and do not require chmod.
`;
}
