/**
 * Engram — OpenCode plugin adapter
 *
 * Thin layer that connects OpenCode's event system to the Engram Go binary.
 * The Go binary runs as a local HTTP server and handles all persistence.
 *
 * Flow:
 *   OpenCode events → this plugin → HTTP calls → engram serve → SQLite
 *
 * Session resilience:
 *   Uses `ensureSession()` before any DB write. This means sessions are
 *   created on-demand — even if the plugin was loaded after the session
 *   started (restart, reconnect, etc.). The session ID comes from OpenCode's
 *   hooks (input.sessionID) rather than relying on a session.created event.
 */

import { Plugin } from "@opencode/plugin"

// ─── Configuration ───────────────────────────────────────────────────────────

const ENGRAM_PORT = parseInt(process.env.ENGRAM_PORT ?? "7437")
const ENGRAM_URL = `http://127.0.0.1:${ENGRAM_PORT}`
const ENGRAM_BIN = process.env.ENGRAM_BIN ?? Bun.which("engram") ?? "/opt/homebrew/opt/engram/bin/engram"

// Engram's own MCP tools — don't count these as "tool calls" for session stats
const ENGRAM_TOOLS = new Set([
  "mem_search",
  "mem_save",
  "mem_update",
  "mem_delete",
  "mem_suggest_topic_key",
  "mem_save_prompt",
  "mem_session_summary",
  "mem_context",
  "mem_stats",
  "mem_timeline",
  "mem_get_observation",
  "mem_session_start",
  "mem_session_end",
])

// These are the effective OpenCode IDs for the Engram MCP writers that accept
// a session_id. Do not match suffixes: another MCP server can expose a tool
// with the same name.
const ENGRAM_SESSION_WRITER_TOOLS = new Set([
	"engram_mem_save",
	"engram_mem_save_prompt",
	"engram_mem_session_summary",
	"engram_mem_capture_passive",
])

// ─── Memory Instructions ─────────────────────────────────────────────────────
// These get injected into the agent's context so it knows to call mem_save.

const MEMORY_INSTRUCTIONS = `## Engram Persistent Memory — Protocol

You have access to Engram, a persistent memory system that survives across sessions and compactions.

### WHEN TO SAVE (mandatory — not optional)

Call \`mem_save\` IMMEDIATELY after any of these:
- Bug fix completed
- Architecture or design decision made
- Non-obvious discovery about the codebase
- Configuration change or environment setup
- Pattern established (naming, structure, convention)
- User preference or constraint learned

Format for \`mem_save\`:
- **title**: Verb + what — short, searchable (e.g. "Fixed N+1 query in UserList", "Chose Zustand over Redux")
- **type**: bugfix | decision | architecture | discovery | pattern | config | preference
- **scope**: \`project\` (default) | \`personal\`
- **topic_key** (optional, recommended for evolving decisions): stable key like \`architecture/auth-model\`
- **content**:
  **What**: One sentence — what was done
  **Why**: What motivated it (user request, bug, performance, etc.)
  **Where**: Files or paths affected
  **Learned**: Gotchas, edge cases, things that surprised you (omit if none)

Topic rules:
- Different topics must not overwrite each other (e.g. architecture vs bugfix)
- Reuse the same \`topic_key\` to update an evolving topic instead of creating new observations
- If unsure about the key, call \`mem_suggest_topic_key\` first and then reuse it
- Use \`mem_update\` when you have an exact observation ID to correct

### WHEN TO SEARCH MEMORY

When the user asks to recall something — any variation of "remember", "recall", "what did we do",
"how did we solve", "recordar", "acordate", "qué hicimos", or references to past work:
1. First call \`mem_context\` — checks recent session history (fast, cheap)
2. If not found, call \`mem_search\` with relevant keywords (FTS5 full-text search)
3. If you find a match, use \`mem_get_observation\` for full untruncated content

Also search memory PROACTIVELY when:
- Starting work on something that might have been done before
- The user mentions a topic you have no context on — check if past sessions covered it
- The user's FIRST message references the project, a feature, or a problem — call \`mem_search\` with keywords from their message to check for prior work before responding

### SESSION CLOSE PROTOCOL (mandatory)

Before ending a session or saying "done" / "listo" / "that's it", you MUST:
1. Call \`mem_session_summary\` with this structure:

## Goal
[What we were working on this session]

## Instructions
[User preferences or constraints discovered — skip if none]

## Discoveries
- [Technical findings, gotchas, non-obvious learnings]

## Accomplished
- [Completed items with key details]

## Next Steps
- [What remains to be done — for the next session]

## Relevant Files
- path/to/file — [what it does or what changed]

This is NOT optional. If you skip this, the next session starts blind.

### AFTER COMPACTION

If you see a message about compaction or context reset, or if you see "FIRST ACTION REQUIRED" in your context:
1. IMMEDIATELY call \`mem_session_summary\` with the compacted summary content — this persists what was done before compaction
2. Then call \`mem_context\` to recover any additional context from previous sessions
3. Only THEN continue working

Do not skip step 1. Without it, everything done before compaction is lost from memory.
`

// ─── HTTP Client ─────────────────────────────────────────────────────────────

async function engramFetch(
  path: string,
  opts: { method?: string; body?: any } = {}
): Promise<any> {
  try {
    const res = await fetch(`${ENGRAM_URL}${path}`, {
      method: opts.method ?? "GET",
      headers: opts.body ? { "Content-Type": "application/json" } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    // Engram server not running — silently fail
    return null
  }
}

async function isEngramRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${ENGRAM_URL}/health`, {
      signal: AbortSignal.timeout(500),
    })
    return res.ok
  } catch {
    return false
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function resolveProjectName(directory: string): Promise<string | null> {
	const data = await engramFetch(`/project/current?cwd=${encodeURIComponent(directory)}`)
	const project = typeof data?.project === "string" ? data.project.trim() : ""
	return project && project !== "unknown" && !data?.error_hint && !/[\\/]/.test(project)
		? project
		: null
}

function truncate(str: string, max: number): string {
  if (!str) return ""
  return str.length > max ? str.slice(0, max) + "..." : str
}

/**
 * Strip <private>...</private> tags before sending to engram.
 * Double safety: the Go binary also strips, but we strip here too
 * so sensitive data never even hits the wire.
 */
function stripPrivateTags(str: string): string {
  if (!str) return ""
  return str.replace(/<private>[\s\S]*?<\/private>/gi, "[REDACTED]").trim()
}

// ─── Plugin Export ───────────────────────────────────────────────────────────

export const Engram = Plugin.define({
	id: "engram",
	async setup(ctx) {
	const directory = ctx.location.directory

  // Track tool counts per session (in-memory only, not critical)
  const toolCounts = new Map<string, number>()

   // Track which sessions we've already ensured exist in engram
   const knownSessions = new Set<string>()
	const registeringSessions = new Map<string, Promise<boolean>>()
	const boundWriterExecutors = new WeakSet<Function>()

  // Track sub-agent session IDs so we can suppress their tool-hook registrations.
  // Sub-agents (Task() calls) have a parentID or a title ending in " subagent)".
  // We must not register them as top-level Engram sessions — they cause session
  // inflation (e.g. 170 sessions for 1 real conversation, issue #116).
	const subAgentSessions = new Set<string>()
	const inspectedSessions = new Set<string>()
	const rootSessions = new Set<string>()

	async function isSubAgentSession(sessionId: string): Promise<boolean> {
		if (subAgentSessions.has(sessionId)) return true
		if (inspectedSessions.has(sessionId)) return false
		inspectedSessions.add(sessionId)
		try {
			const session = await ctx.session.get({ sessionID: sessionId })
			if (session.parentID || session.title?.endsWith(" subagent)")) {
				subAgentSessions.add(sessionId)
				return true
			}
		} catch {}
		return false
	}

	async function isRootSession(sessionId: string): Promise<boolean> {
		if (!sessionId || subAgentSessions.has(sessionId)) return false
		if (rootSessions.has(sessionId)) return true
		try {
			const session = await ctx.session.get({ sessionID: sessionId })
			if (session.id !== sessionId || session.parentID || session.title?.endsWith(" subagent)")) {
				subAgentSessions.add(sessionId)
				return false
			}
			rootSessions.add(sessionId)
			return true
		} catch {
			return false
		}
	}

  /**
   * Ensure a session exists in engram. Idempotent — calls POST /sessions
   * which uses INSERT OR IGNORE. Safe to call multiple times.
   *
   * Silently skips sub-agent sessions (tracked in `subAgentSessions`).
   */
	async function ensureSession(sessionId: string): Promise<boolean> {
		if (!sessionId || !project || knownSessions.has(sessionId)) return knownSessions.has(sessionId)
		// Do not register sub-agent or unknown sessions in Engram (issue #116).
		if (!await isRootSession(sessionId)) return false
		const inFlight = registeringSessions.get(sessionId)
		if (inFlight) return inFlight

		const registration = (async () => {
			const result = await engramFetch("/sessions", {
				method: "POST",
				body: { id: sessionId, project, directory },
			})
			if (result?.id !== sessionId) return false
			knownSessions.add(sessionId)
			return true
		})().finally(() => registeringSessions.delete(sessionId))
		registeringSessions.set(sessionId, registration)
		return registration
	}

  // Try to start engram server if not running
  const running = await isEngramRunning()
   if (!running) {
    try {
      Bun.spawn([ENGRAM_BIN, "serve"], {
        stdout: "ignore",
        stderr: "ignore",
        stdin: "ignore",
      })
      await new Promise((r) => setTimeout(r, 500))
    } catch {
      // Binary not found or can't start — plugin will silently no-op
    }
   }

  // The core resolver reads .engram/config.json and shared identity. Do not
  // infer ownership from Git remotes or migrate project rows from this plugin.
	const project = await resolveProjectName(directory)

  // Auto-import: if .engram/manifest.json exists in the project repo,
  // run `engram sync --import` to load any new chunks into the local DB.
  // This is how git-synced memories get loaded when cloning a repo or
  // pulling changes. Each chunk is imported only once (tracked by ID).
  try {
		const manifestFile = `${directory}/.engram/manifest.json`
    const file = Bun.file(manifestFile)
    if (await file.exists()) {
      Bun.spawn([ENGRAM_BIN, "sync", "--import"], {
			cwd: directory,
        stdout: "ignore",
        stderr: "ignore",
        stdin: "ignore",
      })
    }
  } catch {
    // Manifest doesn't exist or binary not found — silently skip
  }

	const controller = new AbortController()
	const consume = async () => {
		for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
			if (event.type === "session.created") {
				const { sessionID, parentID, title = "" } = event.data
				inspectedSessions.add(sessionID)
				if (parentID || title.endsWith(" subagent)")) {
					subAgentSessions.add(sessionID)
				} else {
					rootSessions.add(sessionID)
					await ensureSession(sessionID)
				}
			}

			if (event.type === "session.deleted") {
				const { sessionID } = event.data
				toolCounts.delete(sessionID)
				knownSessions.delete(sessionID)
				rootSessions.delete(sessionID)
				subAgentSessions.delete(sessionID)
				inspectedSessions.delete(sessionID)
			}
		}
	}
	const consuming = consume().catch((error) => {
		if (!controller.signal.aborted) console.warn("[engram] event subscription failed", error)
	})

	await ctx.session.hook("prompt", async (event) => {
		if (await isSubAgentSession(event.sessionID)) return
		const content = event.prompt.text.trim()
		if (content.length <= 10) return

		if (!await ensureSession(event.sessionID)) return
		await engramFetch("/prompts", {
			method: "POST",
			body: {
				session_id: event.sessionID,
				content: stripPrivateTags(truncate(content, 2000)),
				project,
			},
		})
	})

	await ctx.tool.hook("execute.after", async (event) => {
		if (ENGRAM_TOOLS.has(event.tool.toLowerCase())) return
		if (!await ensureSession(event.sessionID)) return
		toolCounts.set(event.sessionID, (toolCounts.get(event.sessionID) ?? 0) + 1)

		if (!["task", "subagent"].includes(event.tool.toLowerCase()) || event.status !== "completed") return
		const text =
			typeof event.result.content === "string"
				? event.result.content
				: JSON.stringify(event.result.content ?? event.result.output ?? event.result)
		if (text.length <= 50) return
		await engramFetch("/observations/passive", {
			method: "POST",
			body: {
				session_id: event.sessionID,
				content: stripPrivateTags(text),
				project,
				source: "task-complete",
			},
		})
	})

	const boundSessionInstructions = (sessionId: string) =>
		`${MEMORY_INSTRUCTIONS}\n\n### SESSION BINDING\n` +
		`This OpenCode session is registered with Engram as \`${sessionId}\`. ` +
		`For every Engram writer call, use \`session_id: "${sessionId}"\`. ` +
		`Do not invent or reuse another session ID.`

	await ctx.tool.transform((editor) => {
		for (const id of ENGRAM_SESSION_WRITER_TOOLS) {
			editor.update(id, (tool) => {
				const originalExecute = tool.execute
				if (boundWriterExecutors.has(originalExecute)) return
				const execute = async (input: Parameters<typeof originalExecute>[0], executorContext: Parameters<typeof originalExecute>[1]) => {
					if (Object.hasOwn(input, "session_id")) return originalExecute(input, executorContext)
					if (!await ensureSession(executorContext.sessionID)) {
						throw new Error(
							"Engram could not bind this writer call to a registered OpenCode root session. " +
							"Do not invent a session_id; report the learning to your parent session."
						)
					}
					return originalExecute({ ...input, session_id: executorContext.sessionID }, executorContext)
				}
				boundWriterExecutors.add(execute)
				tool.execute = execute
			})
		}
	})

	await ctx.session.hook("context", async (event) => {
		const instructions = await ensureSession(event.sessionID)
			? boundSessionInstructions(event.sessionID)
			: MEMORY_INSTRUCTIONS
		const last = event.system.at(-1)
		if (last?.type === "text") {
			event.system[event.system.length - 1] = {
				...last,
				text: last.text + "\n\n" + instructions,
			}
		} else {
			event.system.push({ type: "text", text: instructions })
		}
	})

	await ctx.session.hook("compaction", async (event) => {
		if (!await ensureSession(event.sessionID)) return
		const data = await engramFetch(`/context?project=${encodeURIComponent(project)}`)
		const context = data?.context ? `${data.context}\n\n` : ""
		event.system.push({
			type: "text",
			text:
				context +
				`CRITICAL INSTRUCTION FOR COMPACTED SUMMARY:\n` +
				`The agent has access to Engram persistent memory via MCP tools.\n` +
				`Include this instruction at the TOP of the compacted summary:\n\n` +
				`"FIRST ACTION REQUIRED: Call mem_session_summary with the content of this compacted summary. ` +
				`Use project: '${project}' and session_id: '${event.sessionID}'. Do this BEFORE any other work."`,
		})
	})

	return async () => {
		controller.abort()
		await consuming
	}
	},
})

export default Engram
