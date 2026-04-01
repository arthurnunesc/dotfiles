## Core Principles
- **Simplicity First**: Minimal changes. Find root causes, not workarounds. Senior developer standards.
- **Autonomy on bugs**: Given a bug report, just fix it — chase logs, errors, failing CI. No hand-holding needed.
- **Check in on features**: For new work, enter plan mode and align before building.
- **Be concise**: Lead with the answer. Skip preamble and post-summaries.

---

## Planning & Execution
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

## Task Management
- Multi-session projects: Write plan to `tasks/todo.md` with checkable items. Check if present before continuing implementation.
- Single-session work: Use built-in task system (TaskCreate/TaskUpdate)

---

## Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- One task per subagent for focused execution

---

## Verification
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Run tests, check logs, demonstrate correctness

---

## Preferences
- Commit automatically after each logical unit of work. Use Conventional Commits.
- PRs: Bundled and concise, skip the fluff
- Tests: use judgment — integration tests by default, unit tests for complex logic. Match repo's test framework.
- Python: modern (3.10+), ruff, uv. Frontend: deliberate about framework choice per project.
- Backend: default Python. TypeScript if <500 LOC. Deliberate if performance-critical.
- After corrections, save a feedback memory if the lesson applies beyond this conversation.

---

## MCPs
### Context7
1. `resolve-library-id` using the library name and the user's question
2. Pick the best match by: exact name match, description relevance, code snippet count, source reputation. Try alternate names if results don't look right.
3. `query-docs` with the selected library ID and the user's full question
4. Answer using the fetched docs
