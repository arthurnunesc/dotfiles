---
name: code-review
description: Review a branch, pull request, commit, range, or work in progress for concrete defects against repository standards and the available specification.
---

# Code Review

Read-only, defect-first review. Review both axes:

- **Standards** — violations of applicable repository rules.
- **Spec** — missing, incorrect, or out-of-scope behavior against the available request or specification.

Absence of a specification never suppresses correctness or standards findings.

## 1. Pin target and scope

Use the target the user named. Infer a local target when it is clear; ask only when the comparison or path scope is materially ambiguous. Resolve a base once and reuse it.

Use the command that matches the target:

- Unstaged tracked work: `git diff -- [<paths>...]`
- Staged work: `git diff --cached -- [<paths>...]`
- Combined tracked work in progress: `git diff HEAD -- [<paths>...]`
- A branch or pull-request head: resolve `BASE=$(git merge-base <branch> HEAD)`, then `git diff "$BASE"...HEAD -- [<paths>...]`
- One commit: `git show <commit> -- [<paths>...]`
- Explicit endpoints: `git diff <A> <B> -- [<paths>...]`

If `HEAD` does not exist yet, review staged and unstaged work separately. For a merge commit, establish the parent or baseline to compare rather than relying on the default combined display.

The combined WIP diff shows the net working-tree state against `HEAD`. Inspect staged and unstaged diffs separately when their distinction matters, including edits that cancel each other or a review of what will be committed.

For work in progress, separately record untracked candidates with `git ls-files --others --exclude-standard -- [<paths>...]`; inspect only files relevant to the requested scope. Honor user path limits in every command and read only the changed code and context needed to evaluate it.

Keep the review read-only: do not expose secrets, stage or commit, check out files, make broad worktree changes, or post to remotes.

## 2. Find applicable evidence

Discover the applicable global and nested `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING*`, standards documents, and explicit pointers from those files. Follow only sources relevant to the changed paths; do not scan every documentation file.

Find the specification from the user prompt, supplied links or files, local references in the target, and relevant issue references when available. A missing `docs/agents/issue-tracker.md` is not a setup failure. Continue with the available evidence and state requirements that remain unknown rather than inventing them.

## 3. Review the diff

Look first for concrete correctness, safety, data-loss, security, compatibility, and behavior defects. Then check each changed area against the applicable standards and specification. Trace the smallest relevant call paths and use focused existing checks or test evidence when it resolves a finding.

When configured capability roles are available and the scope is substantive, run independent Standards and Spec reviews in parallel. Pin the exact target commands, paths, source documents, read-only boundary, and report format in each request. Launch both foreground calls together, await both results, and do not allow nested delegation or model overrides. A missing spec means the Spec review reports unknown requirements; it does not block the Standards review.

## 4. Verify and report

Verify every candidate against the diff and its relevant context. Remove speculative findings, nits without consequence, duplicates, and mechanical style issues already enforced by tools. Do not suppress correctness defects or failing checks merely because a tool also detects them. Rank the remaining findings by severity and tag each with one or more of `correctness`, `standards`, and `spec`.

Report findings first, with severity, file and line, impact, evidence, and a concise remedy. Then report coverage under `## Standards` and `## Spec`, including unknown requirements or no finding for each axis. State the target, commands, inspected untracked files, relevant checks, and remaining uncertainty.
