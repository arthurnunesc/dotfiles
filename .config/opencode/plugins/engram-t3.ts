// Load the upstream Engram plugin unchanged, after `engram-t3 --prepare-only`
// gives T3 scratch thread folders the project "general".
//
// The upstream plugin resolves the project once in setup(), so the config must
// exist before it runs. Keep ../engram/engram.ts byte-identical to upstream
// plugin/opencode/engram.ts; it is outside plugins/ so OpenCode does not load it twice.
import { spawnSync } from "node:child_process"

import upstream from "../engram/engram.ts"

export default {
	...upstream,
	async setup(ctx: { location: { directory: string } }) {
		spawnSync("engram-t3", ["--prepare-only", ctx.location.directory], { stdio: "ignore", timeout: 5000 })
		return upstream.setup(ctx as Parameters<typeof upstream.setup>[0])
	},
}
