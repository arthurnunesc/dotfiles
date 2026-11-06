import { afterEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

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
	directory?: string
}) {
	const transforms: Array<(editor: ReturnType<typeof editorFor>) => void> = []
	const sessionHooks = new Map<string, (event: any) => unknown>()
	const toolHooks = new Map<string, (event: any) => unknown>()
	const sessions = options.sessions ?? {}
	const controller = new AbortController()

	const ctx = {
		location: { directory: options.directory ?? "/workspace/v0-rent-comparison-site" },
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
	test("uses the scratch MCP default for HTTP registration, prompts and compaction", async () => {
		const fixture = mkdtempSync(join(tmpdir(), "engram-plugin-scratch-"))
		const previousT3Home = process.env.T3CODE_HOME
		const previousProject = process.env.ENGRAM_PROJECT
		let harness: ReturnType<typeof createHarness> | undefined
		let cleanup: (() => Promise<void> | void) | void = undefined
		try {
			process.env.T3CODE_HOME = fixture
			delete process.env.ENGRAM_PROJECT
			const directory = join(fixture, "scratch", "chat-one")
			mkdirSync(directory, { recursive: true })
			const requests: Array<{ path: string; body?: any }> = []
			globalThis.fetch = (async (input, init) => {
				const path = String(input)
				const body = init?.body ? JSON.parse(String(init.body)) : undefined
				requests.push({ path, body })
				if (path.endsWith("/health")) return response(200, { ok: true })
				if (path.includes("/project/current?cwd=")) return response(200, { project: "chat-one" })
				if (path.endsWith("/sessions")) return response(200, { id: body.id })
				if (path.endsWith("/sessions/scratch-root")) return response(200, { id: "scratch-root", project: "arthur", directory })
				if (path.includes("/context?project=")) return response(200, { context: "prior memory" })
				return response(200, {})
			}) as typeof fetch
			harness = createHarness({ fetch: globalThis.fetch, directory })
			cleanup = await Engram.setup(harness.ctx as never)
			await harness.sessionHooks.get("prompt")?.({ sessionID: "scratch-root", prompt: { text: "A disposable scratch message" } })
			const compaction = { sessionID: "scratch-root", system: [] as Array<{ type: string; text: string }> }
			await harness.sessionHooks.get("compaction")?.(compaction)
			expect(requests.find((request) => request.path.endsWith("/sessions"))?.body).toMatchObject({
				id: "scratch-root", project: "arthur", directory,
			})
			expect(requests.find((request) => request.path.endsWith("/prompts"))?.body.project).toBe("arthur")
			expect(requests.some((request) => request.path.endsWith("/context?project=arthur"))).toBe(true)
			expect(requests.some((request) => request.path.includes("/project/current?cwd="))).toBe(false)
			expect(compaction.system.at(-1)?.text).toContain("project: 'arthur'")
			let writes = 0
			const writer: RegisteredTool = { id: "engram_mem_save", execute: async () => { writes++; return "saved" } }
			harness.applyTransforms([writer])
			const executor = { sessionID: "scratch-root", signal: new AbortController().signal }
			await expect(writer.execute({ session_id: "different-old-root" }, executor)).rejects.toThrow("invoking root session")
			expect(writes).toBe(0)
			await expect(writer.execute({ session_id: "scratch-root" }, executor)).resolves.toBe("saved")
		} finally {
			if (harness) await harness.stop(cleanup)
			if (previousT3Home === undefined) delete process.env.T3CODE_HOME
			else process.env.T3CODE_HOME = previousT3Home
			if (previousProject === undefined) delete process.env.ENGRAM_PROJECT
			else process.env.ENGRAM_PROJECT = previousProject
			rmSync(fixture, { recursive: true, force: true })
		}
	})

	test("does not reclassify or write through an older scratch session owner", async () => {
		const fixture = mkdtempSync(join(tmpdir(), "engram-plugin-stale-"))
		const previousT3Home = process.env.T3CODE_HOME
		const previousProject = process.env.ENGRAM_PROJECT
		let harness: ReturnType<typeof createHarness> | undefined
		let cleanup: (() => Promise<void> | void) | void = undefined
		try {
			process.env.T3CODE_HOME = fixture
			delete process.env.ENGRAM_PROJECT
			const directory = join(fixture, "scratch", "chat-old")
			mkdirSync(directory, { recursive: true })
			const requests: string[] = []
			globalThis.fetch = (async (input) => {
				const path = String(input)
				requests.push(path)
				if (path.endsWith("/health")) return response(200, { ok: true })
				if (path.endsWith("/sessions/old-root")) return response(200, { id: "old-root", project: "chat-old", directory })
				return response(200, {})
			}) as typeof fetch
			harness = createHarness({ fetch: globalThis.fetch, directory })
			cleanup = await Engram.setup(harness.ctx as never)
			let writes = 0
			const writer: RegisteredTool = { id: "engram_mem_save", execute: async () => { writes++; return "saved" } }
			harness.applyTransforms([writer])
			await expect(writer.execute({}, { sessionID: "old-root", signal: new AbortController().signal })).rejects.toThrow("could not bind")
			await expect(writer.execute({ session_id: "old-root" }, { sessionID: "old-root", signal: new AbortController().signal })).rejects.toThrow("could not bind")
			expect(writes).toBe(0)
			expect(requests.some((path) => path.endsWith("/sessions"))).toBe(false)
			expect(requests.some((path) => path.includes("/projects/"))).toBe(false)
		} finally {
			if (harness) await harness.stop(cleanup)
			if (previousT3Home === undefined) delete process.env.T3CODE_HOME
			else process.env.T3CODE_HOME = previousT3Home
			if (previousProject === undefined) delete process.env.ENGRAM_PROJECT
			else process.env.ENGRAM_PROJECT = previousProject
			rmSync(fixture, { recursive: true, force: true })
		}
	})

	test("honors a client project override even when the HTTP server has another default", async () => {
		const previousProject = process.env.ENGRAM_PROJECT
		let harness: ReturnType<typeof createHarness> | undefined
		let cleanup: (() => Promise<void> | void) | void = undefined
		try {
			process.env.ENGRAM_PROJECT = "chosen-context"
			const requests: Array<{ path: string; body?: any }> = []
			globalThis.fetch = (async (input, init) => {
				const path = String(input)
				const body = init?.body ? JSON.parse(String(init.body)) : undefined
				requests.push({ path, body })
				if (path.endsWith("/health")) return response(200, { ok: true })
				if (path.includes("/project/current?cwd=")) return response(200, { project: "server-context" })
				if (path.endsWith("/sessions")) return response(200, { id: body.id })
				return response(200, {})
			}) as typeof fetch
			harness = createHarness({ fetch: globalThis.fetch })
			cleanup = await Engram.setup(harness.ctx as never)
			await harness.sessionHooks.get("prompt")?.({ sessionID: "override-root", prompt: { text: "A disposable override message" } })
			expect(requests.find((request) => request.path.endsWith("/sessions"))?.body.project).toBe("chosen-context")
			expect(requests.find((request) => request.path.endsWith("/prompts"))?.body.project).toBe("chosen-context")
			expect(requests.some((request) => request.path.includes("/project/current?cwd="))).toBe(false)
		} finally {
			if (harness) await harness.stop(cleanup)
			if (previousProject === undefined) delete process.env.ENGRAM_PROJECT
			else process.env.ENGRAM_PROJECT = previousProject
		}
	})

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
