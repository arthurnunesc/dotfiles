import type { Plugin } from "@opencode-ai/plugin"

const aliases: Record<string, string> = {
	";go": "Proceed with the implementation of the plan.",
	";yeet":
		"Commit the changes, separate each commit into human-readable chunks, follow the commit title convention of the repo and push to the relevant branch. If not sure, ask which branch.",
	";source?": "Tell me how you got to that conclusion, source your claims.",
}

function rewriteExactAlias(parts: { type: string }[]) {
	for (const part of parts) {
		if (part.type !== "text") continue

		const textPart = part as typeof part & { text?: string }
		const replacement = aliases[textPart.text?.trim() ?? ""]
		if (replacement) textPart.text = replacement
	}
}

function rewriteCommandAlias(argument: string, parts: { type: string }[]) {
	const alias = argument.trim()
	const replacement = aliases[alias]
	if (!replacement) return

	for (const part of parts) {
		if (part.type !== "text") continue

		const textPart = part as typeof part & { text?: string }
		if (textPart.text) textPart.text = textPart.text.replaceAll(alias, replacement)
	}
}

export const PrivateAliasesPlugin: Plugin = async () => {
	return {
		"chat.message": async (_input, output) => {
			rewriteExactAlias(output.parts)
		},
		"command.execute.before": async (input, output) => {
			rewriteCommandAlias(input.arguments, output.parts)
		},
	}
}

export default PrivateAliasesPlugin
