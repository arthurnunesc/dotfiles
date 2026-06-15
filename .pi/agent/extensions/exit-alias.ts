import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("exit", {
    description: "Alias for /quit",
    handler: async (_args, ctx) => {
      ctx.shutdown();
    },
  });

  pi.on("input", async (event, ctx) => {
    if (event.source !== "interactive") return;
    if (event.text.trim() !== "exit") return;

    ctx.shutdown();
    return { action: "handled" };
  });
}
