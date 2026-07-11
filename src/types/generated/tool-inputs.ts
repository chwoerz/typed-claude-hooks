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
  mode?: "acceptEdits" | "auto" | "bypassPermissions" | "default" | "dontAsk" | "plan" | "bubble";
  /**
   * Isolation mode. "worktree" creates a temporary git worktree so the agent works on an isolated copy of the repo.
   */
  isolation?: "worktree";
}

export interface AskUserQuestionInput {
  /**
   * Questions to ask the user (1-4 questions)
   *
   * @minItems 1
   * @maxItems 4
   */
  questions:
    | [
        {
          /**
           * The complete question to ask the user. Should be clear, specific, and end with a question mark. Example: "Which library should we use for date formatting?" If multiSelect is true, phrase it accordingly, e.g. "Which features do you want to enable?"
           */
          question: string;
          /**
           * Very short label displayed as a chip/tag (max 12 chars). Examples: "Auth method", "Library", "Approach".
           */
          header: string;
          /**
           * The available choices for this question. Must have 2-4 options. Each option should be a distinct, mutually exclusive choice (unless multiSelect is enabled). There should be no 'Other' option, that will be provided automatically.
           *
           * @minItems 2
           * @maxItems 4
           */
          options:
            | [
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                }
              ]
            | [
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                }
              ]
            | [
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                }
              ];
          /**
           * Set to true to allow the user to select multiple options instead of just one. Use when choices are not mutually exclusive.
           */
          multiSelect: boolean;
        }
      ]
    | [
        {
          /**
           * The complete question to ask the user. Should be clear, specific, and end with a question mark. Example: "Which library should we use for date formatting?" If multiSelect is true, phrase it accordingly, e.g. "Which features do you want to enable?"
           */
          question: string;
          /**
           * Very short label displayed as a chip/tag (max 12 chars). Examples: "Auth method", "Library", "Approach".
           */
          header: string;
          /**
           * The available choices for this question. Must have 2-4 options. Each option should be a distinct, mutually exclusive choice (unless multiSelect is enabled). There should be no 'Other' option, that will be provided automatically.
           *
           * @minItems 2
           * @maxItems 4
           */
          options:
            | [
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                }
              ]
            | [
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                }
              ]
            | [
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                }
              ];
          /**
           * Set to true to allow the user to select multiple options instead of just one. Use when choices are not mutually exclusive.
           */
          multiSelect: boolean;
        },
        {
          /**
           * The complete question to ask the user. Should be clear, specific, and end with a question mark. Example: "Which library should we use for date formatting?" If multiSelect is true, phrase it accordingly, e.g. "Which features do you want to enable?"
           */
          question: string;
          /**
           * Very short label displayed as a chip/tag (max 12 chars). Examples: "Auth method", "Library", "Approach".
           */
          header: string;
          /**
           * The available choices for this question. Must have 2-4 options. Each option should be a distinct, mutually exclusive choice (unless multiSelect is enabled). There should be no 'Other' option, that will be provided automatically.
           *
           * @minItems 2
           * @maxItems 4
           */
          options:
            | [
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                }
              ]
            | [
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                }
              ]
            | [
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                }
              ];
          /**
           * Set to true to allow the user to select multiple options instead of just one. Use when choices are not mutually exclusive.
           */
          multiSelect: boolean;
        }
      ]
    | [
        {
          /**
           * The complete question to ask the user. Should be clear, specific, and end with a question mark. Example: "Which library should we use for date formatting?" If multiSelect is true, phrase it accordingly, e.g. "Which features do you want to enable?"
           */
          question: string;
          /**
           * Very short label displayed as a chip/tag (max 12 chars). Examples: "Auth method", "Library", "Approach".
           */
          header: string;
          /**
           * The available choices for this question. Must have 2-4 options. Each option should be a distinct, mutually exclusive choice (unless multiSelect is enabled). There should be no 'Other' option, that will be provided automatically.
           *
           * @minItems 2
           * @maxItems 4
           */
          options:
            | [
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                }
              ]
            | [
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                }
              ]
            | [
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                }
              ];
          /**
           * Set to true to allow the user to select multiple options instead of just one. Use when choices are not mutually exclusive.
           */
          multiSelect: boolean;
        },
        {
          /**
           * The complete question to ask the user. Should be clear, specific, and end with a question mark. Example: "Which library should we use for date formatting?" If multiSelect is true, phrase it accordingly, e.g. "Which features do you want to enable?"
           */
          question: string;
          /**
           * Very short label displayed as a chip/tag (max 12 chars). Examples: "Auth method", "Library", "Approach".
           */
          header: string;
          /**
           * The available choices for this question. Must have 2-4 options. Each option should be a distinct, mutually exclusive choice (unless multiSelect is enabled). There should be no 'Other' option, that will be provided automatically.
           *
           * @minItems 2
           * @maxItems 4
           */
          options:
            | [
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                }
              ]
            | [
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                }
              ]
            | [
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                }
              ];
          /**
           * Set to true to allow the user to select multiple options instead of just one. Use when choices are not mutually exclusive.
           */
          multiSelect: boolean;
        },
        {
          /**
           * The complete question to ask the user. Should be clear, specific, and end with a question mark. Example: "Which library should we use for date formatting?" If multiSelect is true, phrase it accordingly, e.g. "Which features do you want to enable?"
           */
          question: string;
          /**
           * Very short label displayed as a chip/tag (max 12 chars). Examples: "Auth method", "Library", "Approach".
           */
          header: string;
          /**
           * The available choices for this question. Must have 2-4 options. Each option should be a distinct, mutually exclusive choice (unless multiSelect is enabled). There should be no 'Other' option, that will be provided automatically.
           *
           * @minItems 2
           * @maxItems 4
           */
          options:
            | [
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                }
              ]
            | [
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                }
              ]
            | [
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                }
              ];
          /**
           * Set to true to allow the user to select multiple options instead of just one. Use when choices are not mutually exclusive.
           */
          multiSelect: boolean;
        }
      ]
    | [
        {
          /**
           * The complete question to ask the user. Should be clear, specific, and end with a question mark. Example: "Which library should we use for date formatting?" If multiSelect is true, phrase it accordingly, e.g. "Which features do you want to enable?"
           */
          question: string;
          /**
           * Very short label displayed as a chip/tag (max 12 chars). Examples: "Auth method", "Library", "Approach".
           */
          header: string;
          /**
           * The available choices for this question. Must have 2-4 options. Each option should be a distinct, mutually exclusive choice (unless multiSelect is enabled). There should be no 'Other' option, that will be provided automatically.
           *
           * @minItems 2
           * @maxItems 4
           */
          options:
            | [
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                }
              ]
            | [
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                }
              ]
            | [
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                }
              ];
          /**
           * Set to true to allow the user to select multiple options instead of just one. Use when choices are not mutually exclusive.
           */
          multiSelect: boolean;
        },
        {
          /**
           * The complete question to ask the user. Should be clear, specific, and end with a question mark. Example: "Which library should we use for date formatting?" If multiSelect is true, phrase it accordingly, e.g. "Which features do you want to enable?"
           */
          question: string;
          /**
           * Very short label displayed as a chip/tag (max 12 chars). Examples: "Auth method", "Library", "Approach".
           */
          header: string;
          /**
           * The available choices for this question. Must have 2-4 options. Each option should be a distinct, mutually exclusive choice (unless multiSelect is enabled). There should be no 'Other' option, that will be provided automatically.
           *
           * @minItems 2
           * @maxItems 4
           */
          options:
            | [
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                }
              ]
            | [
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                }
              ]
            | [
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                }
              ];
          /**
           * Set to true to allow the user to select multiple options instead of just one. Use when choices are not mutually exclusive.
           */
          multiSelect: boolean;
        },
        {
          /**
           * The complete question to ask the user. Should be clear, specific, and end with a question mark. Example: "Which library should we use for date formatting?" If multiSelect is true, phrase it accordingly, e.g. "Which features do you want to enable?"
           */
          question: string;
          /**
           * Very short label displayed as a chip/tag (max 12 chars). Examples: "Auth method", "Library", "Approach".
           */
          header: string;
          /**
           * The available choices for this question. Must have 2-4 options. Each option should be a distinct, mutually exclusive choice (unless multiSelect is enabled). There should be no 'Other' option, that will be provided automatically.
           *
           * @minItems 2
           * @maxItems 4
           */
          options:
            | [
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                }
              ]
            | [
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                }
              ]
            | [
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                }
              ];
          /**
           * Set to true to allow the user to select multiple options instead of just one. Use when choices are not mutually exclusive.
           */
          multiSelect: boolean;
        },
        {
          /**
           * The complete question to ask the user. Should be clear, specific, and end with a question mark. Example: "Which library should we use for date formatting?" If multiSelect is true, phrase it accordingly, e.g. "Which features do you want to enable?"
           */
          question: string;
          /**
           * Very short label displayed as a chip/tag (max 12 chars). Examples: "Auth method", "Library", "Approach".
           */
          header: string;
          /**
           * The available choices for this question. Must have 2-4 options. Each option should be a distinct, mutually exclusive choice (unless multiSelect is enabled). There should be no 'Other' option, that will be provided automatically.
           *
           * @minItems 2
           * @maxItems 4
           */
          options:
            | [
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                }
              ]
            | [
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                }
              ]
            | [
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                },
                {
                  /**
                   * The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.
                   */
                  label: string;
                  /**
                   * Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.
                   */
                  description: string;
                  /**
                   * Optional preview content rendered when this option is focused. Use for mockups, code snippets, or visual comparisons that help users compare options. See the tool description for the expected content format.
                   */
                  preview?: string;
                }
              ];
          /**
           * Set to true to allow the user to select multiple options instead of just one. Use when choices are not mutually exclusive.
           */
          multiSelect: boolean;
        }
      ];
  /**
   * User answers collected by the permission component
   */
  answers?: {
    [k: string]: string;
  };
  /**
   * Optional per-question annotations from the user (e.g., notes on preview selections). Keyed by question text.
   */
  annotations?: {
    [k: string]: {
      /**
       * The preview content of the selected option, if the question used previews.
       */
      preview?: string;
      /**
       * Free-text notes the user added to their selection.
       */
      notes?: string;
    };
  };
  /**
   * Optional metadata for tracking and analytics purposes. Not displayed to user.
   */
  metadata?: {
    /**
     * Optional identifier for the source of this question (e.g., "remember" for /remember command). Used for analytics tracking.
     */
    source?: string;
  };
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

export interface CronCreateInput {
  /**
   * Standard 5-field cron expression in local time: "M H DoM Mon DoW" (e.g. "* /5 * * * *" = every 5 minutes, "30 14 28 2 *" = Feb 28 at 2:30pm local once).
   */
  cron: string;
  /**
   * The prompt to enqueue at each fire time.
   */
  prompt: string;
  /**
   * true (default) = fire on every cron match until deleted or auto-expired after 7 days. false = fire once at the next match, then auto-delete. Use false for "remind me at X" one-shot requests with pinned minute/hour/dom/month.
   */
  recurring?: boolean;
  /**
   * true = persist to .claude/scheduled_tasks.json and survive restarts. false (default) = in-memory only, dies when this Claude session ends. Use true only when the user asks the task to survive across sessions.
   */
  durable?: boolean;
}

export interface CronDeleteInput {
  /**
   * Job ID returned by CronCreate.
   */
  id: string;
}

export interface CronListInput {}

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

export interface EnterPlanModeInput {}

export interface EnterWorktreeInput {
  /**
   * Optional name for a new worktree. Each "/"-separated segment may contain only letters, digits, dots, underscores, and dashes; max 64 chars total. A random name is generated if not provided. Mutually exclusive with `path`.
   */
  name?: string;
  /**
   * Path to an existing worktree of the current repository to switch into instead of creating a new one. Must appear in `git worktree list` for the current repo. Mutually exclusive with `name`.
   */
  path?: string;
}

export interface ExitPlanModeInput {
  /**
   * Prompt-based permissions needed to implement the plan. These describe categories of actions rather than specific commands.
   */
  allowedPrompts?: {
    /**
     * The tool this prompt applies to
     */
    tool: "Bash";
    /**
     * Semantic description of the action, e.g. "run tests", "install dependencies"
     */
    prompt: string;
  }[];
  [k: string]: unknown;
}

export interface ExitWorktreeInput {
  /**
   * "keep" leaves the worktree and branch on disk; "remove" deletes both.
   */
  action: "keep" | "remove";
  /**
   * Required true when action is "remove" and the worktree has uncommitted files or unmerged commits. The tool will refuse and list them otherwise.
   */
  discard_changes?: boolean;
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

export interface ListMcpResourcesInput {
  /**
   * Optional server name to filter resources by
   */
  server?: string;
}

export interface McpInput {
  [k: string]: unknown;
}

export interface MonitorInput {
  /**
   * Short human-readable description of what you are monitoring (shown in notifications).
   */
  description: string;
  /**
   * Kill the monitor after this deadline. Default 300000ms, max 3600000ms. Ignored when persistent is true.
   */
  timeout_ms: number;
  /**
   * Run for the lifetime of the session (no timeout). Use for session-length watches like PR monitoring or log tails. Stop with TaskStop.
   */
  persistent: boolean;
  /**
   * Shell command or script. Each stdout line is an event; exit ends the watch.
   */
  command: string;
}

export interface NotebookEditInput {
  /**
   * The absolute path to the Jupyter notebook file to edit (must be absolute, not relative)
   */
  notebook_path: string;
  /**
   * The ID of the cell to edit. When inserting a new cell, the new cell will be inserted after the cell with this ID, or at the beginning if not specified.
   */
  cell_id?: string;
  /**
   * The new source for the cell
   */
  new_source: string;
  /**
   * The type of the cell (code or markdown). If not specified, it defaults to the current cell type. If using edit_mode=insert, this is required.
   */
  cell_type?: "code" | "markdown";
  /**
   * The type of edit to make (replace, insert, delete). Defaults to replace.
   */
  edit_mode?: "replace" | "insert" | "delete";
}

export interface PushNotificationInput {
  /**
   * The notification body. Keep it under 200 characters; mobile OSes truncate.
   */
  message: string;
  status: "proactive";
}

export interface REPLInput {
  /**
   * JavaScript code to execute. Supports top-level await. State persists across calls.
   */
  code: string;
  /**
   * Clear, concise description of what this script does in active voice (5-10 words). E.g. "Trace upgrade message to its GrowthBook flag"
   */
  description?: string;
  /**
   * Optional timeout in milliseconds (default 30000, max 600000)
   */
  timeout?: number;
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

export interface ReadMcpResourceInput {
  /**
   * The MCP server name
   */
  server: string;
  /**
   * The resource URI to read
   */
  uri: string;
}

export interface RemoteTriggerInput {
  action: "list" | "get" | "create" | "update" | "run";
  /**
   * Required for get, update, and run
   */
  trigger_id?: string;
  /**
   * Required for create and update; optional for run
   */
  body?: {
    [k: string]: unknown;
  };
}

export interface ScheduleWakeupInput {
  /**
   * Seconds from now to wake up. Clamped to [60, 3600] by the runtime.
   */
  delaySeconds: number;
  /**
   * One short sentence explaining the chosen delay. Goes to telemetry and is shown to the user. Be specific.
   */
  reason: string;
  /**
   * The /loop input to fire on wake-up. Pass the same /loop input verbatim each turn so the next firing re-enters the skill and continues the loop. For autonomous /loop (no user prompt), pass the literal sentinel `<<autonomous-loop-dynamic>>` instead (the dynamic-pacing variant, not the CronCreate-mode `<<autonomous-loop>>`).
   */
  prompt: string;
}

export interface TaskCreateInput {
  /**
   * A brief title for the task
   */
  subject: string;
  /**
   * What needs to be done
   */
  description: string;
  /**
   * Present continuous form shown in spinner when in_progress (e.g., "Running tests")
   */
  activeForm?: string;
  /**
   * Arbitrary metadata to attach to the task
   */
  metadata?: {
    [k: string]: unknown;
  };
}

export interface TaskGetInput {
  /**
   * The ID of the task to retrieve
   */
  taskId: string;
}

export interface TaskListInput {}

export interface TaskOutputInput {
  /**
   * The task ID to get output from
   */
  task_id: string;
  /**
   * Whether to wait for completion
   */
  block: boolean;
  /**
   * Max wait time in ms
   */
  timeout: number;
}

export interface TaskStopInput {
  /**
   * The ID of the background task to stop
   */
  task_id?: string;
  /**
   * Deprecated: use task_id instead
   */
  shell_id?: string;
}

export interface TaskUpdateInput {
  /**
   * The ID of the task to update
   */
  taskId: string;
  /**
   * New subject for the task
   */
  subject?: string;
  /**
   * New description for the task
   */
  description?: string;
  /**
   * Present continuous form shown in spinner when in_progress (e.g., "Running tests")
   */
  activeForm?: string;
  /**
   * New status for the task
   */
  status?: ("pending" | "in_progress" | "completed") | "deleted";
  /**
   * Task IDs that this task blocks
   */
  addBlocks?: string[];
  /**
   * Task IDs that block this task
   */
  addBlockedBy?: string[];
  /**
   * New owner for the task
   */
  owner?: string;
  /**
   * Metadata keys to merge into the task. Set a key to null to delete it.
   */
  metadata?: {
    [k: string]: unknown;
  };
}

export interface TodoWriteInput {
  /**
   * The updated todo list
   */
  todos: {
    content: string;
    status: "pending" | "in_progress" | "completed";
    activeForm: string;
  }[];
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

export interface WorkflowInput {
  /**
   * Self-contained workflow script. Must begin with `export const meta = { name, description, phases }` (pure literal, no computed values) followed by the script body using agent()/parallel()/pipeline()/phase().
   */
  script?: string;
  /**
   * Name of a predefined workflow (built-in or from .claude/workflows/). Resolves to a self-contained script.
   */
  name?: string;
  /**
   * Ignored — set the workflow description in the script's `meta` block.
   */
  description?: string;
  /**
   * Ignored — set the workflow title in the script's `meta` block.
   */
  title?: string;
  /**
   * Optional input value exposed to the script as the global `args`, verbatim. Pass arrays/objects as actual JSON values, NOT as a JSON-encoded string — a stringified list breaks `args.filter`/`args.map` in the script. Use for parameterized named workflows (e.g. a research question).
   */
  args?: {
    [k: string]: unknown;
  };
  /**
   * Path to a workflow script file on disk. Every Workflow invocation persists its script under the session directory and returns the path in the tool result. To iterate, edit that file with Write/Edit and re-invoke Workflow with the same `scriptPath` instead of re-sending the full script. Takes precedence over `script` and `name`.
   */
  scriptPath?: string;
  /**
   * Run ID of a prior Workflow invocation to resume from. Completed agent() calls with unchanged (prompt, opts) return their cached results instantly; only edited or new calls re-run. Same-session only. Stop the prior run first (TaskStop) before resuming.
   */
  resumeFromRunId?: string;
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

export interface ToolInputMap {
  Agent: AgentInput;
  AskUserQuestion: AskUserQuestionInput;
  Bash: BashInput;
  CronCreate: CronCreateInput;
  CronDelete: CronDeleteInput;
  CronList: CronListInput;
  Edit: FileEditInput;
  EnterPlanMode: EnterPlanModeInput;
  EnterWorktree: EnterWorktreeInput;
  ExitPlanMode: ExitPlanModeInput;
  ExitWorktree: ExitWorktreeInput;
  Glob: GlobInput;
  Grep: GrepInput;
  ListMcpResources: ListMcpResourcesInput;
  Mcp: McpInput;
  Monitor: MonitorInput;
  NotebookEdit: NotebookEditInput;
  PushNotification: PushNotificationInput;
  REPL: REPLInput;
  Read: FileReadInput;
  ReadMcpResource: ReadMcpResourceInput;
  RemoteTrigger: RemoteTriggerInput;
  ScheduleWakeup: ScheduleWakeupInput;
  TaskCreate: TaskCreateInput;
  TaskGet: TaskGetInput;
  TaskList: TaskListInput;
  TaskOutput: TaskOutputInput;
  TaskStop: TaskStopInput;
  TaskUpdate: TaskUpdateInput;
  TodoWrite: TodoWriteInput;
  WebFetch: WebFetchInput;
  WebSearch: WebSearchInput;
  Workflow: WorkflowInput;
  Write: FileWriteInput;
}

export type BuiltinToolName = keyof ToolInputMap;
