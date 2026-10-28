import { Plugin } from "@opencode/plugin"

const aliases: Record<string, string> = {
	";go": "Proceed with the implementation of the plan.",
	";yeet":
		"Commit the changes, separate each commit into human-readable chunks, follow the commit title convention of the repo and push to the relevant branch. If not sure, ask which branch.",
	";source?": "Tell me how you got to that conclusion, source your claims.",
}

export const PrivateAliasesPlugin = Plugin.define({
	id: "private-aliases",
	async setup(ctx) {
		await ctx.session.hook("prompt", (event) => {
			const replacement = aliases[event.prompt.text.trim()]
			if (replacement) event.prompt.text = replacement
		})
	},
})

export default PrivateAliasesPlugin
