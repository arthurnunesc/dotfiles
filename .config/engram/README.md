# T3 scratch project default

The `engram-mcp` launcher and the native OpenCode plugin use the same resolver. In a physical directory strictly below `~/.t3/scratch`, and without a nonblank inherited `ENGRAM_PROJECT`, they ask Engram’s read-only `hook resolve-hook-project` inspector to resolve the physical working directory. They default to `general` only when the inspector returns a nonempty project with source `dir_basename`. Git repositories, local config, and inconclusive results are left to Engram. The scratch root itself, paths outside it, and nonexistent paths do not qualify. Inspector errors fail closed; no human-readable Git messages are parsed. The inspector does not register sessions or write bindings.

This is a fallback, not semantic routing. Explicit project parameters still use upstream Engram precedence; the launcher passes `--project` and all other MCP arguments through unchanged. It does not add an AGENTS rule or require a T3 fork. Existing memories are not migrated.

OpenCode's native plugin also registers sessions over HTTP. It uses this same resolver for those sessions, prompt capture and compaction context. If a session selected by the scratch fallback still belongs to its old per-chat project, the plugin refuses its writer calls rather than moving history or claiming registration changed the owner. Start a fresh chat for acceptance testing; repair of old sessions is separate work.

Writer calls in chats selected by the scratch fallback may use their invoking root or an explicit ancestor root verified through OpenCode's session metadata. Unrelated IDs are rejected, and the target root must pass the stored-owner check. Child sessions are not registered as roots, and an omitted ID is not silently replaced with a parent's ID. A client-provided `ENGRAM_PROJECT` is also used for HTTP registration, even if the shared Engram HTTP server has a different environment. This preserves an explicit client override rather than setting a global server default.

For T3 started with a custom `--base-dir`, set `T3CODE_HOME` to that same absolute directory in the provider environment. The resolver checks its `scratch` child. A blank or relative configured value does not select a scratch project. Node and Engram must be on `PATH`, and Engram needs Git to inspect repositories; the launcher and helper must keep their dotfiles layout. The inspector behavior was tested with Engram 3.6.0.

```sh
engram-mcp --help
engram-mcp --tools=agent
node --test .config/engram/tests/t3-project.test.mjs
# Requires the locally installed OpenCode V2 plugin SDK:
bun test ./.config/opencode/tests/engram-session-binding.test.ts
```

Merging this integration does not deploy it. It changes the Engram command in the OpenCode, Codex and Pi MCP configurations. Copying or checking these files out into your real home directory can activate configuration reloads; do not install only part of the change. No existing memory data is included or moved.

Before deployment approval, test fresh no-project chats through all three T3 providers with isolated memory data: the default must be `general`, an explicit known project must remain usable, and a repository chat must retain its repository default. Also verify that an old OpenCode scratch session cannot silently keep writing under its previous owner. The current prototype and unit checks are not live-provider acceptance.
