---
name: openai-account-switcher
description: Switches OpenAI account profiles for subprocesses through the `openai-account-switcher` CLI when autonomous agent workflows hit token, quota, usage, or account-limit failures. Use when an OpenCode/Pi agent, AgentWrapper agent-orchestrator run, Bernstein run, or other spawned subprocess fails with token-limit, quota-exceeded, usage-limit, model-unavailable, or account-cap exhaustion symptoms and another configured profile may unblock retrying the subprocess.
---

# OpenAI Account Switcher

Use this skill to recover an autonomous workflow by switching the affected subprocess to another already-configured OpenAI account profile.

Never edit auth files directly. Never print tokens, refresh tokens, access tokens, `auth.json`, or profile file contents. Always use the `openai-account-switcher` CLI.

## First Principles

- Switch only after verifying the failure is plausibly account/token/quota related.
- Switch the smallest relevant target: `codex`, `opencode`, or `pi`.
- Preview before applying unless the user explicitly delegated autonomous recovery and there is exactly one safe choice.
- Retry the failed subprocess once after switching. If it fails again, stop and report evidence.
- If no ready alternate profile exists, ask the user to create/login a profile. Do not attempt OAuth autonomously.

## Recognize Triggers

Treat these as likely account-limit symptoms:

- `token limit`, `usage limit`, `quota exceeded`, `rate limit`, `billing hard limit`
- `insufficient_quota`, `too many requests`, `429`
- `model unavailable`, `configured model ... is not valid`, when account/profile mismatch is likely
- Subprocess succeeds with another account but fails on the current one

Do not switch accounts for normal code errors, test failures, missing dependencies, invalid prompts, syntax errors, or tool bugs.

## Workflow

1. Capture the failed subprocess command and exact non-secret error text.
2. Identify the affected target from the command:
   - `codex ...` -> `codex`
   - `opencode ...` -> `opencode`
   - `pi ...` -> `pi`
   - AgentWrapper/agent-orchestrator or Bernstein -> inspect the child command it launched and choose that target.
3. Inspect account state:

```sh
openai-account-switcher doctor
openai-account-switcher list
```

4. Choose a profile where the affected target is `ready` and not currently linked for that target.
5. Preview the switch:

```sh
openai-account-switcher switch <profile> --targets <target>
```

6. Apply only if the preview is correct:

```sh
openai-account-switcher switch <profile> --targets <target> --apply
```

7. Restart or rerun only the failed subprocess, not the whole orchestration, when possible.
8. Report what changed using profile names and target names only.

## Autonomous Policy

You may apply the switch without asking only when all are true:

- The failure clearly matches an account/token/quota symptom.
- `openai-account-switcher list` shows exactly one ready alternate for the affected target.
- The user asked for autonomous operation or the orchestrator is expected to self-heal subprocess failures.
- The switch is limited to the affected target.

Ask the user before applying when multiple profiles are viable, the failure cause is ambiguous, switching would affect multiple targets, or no ready alternate exists.

## Examples

```sh
# OpenCode subprocess hits an OpenAI usage cap
openai-account-switcher list
openai-account-switcher switch backup --targets opencode
openai-account-switcher switch backup --targets opencode --apply

# Pi subprocess hits a quota limit
openai-account-switcher switch backup --targets pi
openai-account-switcher switch backup --targets pi --apply

# Codex child process inside an orchestrator hits account limits
openai-account-switcher switch backup --targets codex
openai-account-switcher switch backup --targets codex --apply
```

## Safety Notes

- `bootstrap` prepares saved profile auth files; it does not activate a profile.
- `switch` previews by default; `--apply` changes live auth links.
- Running tools may need restart to reload auth. Prefer restarting the failed subprocess only.
- Do not commit or copy `~/.openai-account-switcher`, `auth.json`, or profile directories.
