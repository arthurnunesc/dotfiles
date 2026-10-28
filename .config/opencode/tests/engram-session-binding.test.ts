import { afterEach, describe, expect, test } from "bun:test"

import { Engram } from "../plugins/engram"

type Execute = (input: Record<string, unknown>, context: { sessionID: string; signal: AbortSignal }) => Promise<unknown>

type RegisteredTool = {
	id: string
	input?: unknown
	execute: Execute
}

function response(status: number, body: unknown) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	})
}

function createHarness(options: {
	fetch: (path: string, init?: RequestInit) => Response | Promise<Response>
	sessions?: Record<string, { parentID?: string; title?: string } | "missing">
}) {
	const transforms: Array<(editor: ReturnType<typeof editorFor>) => void> = []
	const sessionHooks = new Map<string, (event: any) => unknown>()
	const toolHooks = new Map<string, (event: any) => unknown>()
	const sessions = options.sessions ?? {}
	const controller = new AbortController()

	const ctx = {
		location: { directory: "/workspace/v0-rent-comparison-site" },
		event: {
			subscribe: ({ signal }: { signal: AbortSignal }) => ({
				async *[Symbol.asyncIterator]() {
					await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }))
				},
			}),
		},
		session: {
			get: async ({ sessionID }: { sessionID: string }) => {
				const value = sessions[sessionID]
				if (value === "missing") throw new Error("session unavailable")
				return { id: sessionID, ...(value ?? {}) }
			},
			hook: async (name: string, callback: (event: any) => unknown) => {
				sessionHooks.set(name, callback)
				return { dispose: async () => {} }
			},
		},
		tool: {
			transform: async (callback: (editor: ReturnType<typeof editorFor>) => void) => {
				transforms.push(callback)
				return { dispose: async () => {} }
			},
			hook: async (name: string, callback: (event: any) => unknown) => {
				toolHooks.set(name, callback)
				return { dispose: async () => {} }
			},
		},
	}

	return {
		ctx,
		sessionHooks,
		toolHooks,
		applyTransforms(tools: RegisteredTool[]) {
			const editor = editorFor(tools)
			for (const transform of transforms) transform(editor)
		},
		async stop(cleanup: (() => Promise<void> | void) | void) {
			controller.abort()
			if (cleanup) await cleanup()
		},
	}
}

function editorFor(tools: RegisteredTool[]) {
	return {
		list: () => tools,
		get: (id: string) => tools.find((tool) => tool.id === id),
		namespace: () => {},
		add: () => {},
		update: (id: string, update: (tool: RegisteredTool) => void) => {
			const tool = tools.find((candidate) => candidate.id === id)
			if (tool) update(tool)
		},
		remove: () => {},
	}
}

const originalFetch = globalThis.fetch

afterEach(() => {
	globalThis.fetch = originalFetch
})

describe("Engram OpenCode V2 session binding", () => {
	test("binds concurrent root and Code Mode writer calls to their executor session", async () => {
		const requests: Array<{ path: string; body?: any }> = []
		globalThis.fetch = (async (input, init) => {
			const path = String(input)
			const body = init?.body ? JSON.parse(String(init.body)) : undefined
			requests.push({ path, body })
			if (path.endsWith("/health")) return response(200, { ok: true })
			if (path.includes("/project/current?cwd=")) return response(200, { project: "preciodelalquiler" })
			if (path.endsWith("/sessions")) return response(200, { id: body.id })
			return response(200, {})
		}) as typeof fetch

		const harness = createHarness({ fetch: globalThis.fetch })
		const cleanup = await Engram.setup(harness.ctx as never)
		const calls: Array<{ input: Record<string, unknown>; context: unknown }> = []
		const writer: RegisteredTool = {
			id: "engram_mem_save",
			input: { type: "object", properties: { session_id: { type: "string" } } },
			execute: async (input, context) => {
				calls.push({ input, context })
				return { content: "saved" }
			},
		}
		const promptWriter: RegisteredTool = {
			id: "engram_mem_save_prompt",
			execute: async (input, context) => {
				calls.push({ input, context })
				return { content: "saved prompt" }
			},
		}
		const unrelated: RegisteredTool = {
			id: "other_engram_mem_save",
			execute: async (input) => {
				calls.push({ input, context: "unrelated" })
				return { content: "unrelated" }
			},
		}
		const reader: RegisteredTool = {
			id: "engram_mem_search",
			execute: async (input) => {
				calls.push({ input, context: "reader" })
				return { content: "read" }
			},
		}
		harness.applyTransforms([writer, promptWriter, unrelated, reader])
		// OpenCode may replay transforms as tools become available. Binding must remain idempotent.
		harness.applyTransforms([writer, promptWriter, unrelated, reader])

		const signal = new AbortController().signal
		await Promise.all([
			writer.execute({ title: "A" }, { sessionID: "root-a", signal }),
			writer.execute({ title: "B" }, { sessionID: "root-b", signal }),
		])
		await promptWriter.execute({ content: "prompt" }, { sessionID: "root-c", signal })
		await writer.execute({ session_id: "already-bound" }, { sessionID: "child", signal })
		await unrelated.execute({ title: "unrelated" }, { sessionID: "root-a", signal })
		await reader.execute({ query: "read" }, { sessionID: "root-a", signal })

		expect(calls.slice(0, 2).map((call) => call.input.session_id).sort()).toEqual(["root-a", "root-b"])
		expect(calls[2].input.session_id).toBe("root-c")
		expect(calls[0].context).toEqual({ sessionID: "root-a", signal })
		expect(calls[3].input.session_id).toBe("already-bound")
		expect(calls[4].input.session_id).toBeUndefined()
		expect(calls[5].input.session_id).toBeUndefined()
		expect(requests.filter((request) => request.path.endsWith("/sessions")).map((request) => request.body.id).sort()).toEqual(["root-a", "root-b", "root-c"])
		expect(requests.some((request) => request.path.includes("/projects/migrate"))).toBe(false)
		expect(requests.filter((request) => request.path.endsWith("/sessions"))[0].body.project).toBe("preciodelalquiler")

		await harness.stop(cleanup)
	})

	test("retries failed registration, but fails closed for unknown and sub-agent sessions", async () => {
		let registrations = 0
		globalThis.fetch = (async (input, init) => {
			const path = String(input)
			if (path.endsWith("/health")) return response(200, { ok: true })
			if (path.includes("/project/current?cwd=")) return response(200, { project: "preciodelalquiler" })
			if (path.endsWith("/sessions")) {
				registrations++
				if (registrations === 1) return response(503, { error: "unavailable" })
				if (registrations === 2) return response(200, {})
				return response(200, { id: JSON.parse(String(init?.body)).id })
			}
			return response(200, {})
		}) as typeof fetch

		const harness = createHarness({
			fetch: globalThis.fetch,
			sessions: { child: { parentID: "root" }, missing: "missing" },
		})
		const cleanup = await Engram.setup(harness.ctx as never)
		const writer: RegisteredTool = {
			id: "engram_mem_save",
			execute: async () => ({ content: "saved" }),
		}
		harness.applyTransforms([writer])
		const signal = new AbortController().signal

		await expect(writer.execute({}, { sessionID: "root", signal })).rejects.toThrow("could not bind")
		await expect(writer.execute({}, { sessionID: "root", signal })).rejects.toThrow("could not bind")
		await expect(writer.execute({}, { sessionID: "root", signal })).resolves.toEqual({ content: "saved" })
		await expect(writer.execute({}, { sessionID: "child", signal })).rejects.toThrow("could not bind")
		await expect(writer.execute({}, { sessionID: "missing", signal })).rejects.toThrow("could not bind")
		expect(registrations).toBe(3)

		await harness.stop(cleanup)
	})

	test("adds the registered session ID to context and compaction instructions", async () => {
		globalThis.fetch = (async (input, init) => {
			const path = String(input)
			if (path.endsWith("/health")) return response(200, { ok: true })
			if (path.includes("/project/current?cwd=")) return response(200, { project: "preciodelalquiler" })
			if (path.endsWith("/sessions")) return response(200, { id: JSON.parse(String(init?.body)).id })
			if (path.includes("/context?project=")) return response(200, { context: "prior memory" })
			return response(200, {})
		}) as typeof fetch

		const harness = createHarness({ fetch: globalThis.fetch })
		const cleanup = await Engram.setup(harness.ctx as never)
		const context = { sessionID: "root-context", system: [{ type: "text", text: "base" }] }
		await harness.sessionHooks.get("context")?.(context)
		expect(context.system.at(-1).text).toContain("root-context")

		const compaction = { sessionID: "root-compaction", system: [] as Array<{ type: string; text: string }> }
		await harness.sessionHooks.get("compaction")?.(compaction)
		expect(compaction.system.at(-1)?.text).toContain("root-compaction")

		await harness.stop(cleanup)
	})
})
