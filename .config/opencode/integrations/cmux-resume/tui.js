import { spawn } from "node:child_process";
import { Plugin } from "@opencode/plugin/tui";
import { createEffect } from "solid-js";
import { createCMUXTUIBridge, dispatchSessionHook } from "../../plugins/cmux/tui.js";
import { cleanupTUI, createDispatchingSender, createResumeController } from "./resume.js";

const firstString = (...values) => values.find((value) => typeof value === "string" && value.trim())?.trim() || null;

function eventSessionID(event) {
  const data = event?.data || event?.properties || {};
  const info = data.info || data.message || {};
  return firstString(data.sessionID, data.sessionId, data.session_id, info.id, info.sessionID, info.sessionId);
}

function eventRemovesSession(event) {
  if (event?.type === "session.deleted") return true;
  return event?.type === "session.updated" && Boolean((event?.data || event?.properties || {}).info?.time?.archived);
}

export function readSnapshot(ctx, removed, delivered) {
  const route = ctx.ui.router.current();
  // Do not replace a binding when navigating to home or a plugin page. An
  // explicit removal still ends only the binding that this controller delivered.
  if (route?.type !== "session" || !route.sessionID) {
    if (!delivered || !removed.has(delivered.id)) return null;
    return {
      selected: { id: delivered.id, cwd: delivered.cwd, deleted: true },
      family: [],
      openFamilies: [],
      event: "tui-reactive-update",
    };
  }

  const selected = ctx.data.session.get(route.sessionID);
  if (!selected && !removed.has(route.sessionID)) return null;
  const location = selected?.location;
  const familyFor = (id) => {
    const rootID = ctx.data.session.root?.(id) || id;
    const family = ctx.data.session.family(rootID) || [];
    return family.length > 0 ? family : [id];
  };
  const familyIDs = familyFor(route.sessionID);
  const openRoots = new Set([route.sessionID]);
  if (ctx.ui.tabs.enabled?.() !== false) {
    for (const tab of ctx.ui.tabs.list()) openRoots.add(tab.sessionID);
  }
  const openFamilyIDs = new Set();
  for (const rootID of openRoots) {
    for (const familyID of familyFor(rootID)) openFamilyIDs.add(familyID);
  }

  return {
    selected: {
      id: route.sessionID,
      // A current session location always wins over the TUI launch location.
      cwd: location?.directory || ctx.location?.directory,
      status: selected ? ctx.data.session.status(route.sessionID) : undefined,
      deleted: removed.has(route.sessionID),
      archived: removed.has(route.sessionID),
    },
    family: familyIDs.map((id) => ({ id, status: ctx.data.session.status(id) })),
    openFamilies: [...openFamilyIDs].map((id) => ({ id, status: ctx.data.session.status(id) })),
    event: "tui-reactive-update",
  };
}

const environment = process.env;

const definition = {
  id: "cmux.resume-safe",
  async setup(ctx) {
    // Respect the original opt-out and avoid a daemon or non-cmux TUI binding.
    if (environment.CMUX_OPENCODE_HOOKS_DISABLED === "1" || !environment.CMUX_SURFACE_ID) return;

    const disposeFeed = await createCMUXTUIBridge(ctx, {
      environment: { ...environment, CMUX_OPENCODE_HOOKS_DISABLED: "1" },
    });
    const removed = new Set();
    let latestSnapshot = null;
    const sender = createDispatchingSender({
      dispatchSessionHook,
      spawnImpl: spawn,
      environment,
    });
    const controller = createResumeController({
      getSnapshot: () => latestSnapshot,
      sendHook: sender,
      onError: () => {
        try {
          ctx.ui.toast.show({
            message: "cmux could not save this chat. Select it again to retry.",
            variant: "error",
          });
        } catch (_) {}
      },
    });

    const refresh = () => {
      latestSnapshot = readSnapshot(ctx, removed, controller.binding());
      controller.update();
    };
    const stopEvents = ctx.data.listen(({ details }) => {
      const event = details?.event || details;
      const id = eventSessionID(event);
      if (id && eventRemovesSession(event)) removed.add(id);
      refresh();
    });
    const stopSlot = ctx.ui.slot({
      append: "app",
      render: () => {
        createEffect(() => {
          // These getters are reactive. No polling and no event session ID is
          // used to choose the checkpoint.
          refresh();
        });
        return null;
      },
    });

    // Closing a TUI must retain cmux's persistent resume binding.
    return cleanupTUI({ controller, sender, disposers: [stopSlot, stopEvents, disposeFeed] });
  },
};

export default Plugin.define(definition);
