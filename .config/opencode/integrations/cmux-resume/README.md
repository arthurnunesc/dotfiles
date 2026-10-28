# cmux safe OpenCode resume

This TUI plugin saves the exact OpenCode chat selected in each cmux surface.
It does not select the latest chat, use the shared OpenCode daemon identity, or
write chat data.

## Required configuration

First run the current cmux OpenCode hooks installer. It must provide these
installer-owned files; do not edit them:

```
~/.config/opencode/plugins/cmux/index.js
~/.config/opencode/plugins/cmux/tui.js
```

In the native V2 `~/.config/opencode/cli.json`, use the plural `plugins`
array. Append these entries to its existing values; preserve every other
plugin. This disables only the native TUI lifecycle plugin while keeping the
cmux server/feed plugin installed:

```json
{
  "plugins": [
    "-cmux.tui",
    "opencode-subagent-statusline",
    "./integrations/cmux-resume"
  ]
}
```

The wrapper is inert when `CMUX_OPENCODE_HOOKS_DISABLED=1` or
`CMUX_SURFACE_ID` is absent. It uses the TUI process PID and prefers
`CMUX_BUNDLED_CLI_PATH` for hook delivery.

## Behavior and limits

The active session route is the only checkpoint source. Cached session metadata
must be ready before a checkpoint is sent. A parent route stays the checkpoint
when child work ends; a child route is intentional when it is selected. Home
and plugin routes retain the last binding unless an explicit deletion or archive
event ends that same delivered binding. Closing a TUI does not end it.

The native cmux Feed bridge remains enabled. Its lifecycle hooks are disabled;
this wrapper sends serialized `session-start`, `prompt-submit`, `stop`, and
matched `session-end` hooks. A hook waits at most six seconds for cmux. A failed
admission shows one retryable error and is not recorded as delivered.

This package cannot prove a hot reload, cmux hibernation/reopen, or the actual
cmux resume result. Verify those live after configuration. It also cannot make
an archived or deleted chat resumable; it clears only a matching saved binding.
