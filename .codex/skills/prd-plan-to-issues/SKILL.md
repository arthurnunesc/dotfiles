---
name: prd-plan-to-issues
description: Convert a phased implementation plan (from prd-to-plan) into independently-grabbable GitHub issues using vertical slices. Use when user wants to turn a plan into issues, create tickets from a plan file, or break down implementation phases into work items.
---

# PRD Plan to Issues

Convert an implementation plan (output of `prd-to-plan`) into GitHub issues. Each plan phase becomes one or more vertical-slice issues.

## Process

### 1. Locate the plan

Ask the user for the plan file path (typically `./plans/<feature>.md`). Read it into context.

Extract the **source PRD reference** from the plan header for traceability.

### 2. Explore the codebase (optional)

If you have not already explored the codebase, do so to understand the current state of the code.

### 3. Draft issues from phases

For each phase in the plan, create one or more **vertical-slice** issues. A single phase may produce multiple issues if it contains distinct deliverables.

Classify each issue as:
- **AFK**: Can be implemented and merged autonomously
- **HITL**: Requires human interaction (architectural decision, design review)

Prefer AFK over HITL where possible.

<vertical-slice-rules>
- Each issue delivers a narrow but COMPLETE path through every layer (schema, API, UI, tests)
- A completed issue is demoable or verifiable on its own
- Prefer many thin slices over few thick ones
- Preserve the phase ordering from the plan as dependency relationships
</vertical-slice-rules>

### 4. Quiz the user

Present the proposed breakdown as a numbered list. For each issue, show:

- **Title**: short descriptive name
- **Phase**: which plan phase it comes from
- **Type**: HITL / AFK
- **Blocked by**: which other issues must complete first
- **Acceptance criteria**: from the plan phase

Ask the user:

- Does the granularity feel right? (too coarse / too fine)
- Are the dependency relationships correct?
- Should any issues be merged or split further?
- Are the correct issues marked as HITL and AFK?

Iterate until the user approves the breakdown.

### 5. Create the GitHub issues

For each approved issue, create a GitHub issue using `gh issue create`. Create in dependency order so you can reference real issue numbers.

<issue-template>
## Source

- **PRD**: #<prd-issue-number>
- **Plan**: `<path-to-plan-file>`
- **Phase**: <phase number and title>

## What to build

A concise description of this vertical slice. Describe the end-to-end behavior, not layer-by-layer implementation. Reference the plan phase and parent PRD rather than duplicating content.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Blocked by

- Blocked by #<issue-number> (if any)

Or "None - can start immediately" if no blockers.
</issue-template>

Do NOT close or modify the parent PRD issue.
