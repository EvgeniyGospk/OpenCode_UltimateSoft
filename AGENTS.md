Fast Apply: IMPORTANT: Use `morph_edit` for non-trivial edits and multi-hunk changes in existing files. Use native `edit` only for tiny exact replacements.

Morph Tools Policy (Required for all agents and subagents):
- Use `morph_edit` as the default editing tool for large files, complex refactors, and scattered edits.
- Keep `morph_edit` input wrapped with `// ... existing code ...` markers to avoid accidental deletions.
- Use native `edit` only for simple one-shot replacements or when `morph_edit` fails.
- For explore, general, sonnet, and opus: when editing is needed, prefer `morph_edit` first and do not skip it without reason.
- If `morph_edit` is unavailable/failing in a run, explicitly state fallback reason and continue with native tools.
- If `morph_edit` returns 429 (rate limited), fall back to native `edit` immediately — do not retry.

Warp Grep: Use `morph_search` for semantic codebase exploration — "Find the XYZ flow", "How does XYZ work?", "Where is XYZ handled?", "Where is <error message> coming from?". Use native `grep` only for exact regex matches in known locations. `morph_search` explores the codebase autonomously across multiple turns using grep/read/list_directory — always prefer it over manual file hunting at the start of codebase exploration.
- Use `morph_search` tool directly (no subagent needed) for: "where is X handled?", "how does Y work?", "find all usages of Z".
- Use `morph_search` BEFORE spawning `explore` or `codex-search` subagents for semantic queries.
- If `morph_search` returns 429, fall back to native grep/glob or `explore` subagent.

Multi-Agent Routing (Required):
- Primary orchestrator is `build` on `anthropic/claude-sonnet-4-6`. Use it to plan, delegate, and synthesize final answers.
- Delegate with Task tool when work is specialized:
  - `general` (`openai/gpt-5.3-codex`): general-purpose subagent for non-trivial execution when no narrower specialist is required.
  - `explore` (`openai/gpt-5.3-codex`): repository exploration, implementation tracing, and fast technical reconnaissance before making changes. Use ONLY after `morph_search` has been tried for semantic queries and wasn't sufficient.
  - `sonnet` (`anthropic/claude-sonnet-4-6`): balanced implementation/reasoning subagent for broad coding tasks.
  - `opus` (`anthropic/claude-opus-4-6`): deep-analysis subagent for hard debugging/design decisions and complex synthesis.
  - `codex-search` (`openai/gpt-5.3-codex`): web/doc research, API lookup, fast codebase search, time-sensitive fact checks.
  - `codex-websearch` (`openai/gpt-5.3-codex`): web search subagent — uses Codex accounts pool, minimal token spend.
  - `gemini-analyst` (`google-vertex/gemini-3.1-pro-preview`): long-context analysis, multi-file/log synthesis, verification across sources.
  - `designer` (`google-vertex/gemini-3.1-pro-preview`): UI/UX direction, component specs, layout/spacing/typography decisions, design-to-code guidance.
- If the user explicitly asks for one of these models, route to the matching subagent first.
- For mixed tasks (research + synthesis + design), delegate in parallel when possible, then merge results in `build`.
- Keep delegate prompts narrow and outcome-based (what to return, format, constraints, confidence).
- Prefer direct handling only for trivial changes; otherwise use subagents.
- Stay on this model set unless the user explicitly requests a different model:
  - `anthropic/claude-sonnet-4-6`
  - `anthropic/claude-opus-4-6`
  - `openai/gpt-5.3-codex`
  - `google-vertex/gemini-3.1-pro-preview`

Accounts Pool Note:
- In `~/.config/opencode-multi-auth/accounts.json`, software-collected Codex accounts are identified by `source`, not by a `harvested` flag.
- Current convention:
  - `source: "opencode"` -> collected/added by OpenCode-side tooling.
  - `source: "codex"` -> Codex-side source accounts.
