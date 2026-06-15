import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
// @ts-expect-error - installed locally for extension runtime
import { detectTerminal as detectTerminalFn } from "detect-terminal";
// @ts-expect-error - installed locally for extension runtime
import notifier from "node-notifier";

interface NotifyConfig {
  notifyChildSessions: boolean;
  sounds: {
    idle: string;
    error: string;
    permission: string;
    question?: string;
  };
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
  terminal?: string;
}

interface TerminalInfo {
  name: string | null;
  bundleId: string | null;
  processName: string | null;
}

interface NotificationOptions {
  title: string;
  message: string;
  subtitle?: string;
  cmuxBody?: string;
  sound: string;
  terminalInfo: TerminalInfo;
}

interface NotificationRuntime {
  preferCmux: boolean;
}

const DEFAULT_CONFIG: NotifyConfig = {
  notifyChildSessions: false,
  sounds: {
    idle: "Glass",
    error: "Basso",
    permission: "Submarine",
  },
  quietHours: {
    enabled: false,
    start: "22:00",
    end: "08:00",
  },
};

const TERMINAL_PROCESS_NAMES: Record<string, string> = {
  ghostty: "Ghostty",
  kitty: "kitty",
  iterm: "iTerm2",
  iterm2: "iTerm2",
  wezterm: "WezTerm",
  alacritty: "Alacritty",
  terminal: "Terminal",
  apple_terminal: "Terminal",
  hyper: "Hyper",
  warp: "Warp",
  vscode: "Code",
  "vscode-insiders": "Code - Insiders",
};

const execFileAsync = promisify(execFile);
const READY_DEDUPE_WINDOW_MS = 1500;
const PERMISSION_DEDUPE_WINDOW_MS = 1500;
const CMUX_NOTIFY_TIMEOUT_MS = 1500;

type RecentNotifications = Map<string, number>;

async function loadConfig(): Promise<NotifyConfig> {
  const configPaths = [
    path.join(os.homedir(), ".pi", "agent", "notify.json"),
    path.join(os.homedir(), ".config", "opencode", "kdco-notify.json"),
  ];

  for (const configPath of configPaths) {
    try {
      const content = await fs.readFile(configPath, "utf8");
      const userConfig = JSON.parse(content) as Partial<NotifyConfig>;

      return {
        ...DEFAULT_CONFIG,
        ...userConfig,
        sounds: {
          ...DEFAULT_CONFIG.sounds,
          ...userConfig.sounds,
        },
        quietHours: {
          ...DEFAULT_CONFIG.quietHours,
          ...userConfig.quietHours,
        },
      };
    } catch {}
  }

  return DEFAULT_CONFIG;
}

async function runOsascript(script: string): Promise<string | null> {
  if (process.platform !== "darwin") return null;

  try {
    const { stdout } = await execFileAsync("osascript", ["-e", script]);
    return String(stdout).trim();
  } catch {
    return null;
  }
}

async function getBundleId(appName: string): Promise<string | null> {
  return runOsascript(`id of application "${appName}"`);
}

async function getFrontmostApp(): Promise<string | null> {
  return runOsascript(
    'tell application "System Events" to get name of first application process whose frontmost is true',
  );
}

async function detectTerminalInfo(config: NotifyConfig): Promise<TerminalInfo> {
  const terminalName = config.terminal || detectTerminalFn() || null;

  if (!terminalName) {
    return { name: null, bundleId: null, processName: null };
  }

  const processName = TERMINAL_PROCESS_NAMES[terminalName.toLowerCase()] || terminalName;
  const bundleId = await getBundleId(processName);

  return {
    name: terminalName,
    bundleId,
    processName,
  };
}

async function isTerminalFocused(terminalInfo: TerminalInfo): Promise<boolean> {
  if (!terminalInfo.processName) return false;
  if (process.platform !== "darwin") return false;

  const frontmost = await getFrontmostApp();
  if (!frontmost) return false;

  return frontmost.toLowerCase() === terminalInfo.processName.toLowerCase();
}

function isQuietHours(config: NotifyConfig): boolean {
  if (!config.quietHours.enabled) return false;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startHour, startMin] = config.quietHours.start.split(":").map(Number);
  const [endHour, endMin] = config.quietHours.end.split(":").map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized;
}

function shouldSendDedupedNotification(
  recentNotifications: RecentNotifications,
  dedupeKey: string,
  windowMs: number,
  nowMs = Date.now(),
): boolean {
  for (const [key, timestamp] of recentNotifications) {
    if (nowMs - timestamp >= windowMs) {
      recentNotifications.delete(key);
    }
  }

  const lastSentAt = recentNotifications.get(dedupeKey);
  if (lastSentAt !== undefined && nowMs - lastSentAt < windowMs) {
    return false;
  }

  recentNotifications.set(dedupeKey, nowMs);
  return true;
}

function commandExists(command: string): boolean {
  const pathDirs = (process.env.PATH ?? "").split(path.delimiter);
  return pathDirs.some((dir) => {
    try {
      return existsSync(path.join(dir, command));
    } catch {
      return false;
    }
  });
}

function canUseCmuxNotification(env: NodeJS.ProcessEnv = process.env): boolean {
  const workspaceID = env.CMUX_WORKSPACE_ID?.trim();
  if (!workspaceID) return false;
  return commandExists("cmux");
}

function buildCmuxNotifyArgs(payload: { title: string; body: string; subtitle?: string }): string[] {
  const args = ["notify", "--title", payload.title];

  const subtitle = payload.subtitle?.trim();
  if (subtitle) {
    args.push("--subtitle", subtitle);
  }

  args.push("--body", payload.body);
  return args;
}

async function sendCmuxNotification(payload: {
  title: string;
  body: string;
  subtitle?: string;
}): Promise<boolean> {
  try {
    const proc = spawn("cmux", buildCmuxNotifyArgs(payload), {
      stdio: "ignore",
    });

    return await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        try {
          proc.kill();
        } catch {}
        resolve(false);
      }, CMUX_NOTIFY_TIMEOUT_MS);

      proc.once("exit", (code) => {
        clearTimeout(timeout);
        resolve(code === 0);
      });

      proc.once("error", () => {
        clearTimeout(timeout);
        resolve(false);
      });
    });
  } catch {
    return false;
  }
}

function sendNodeNotification(options: NotificationOptions): void {
  const { title, message, sound, terminalInfo } = options;

  const notifyOptions: Record<string, unknown> = {
    title,
    message,
    sound,
  };

  if (process.platform === "darwin" && terminalInfo.bundleId) {
    notifyOptions.activate = terminalInfo.bundleId;
  }

  notifier.notify(notifyOptions);
}

async function sendNotification(
  options: NotificationOptions,
  runtime: NotificationRuntime,
): Promise<void> {
  if (runtime.preferCmux) {
    const sentViaCmux = await sendCmuxNotification({
      title: options.title,
      subtitle: options.subtitle,
      body: options.cmuxBody ?? options.message,
    });
    if (sentViaCmux) return;
  }

  sendNodeNotification(options);
}

function extractTextFromPart(part: any): string {
  if (typeof part === "string") return part;
  if (!part || typeof part !== "object") return "";
  if (typeof part.text === "string") return part.text;
  if (typeof part.content === "string") return part.content;
  return "";
}

function extractMessageText(message: any): string {
  if (!message || typeof message !== "object") return "";
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.content)) return message.content.map(extractTextFromPart).join("\n");
  if (Array.isArray(message.parts)) return message.parts.map(extractTextFromPart).join("\n");
  return "";
}

function looksLikeQuestion(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) return false;
  const tail = normalized.split("\n").filter(Boolean).slice(-3).join(" ");
  return /\?\s*$/.test(tail) || /\b(please confirm|confirm\?|which .*\?|do you want|should i|would you like)\b/i.test(tail);
}

function getLastAssistantText(ctx: any): string {
  try {
    const branch = ctx.sessionManager.getBranch() as any[];
    for (let i = branch.length - 1; i >= 0; i--) {
      const entry = branch[i];
      const message = entry?.message;
      if (entry?.type === "message" && message?.role === "assistant") {
        return extractMessageText(message);
      }
    }
  } catch {}

  return "";
}

function getSessionTitle(ctx: any): string {
  try {
    const sessionFile = ctx.sessionManager.getSessionFile?.();
    if (typeof sessionFile === "string" && sessionFile.trim()) {
      return path.basename(sessionFile).replace(/\.jsonl$/, "").slice(0, 50);
    }
  } catch {}

  return "Task";
}

async function handleAgentEnd(
  ctx: any,
  config: NotifyConfig,
  terminalInfo: TerminalInfo,
  notificationRuntime: NotificationRuntime,
): Promise<void> {
  if (isQuietHours(config)) return;

  const lastText = getLastAssistantText(ctx);
  const isQuestion = looksLikeQuestion(lastText);

  if (!isQuestion && (await isTerminalFocused(terminalInfo))) return;

  const sessionTitle = getSessionTitle(ctx);

  await sendNotification(
    isQuestion
      ? {
          title: "Question for you",
          message: "Pi needs your input",
          sound: config.sounds.question ?? config.sounds.permission,
          terminalInfo,
        }
      : {
          title: "Ready for review",
          message: sessionTitle,
          subtitle: sessionTitle,
          cmuxBody: "Pi task is ready for review",
          sound: config.sounds.idle,
          terminalInfo,
        },
    notificationRuntime,
  );
}

async function handlePermissionLikeStop(
  config: NotifyConfig,
  terminalInfo: TerminalInfo,
  notificationRuntime: NotificationRuntime,
): Promise<void> {
  if (isQuietHours(config)) return;
  if (await isTerminalFocused(terminalInfo)) return;

  await sendNotification(
    {
      title: "Waiting for you",
      message: "Pi needs your input",
      sound: config.sounds.permission,
      terminalInfo,
    },
    notificationRuntime,
  );
}

export default async function (pi: ExtensionAPI) {
  const config = await loadConfig();
  const terminalInfo = await detectTerminalInfo(config);
  const notificationRuntime: NotificationRuntime = {
    preferCmux: canUseCmuxNotification(),
  };
  const recentReadyNotifications: RecentNotifications = new Map();
  const recentPermissionNotifications: RecentNotifications = new Map();

  pi.on("agent_end", async (_event, ctx) => {
    const sessionFile = toNonEmptyString(ctx.sessionManager.getSessionFile?.()) ?? "ephemeral";
    const dedupeKey = `agent-end:${sessionFile}`;
    if (!shouldSendDedupedNotification(recentReadyNotifications, dedupeKey, READY_DEDUPE_WINDOW_MS)) {
      return;
    }

    await handleAgentEnd(ctx, config, terminalInfo, notificationRuntime);
  });

  pi.on("project_trust", async (event) => {
    const dedupeKey = `project-trust:${event.cwd}`;
    if (!shouldSendDedupedNotification(recentPermissionNotifications, dedupeKey, PERMISSION_DEDUPE_WINDOW_MS)) {
      return { trusted: "undecided" };
    }

    await handlePermissionLikeStop(config, terminalInfo, notificationRuntime);
    return { trusted: "undecided" };
  });
}
