// Auto-extracted from @anthropic-ai/claude-agent-sdk sdk-tools.d.ts
// Do not edit manually — regenerate with: npm run extract-types

export interface AgentInput {
  /**
   * A short (3-5 word) description of the task
   */
  description: string;
  /**
   * The task for the agent to perform
   */
  prompt: string;
  /**
   * The type of specialized agent to use for this task
   */
  subagent_type?: string;
  /**
   * Optional model override for this agent. Takes precedence over the agent definition's model frontmatter. If omitted, uses the agent definition's model, or inherits from the parent.
   */
  model?: "sonnet" | "opus" | "haiku";
  /**
   * Set to true to run this agent in the background. You will be notified when it completes.
   */
  run_in_background?: boolean;
  /**
   * Name for the spawned agent. Makes it addressable via SendMessage({to: name}) while running.
   */
  name?: string;
  /**
   * Team name for spawning. Uses current team context if omitted.
   */
  team_name?: string;
  /**
   * Permission mode for spawned teammate (e.g., "plan" to require plan approval).
   */
  mode?:
    | "acceptEdits"
    | "auto"
    | "bypassPermissions"
    | "default"
    | "dontAsk"
    | "plan"
    | "bubble";
  /**
   * Isolation mode. "worktree" creates a temporary git worktree so the agent works on an isolated copy of the repo.
   */
  isolation?: "worktree";
}

export interface BashInput {
  /**
   * The command to execute
   */
  command: string;
  /**
   * Optional timeout in milliseconds (max 600000)
   */
  timeout?: number;
  /**
   * Clear, concise description of what this command does in active voice. Never use words like "complex" or "risk" in the description - just describe what it does.
   *
   * For simple commands (git, npm, standard CLI tools), keep it brief (5-10 words):
   * - ls → "List files in current directory"
   * - git status → "Show working tree status"
   * - npm install → "Install package dependencies"
   *
   * For commands that are harder to parse at a glance (piped commands, obscure flags, etc.), add enough context to clarify what it does:
   * - find . -name "*.tmp" -exec rm {} \; → "Find and delete all .tmp files recursively"
   * - git reset --hard origin/main → "Discard all local changes and match remote main"
   * - curl -s url | jq '.data[]' → "Fetch JSON from URL and extract data array elements"
   */
  description?: string;
  /**
   * Set to true to run this command in the background.
   */
  run_in_background?: boolean;
  /**
   * Set this to true to dangerously override sandbox mode and run commands without sandboxing.
   */
  dangerouslyDisableSandbox?: boolean;
}

export interface FileEditInput {
  /**
   * The absolute path to the file to modify
   */
  file_path: string;
  /**
   * The text to replace
   */
  old_string: string;
  /**
   * The text to replace it with (must be different from old_string)
   */
  new_string: string;
  /**
   * Replace all occurrences of old_string (default false)
   */
  replace_all?: boolean;
}

export interface FileReadInput {
  /**
   * The absolute path to the file to read
   */
  file_path: string;
  /**
   * The line number to start reading from. Only provide if the file is too large to read at once
   */
  offset?: number;
  /**
   * The number of lines to read. Only provide if the file is too large to read at once.
   */
  limit?: number;
  /**
   * Page range for PDF files (e.g., "1-5", "3", "10-20"). Only applicable to PDF files. Maximum 20 pages per request.
   */
  pages?: string;
}

export interface FileWriteInput {
  /**
   * The absolute path to the file to write (must be absolute, not relative)
   */
  file_path: string;
  /**
   * The content to write to the file
   */
  content: string;
}

export interface GlobInput {
  /**
   * The glob pattern to match files against
   */
  pattern: string;
  /**
   * The directory to search in. If not specified, the current working directory will be used. IMPORTANT: Omit this field to use the default directory. DO NOT enter "undefined" or "null" - simply omit it for the default behavior. Must be a valid directory path if provided.
   */
  path?: string;
}

export interface GrepInput {
  /**
   * The regular expression pattern to search for in file contents
   */
  pattern: string;
  /**
   * File or directory to search in (rg PATH). Defaults to current working directory.
   */
  path?: string;
  /**
   * Glob pattern to filter files (e.g. "*.js", "*.{ts,tsx}") - maps to rg --glob
   */
  glob?: string;
  /**
   * Output mode: "content" shows matching lines (supports -A/-B/-C context, -n line numbers, head_limit), "files_with_matches" shows file paths (supports head_limit), "count" shows match counts (supports head_limit). Defaults to "files_with_matches".
   */
  output_mode?: "content" | "files_with_matches" | "count";
  /**
   * Number of lines to show before each match (rg -B). Requires output_mode: "content", ignored otherwise.
   */
  "-B"?: number;
  /**
   * Number of lines to show after each match (rg -A). Requires output_mode: "content", ignored otherwise.
   */
  "-A"?: number;
  /**
   * Alias for context.
   */
  "-C"?: number;
  /**
   * Number of lines to show before and after each match (rg -C). Requires output_mode: "content", ignored otherwise.
   */
  context?: number;
  /**
   * Show line numbers in output (rg -n). Requires output_mode: "content", ignored otherwise. Defaults to true.
   */
  "-n"?: boolean;
  /**
   * Case insensitive search (rg -i)
   */
  "-i"?: boolean;
  /**
   * Print only the matched (non-empty) parts of each matching line, one match per output line (rg -o / --only-matching). Requires output_mode: "content", ignored otherwise. Defaults to false.
   */
  "-o"?: boolean;
  /**
   * File type to search (rg --type). Common types: js, py, rust, go, java, etc. More efficient than include for standard file types.
   */
  type?: string;
  /**
   * Limit output to first N lines/entries, equivalent to "| head -N". Works across all output modes: content (limits output lines), files_with_matches (limits file paths), count (limits count entries). Defaults to 250 when unspecified. Pass 0 for unlimited (use sparingly — large result sets waste context).
   */
  head_limit?: number;
  /**
   * Skip first N lines/entries before applying head_limit, equivalent to "| tail -n +N | head -N". Works across all output modes. Defaults to 0.
   */
  offset?: number;
  /**
   * Enable multiline mode where . matches newlines and patterns can span lines (rg -U --multiline-dotall). Default: false.
   */
  multiline?: boolean;
}

export interface WebFetchInput {
  /**
   * The URL to fetch content from
   */
  url: string;
  /**
   * The prompt to run on the fetched content
   */
  prompt: string;
}

export interface WebSearchInput {
  /**
   * The search query to use
   */
  query: string;
  /**
   * Only include search results from these domains
   */
  allowed_domains?: string[];
  /**
   * Never include search results from these domains
   */
  blocked_domains?: string[];
}

export interface ToolInputMap {
  Bash: BashInput;
  Read: FileReadInput;
  Write: FileWriteInput;
  Edit: FileEditInput;
  Glob: GlobInput;
  Grep: GrepInput;
  WebFetch: WebFetchInput;
  WebSearch: WebSearchInput;
  Agent: AgentInput;
}

export type BuiltinToolName = keyof ToolInputMap;
