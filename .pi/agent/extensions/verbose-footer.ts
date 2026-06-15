import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { isAbsolute, relative, resolve, sep } from "node:path";

function sanitizeStatusText(text: string): string {
  return text.replace(/[\r\n\t]/g, " ").replace(/ +/g, " ").trim();
}

function formatTokens(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  if (count < 1000000) return `${Math.round(count / 1000)}k`;
  if (count < 10000000) return `${(count / 1000000).toFixed(1)}M`;
  return `${Math.round(count / 1000000)}M`;
}

function formatCwdForFooter(cwd: string, home: string | undefined): string {
  if (!home) return cwd;
  const resolvedCwd = resolve(cwd);
  const resolvedHome = resolve(home);
  const relativeToHome = relative(resolvedHome, resolvedCwd);
  const isInsideHome =
    relativeToHome === "" ||
    (relativeToHome !== ".." && !relativeToHome.startsWith(`..${sep}`) && !isAbsolute(relativeToHome));
  if (!isInsideHome) return cwd;
  return relativeToHome === "" ? "~" : `~${sep}${relativeToHome}`;
}

function visibleJoin(parts: Array<string | undefined | null | false>, separator = " | "): string {
  return parts.filter(Boolean).join(separator);
}

function truncateLine(line: string, width: number, theme: any): string {
  return truncateToWidth(line, width, theme.fg("dim", "..."));
}

function compactModelStatus(model: any, providerCount: number, thinkingLevel: string | undefined): string {
  const modelName = model?.id || "no-model";
  const providerPrefix = model ? `(${model.provider}) ` : "";
  const thinkingSuffix = model?.reasoning ? ` • ${thinkingLevel || "off"}` : "";

  // Keep provider visible as requested, even if there is only one available provider.
  return providerCount > 0 ? `${providerPrefix}${modelName}${thinkingSuffix}` : `${modelName}${thinkingSuffix}`;
}

function fitOneLine(left: string, right: string, width: number, theme: any): string {
  if (width <= 0) return "";

  const rightWidth = visibleWidth(right);
  const minGap = right ? 2 : 0;

  if (!right || rightWidth + minGap >= width) {
    return truncateLine(right || left, width, theme);
  }

  const leftAvailable = width - rightWidth - minGap;
  const fittedLeft = truncateLine(left, leftAvailable, theme);
  const gap = " ".repeat(Math.max(minGap, width - visibleWidth(fittedLeft) - rightWidth));
  return `${fittedLeft}${gap}${right}`;
}

function getUsage(ctx: any) {
  let input = 0;
  let output = 0;
  let cacheRead = 0;
  let cacheWrite = 0;
  let cost = 0;
  let latestCacheHitRate: number | undefined;

  const entries = ctx.sessionManager.getEntries?.() ?? ctx.sessionManager.getBranch?.() ?? [];
  for (const entry of entries) {
    if (entry?.type !== "message" || entry.message?.role !== "assistant") continue;
    const usage = entry.message.usage ?? {};
    input += usage.input ?? 0;
    output += usage.output ?? 0;
    cacheRead += usage.cacheRead ?? 0;
    cacheWrite += usage.cacheWrite ?? 0;
    cost += usage.cost?.total ?? 0;

    const latestPromptTokens = (usage.input ?? 0) + (usage.cacheRead ?? 0) + (usage.cacheWrite ?? 0);
    latestCacheHitRate = latestPromptTokens > 0 ? ((usage.cacheRead ?? 0) / latestPromptTokens) * 100 : undefined;
  }

  return { input, output, cacheRead, cacheWrite, cost, latestCacheHitRate };
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.setFooter((tui, theme, footerData) => {
      const unsub = footerData.onBranchChange(() => tui.requestRender());

      return {
        dispose: unsub,
        invalidate() {},
        render(width: number): string[] {
          const usage = getUsage(ctx);
          const contextUsage = ctx.getContextUsage?.();
          const model = ctx.model;
          const contextWindow = contextUsage?.contextWindow ?? model?.contextWindow ?? 0;
          const contextPercentValue = contextUsage?.percent ?? 0;
          const contextPercent = contextUsage?.percent == null ? "?" : `${contextUsage.percent.toFixed(1)}%`;
          const contextDisplay = `${contextPercent} / ${formatTokens(contextWindow)} (auto)`;
          const contextPart =
            contextPercentValue > 90
              ? theme.fg("error", contextDisplay)
              : contextPercentValue > 70
                ? theme.fg("warning", contextDisplay)
                : contextDisplay;

          const cwd = formatCwdForFooter(ctx.sessionManager.getCwd(), process.env.HOME || process.env.USERPROFILE);
          const branch = footerData.getGitBranch();
          const sessionName = ctx.sessionManager.getSessionName?.();

          const locationLine = visibleJoin([
            `cwd: ${cwd}`,
            branch && `branch: ${branch}`,
            sessionName && `session: ${sessionName}`,
          ]);

          const thinkingLevel = (pi.getThinkingLevel?.() as string | undefined) ?? undefined;
          const modelStatus = compactModelStatus(model, footerData.getAvailableProviderCount(), thinkingLevel);
          const modelGap = modelStatus ? 2 : 0;
          const statsAvailableWidth = Math.max(0, width - visibleWidth(modelStatus) - modelGap);

          const usingSubscription = model ? ctx.modelRegistry?.isUsingOAuth?.(model) : false;
          const costPart = usage.cost || usingSubscription ? `cost: $${usage.cost.toFixed(3)}${usingSubscription ? " (sub)" : ""}` : undefined;
          const cacheHitPart =
            (usage.cacheRead || usage.cacheWrite) && usage.latestCacheHitRate !== undefined
              ? `cache hit: ${usage.latestCacheHitRate.toFixed(1)}%`
              : undefined;
          const allStatsParts = [
            usage.input ? `tokens up: ${formatTokens(usage.input)}` : undefined,
            usage.output ? `tokens down: ${formatTokens(usage.output)}` : undefined,
            usage.cacheRead ? `cache read: ${formatTokens(usage.cacheRead)}` : undefined,
            usage.cacheWrite ? `cache write: ${formatTokens(usage.cacheWrite)}` : undefined,
            cacheHitPart,
            costPart,
            `context: ${contextPart}`,
          ];
          const priorityStatsParts = [
            usage.input ? `tokens up: ${formatTokens(usage.input)}` : undefined,
            usage.output ? `tokens down: ${formatTokens(usage.output)}` : undefined,
            usage.cacheRead ? `cache read: ${formatTokens(usage.cacheRead)}` : undefined,
            cacheHitPart,
            `context: ${contextPart}`,
          ];
          const allStatsLine = visibleJoin(allStatsParts);
          const priorityStatsLine = visibleJoin(priorityStatsParts);
          const statsLine =
            visibleWidth(allStatsLine) <= statsAvailableWidth
              ? allStatsLine
              : visibleWidth(priorityStatsLine) <= statsAvailableWidth
                ? priorityStatsLine
                : truncateLine(priorityStatsLine, statsAvailableWidth, theme);

          const extensionStatuses = footerData.getExtensionStatuses();
          const statusLine =
            extensionStatuses.size > 0
              ? Array.from(extensionStatuses.entries())
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([, text]) => sanitizeStatusText(text))
                  .join(" | ")
              : undefined;

          const statsWithModelLine = fitOneLine(statsLine, modelStatus, width, theme);

          const lines = [
            theme.fg("dim", truncateLine(locationLine, width, theme)),
            theme.fg("dim", statsWithModelLine),
          ];

          if (statusLine) {
            lines.push(theme.fg("dim", truncateLine(`status: ${statusLine}`, width, theme)));
          }

          return lines;
        },
      };
    });
  });
}
