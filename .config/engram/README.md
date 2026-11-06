# T3 scratch project default

The `engram-mcp` launcher and the native OpenCode plugin use the same resolver. In a physical directory strictly below `~/.t3/scratch`, they default Engram to `arthur` only when there is no enclosing Git repository, no `.engram/config.json` in the working directory, and no nonblank inherited `ENGRAM_PROJECT`. Invalid local config is left to Engram to report. The scratch root itself, paths outside it, and nonexistent paths do not qualify. Git detection fails closed if Git cannot be checked.

This is a fallback, not semantic routing. Explicit project parameters still use upstream Engram precedence; the launcher passes `--project` and all other MCP arguments through unchanged. It does not add an AGENTS rule or require a T3 fork. Existing memories are not migrated.

OpenCode's native plugin also registers sessions over HTTP. It uses this same resolver for those sessions, prompt capture and compaction context. If a session selected by the scratch fallback still belongs to its old per-chat project, the plugin refuses its writer calls rather than moving history or claiming registration changed the owner. Start a fresh chat for acceptance testing; repair of old sessions is separate work.

Writer calls in chats selected by the scratch fallback cannot substitute another session ID. A client-provided `ENGRAM_PROJECT` is also used for HTTP registration, even if the shared Engram HTTP server has a different environment. This preserves an explicit client override rather than setting a global server default.

For T3 started with a custom `--base-dir`, set `T3CODE_HOME` to that same absolute directory in the provider environment. The resolver checks its `scratch` child. A blank or relative configured value does not select a scratch project. Node, Git, and Engram must be on `PATH`; the launcher and helper must keep their dotfiles layout.

```sh
engram-mcp --help
engram-mcp --tools=agent
node --test .config/engram/tests/t3-project.test.mjs
# Requires the locally installed OpenCode V2 plugin SDK:
bun test ./.config/opencode/tests/engram-session-binding.test.ts
```

This draft has not been deployed. It changes the Engram command in the OpenCode, Codex and Pi MCP configurations. Copying or checking these files out into your real home directory can activate configuration reloads; do not install only part of the change. No existing memory data is included or moved.

Before deployment approval, test fresh no-project chats through all three T3 providers with isolated memory data: the default must be `arthur`, an explicit known project must remain usable, and a repository chat must retain its repository default. Also verify that an old OpenCode scratch session cannot silently keep writing under its previous owner. The current prototype and unit checks are not live-provider acceptance.
