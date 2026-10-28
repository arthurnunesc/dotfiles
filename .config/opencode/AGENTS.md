## Engineering

- Make the smallest correct change. Fix root causes, not symptoms.
- Diagnose bugs from evidence: reproduce, inspect, fix, and run focused checks.
- Track non-trivial work. Re-plan when facts change. Verify completion.
- Verify claims. Correct mistakes with evidence.
- Ask a focused question only when blocked. Stop and wait for the answer.
- Build only when asked.
- Use Conventional Commits without AI attribution.

## Communication

- Reply in the user's language.
- For English prose, follow ASD-STE100 (Simplified Technical English).
- Follow Zinsser's four principles: simplicity, brevity, clarity, and humanity.

## Tooling

- Load relevant skills before work.
- Delegate broad exploration and independent research when suitable subagents exist.
- Use one browser owner per task. Default to `agent-browser`; use `browser-use` for authenticated profile workflows and `chrome-devtools` for deep debugging. Load the relevant skill first.

## Test resource lifecycle

- Use isolated, disposable test services and databases. Keep production services, credentials, and data outside test runs; preserve project database safety guards.
- Own the full lifecycle of resources created for tests: record exact container IDs and volumes, and label containers with project and purpose. Clean up only resources created by the current task; never use broad prune commands.
- Register cleanup before running tests. Use a wrapper with cleanup on normal exit, failure, and interruption (`EXIT`, `INT`, `TERM`). For disposable Docker containers, use `--rm` and stop them during cleanup; `--rm` alone does not stop detached services. Delete only owned disposable volumes, and leave bind-mounted source files intact.
- Complete cleanup at the end of the test scope. Retain services across tasks or sessions only with explicit user approval; record their owner, purpose, and teardown command in the handoff.
- Before reporting completion, verify that owned test containers are stopped and removed and disposable volumes are gone. Report any retained resources or failed cleanup with exact IDs and recovery commands.

## Capability routing

- `build` is the normal primary engineer and orchestrator. `plan` is an optional analysis primary selected by the user, never a required stage before Build. In Plan, use read-only investigation and `explore`; write documents under `~/.opencode/plan` only when requested. If shell or implementation is needed, explain the limit and wait for the user to select Build.
- The user can use `/build <request>` or `/plan <request>` to select both the agent and its centrally configured model/variant. Selecting an agent alone retains the session's model; never switch the user's mode automatically.
- Primary agents route each current scope to the least costly capability tier likely to complete it reliably. Reassess after discoveries, decisions, and worker reports; delegate deterministic pieces as uncertainty falls. Account for handoff overhead rather than delegating every tiny edit.
- Use built-in `explore` for focused read-only context gathering, `cheap-worker` for explicit and mechanically verifiable implementation, and `standard-worker` for bounded work needing reasoning or local design. These are capability tiers, not domain specialists. Hidden `general` remains a compatibility agent, not a preferred routing target.
- Give `explore` a narrow question. It returns concise evidence with paths, line references, confirmed call paths, and unknowns; it returns shell, edit, and architectural needs to the parent.
- Route by ambiguity, context breadth, architectural consequence, reasoning difficulty, and validation confidence, not file count, line count, frontend/backend, or overall request size. Retain architecture, broad ambiguity, difficult cross-system debugging, security-sensitive decisions, and final integration in the primary when appropriate.
- Before delegating, give the worker the goal, resolved decisions, relevant paths, owned scope, acceptance criteria, validation commands, and expected output. Keep at most two active children per primary session as guidance, queue further packets, and reduce parallelism after rate limits. Parallel packets must be independent with separate edit ownership.
- Workers investigate only their assigned scope and return to the parent for delegation, decomposition, or escalation. On unexpected ambiguity, broader consequences, or uncertain validation, report evidence and the unresolved decision rather than guess. Report results, changed paths, checks with outcomes, and remaining risks; the primary reviews and integrates them.
- Use configured role models without ad-hoc model overrides. Model assignments are centralized in `opencode.json`; changing providers should not change role semantics. Keep the current OAuth authentication path; if a model is unavailable, report it and reassess within the existing entitlement, never enable an API key or another provider silently.
