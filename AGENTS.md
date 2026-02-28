Fast Apply: IMPORTANT: Use `edit_file` over `str_replace` or full file writes. It works with partial code snippets—no need for full file content.

Warp Grep: warp-grep is a subagent that takes in a search string and tries to find relevant context. Best practice is to use it at the beginning of codebase explorations to fast track finding relevant files/lines. Do not use it to pin point keywords, but use it for broader semantic queries. "Find the XYZ flow", "How does XYZ work", "Where is XYZ handled?", "Where is <error message> coming from?"

Multi-Agent Routing (Required):
- Primary orchestrator is `build` on `anthropic/claude-sonnet-4-6`. Use it to plan, delegate, and synthesize final answers.
- Delegate with Task tool when work is specialized:
  - `general` (`openai/gpt-5.3-codex`): general-purpose subagent for non-trivial execution when no narrower specialist is required.
  - `explore` (`openai/gpt-5.3-codex`): repository exploration, implementation tracing, and fast technical reconnaissance before making changes.
  - `codex-search` (`openai/gpt-5.3-codex`): web/doc research, API lookup, fast codebase search, time-sensitive fact checks.
  - `gemini-analyst` (`google-vertex/gemini-3.1-pro-preview`): long-context analysis, multi-file/log synthesis, verification across sources.
  - `designer` (`google-vertex/gemini-3.1-pro-preview`): UI/UX direction, component specs, layout/spacing/typography decisions, design-to-code guidance.
- If the user explicitly asks for one of these models, route to the matching subagent first.
- For mixed tasks (research + synthesis + design), delegate in parallel when possible, then merge results in `build`.
- Keep delegate prompts narrow and outcome-based (what to return, format, constraints, confidence).
- Prefer direct handling only for trivial changes; otherwise use subagents.
- Stay on this model set unless the user explicitly requests a different model:
  - `anthropic/claude-sonnet-4-6`
  - `openai/gpt-5.3-codex`
  - `google-vertex/gemini-3.1-pro-preview`

Accounts Pool Note:
- In `~/.config/opencode-multi-auth/accounts.json`, software-collected Codex accounts are identified by `source`, not by a `harvested` flag.
- Current convention:
  - `source: "opencode"` -> collected/added by OpenCode-side tooling.
  - `source: "codex"` -> Codex-side source accounts.
