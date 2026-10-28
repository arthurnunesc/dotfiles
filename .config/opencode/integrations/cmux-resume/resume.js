const firstString = (...values) => values.find((value) => typeof value === "string" && value.trim())?.trim() || null;

function statusIsRunning(status) {
  const value = typeof status === "string"
    ? status
    : firstString(status?.type, status?.status, status?.state);
  return ["running", "busy", "active"].includes(value?.toLowerCase());
}

function sameBinding(left, right) {
  return left?.id === right?.id && left?.cwd === right?.cwd;
}

/**
 * Convert TUI-only, cached metadata into an event-free checkpoint candidate.
 * This deliberately considers no event session ID: the route is authoritative.
 */
export function selectSnapshot(snapshot) {
  const selected = snapshot?.selected;
  const id = firstString(selected?.id, selected?.sessionID, selected?.sessionId);
  const cwd = firstString(selected?.cwd, selected?.directory, selected?.location?.directory);
  const event = firstString(snapshot?.event) || "tui-update";
  const removed = selected?.deleted === true || selected?.archived === true;
  if (!id || (!cwd && !removed)) return null;

  const family = Array.isArray(snapshot?.family) ? snapshot.family : [];
  const openFamilies = Array.isArray(snapshot?.openFamilies) ? snapshot.openFamilies : family;
  return {
    id,
    cwd,
    event,
    removed,
    familyRunning: family.some((session) => statusIsRunning(session?.status ?? session)),
    otherFamilyRunning: openFamilies.some((session) => statusIsRunning(session?.status ?? session)),
  };
}

function hookPayload(snapshot, hookEventName, binding = snapshot) {
  return {
    session_id: binding.id,
    cwd: binding.cwd,
    event: snapshot.event,
    hook_event_name: hookEventName,
  };
}

/**
 * Serializes checkpoint publication. Failed admissions never update binding
 * state, so a later reactive update can retry without a background loop.
 */
export function createResumeController({ getSnapshot, sendHook, onError = () => {} }) {
  let pending = false;
  let draining = null;
  let disposed = false;
  let delivered = null;
  let lifecycleKey = null;
  let failureShown = false;

  const fail = () => {
    if (failureShown) return;
    failureShown = true;
    onError(new Error("cmux could not save this OpenCode chat. Select it again to retry."));
  };

  const admit = async (event, payload) => {
    try {
      const admitted = await sendHook(event, payload);
      if (!admitted) {
        fail();
        return false;
      }
      failureShown = false;
      return true;
    } catch (_) {
      fail();
      return false;
    }
  };

  const publish = async (snapshot) => {
    if (!snapshot || disposed) return;
    if (snapshot.removed) {
      if (delivered?.id !== snapshot.id) return;
      if (await admit("session-end", hookPayload(snapshot, "SessionEnd", delivered))) {
        delivered = null;
        lifecycleKey = null;
      }
      return;
    }

    const binding = { id: snapshot.id, cwd: snapshot.cwd };
    if (!sameBinding(delivered, binding)) {
      if (!(await admit("session-start", hookPayload(snapshot, "SessionStart", binding)))) return;
      delivered = binding;
      lifecycleKey = null;
      const current = selectSnapshot(getSnapshot());
      if (disposed || !sameBinding(current, binding) || current.removed) return;
      snapshot = current;
    }

    const lifecycle = snapshot.familyRunning || snapshot.otherFamilyRunning ? "prompt-submit" : "stop";
    const hookEventName = lifecycle === "prompt-submit" ? "UserPromptSubmit" : "Stop";
    const nextLifecycleKey = `${binding.id}\u0000${binding.cwd}\u0000${lifecycle}`;
    if (lifecycleKey === nextLifecycleKey) return;
    if (await admit(lifecycle, hookPayload(snapshot, hookEventName, binding))) {
      lifecycleKey = nextLifecycleKey;
    }
  };

  const drain = async () => {
    while (pending && !disposed) {
      pending = false;
      await publish(selectSnapshot(getSnapshot()));
    }
  };

  return {
    update() {
      if (disposed) return;
      pending = true;
      if (!draining) {
        draining = drain().finally(() => { draining = null; });
      }
    },
    async flush() {
      while (draining) await draining;
    },
    dispose() {
      disposed = true;
      pending = false;
    },
    binding() {
      return delivered && { ...delivered };
    },
  };
}

export function waitForChildClose(child, timeoutMs = 6000) {
  let cancel = () => {};
  const waiting = new Promise((resolve) => {
    if (!child?.on) return resolve(false);
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      try { child.kill?.(); } catch (_) {}
      finish(false);
    }, timeoutMs);
    timer.unref?.();
    cancel = () => {
      finish(false);
    };
    child.once?.("error", () => finish(false));
    child.once?.("close", (code) => finish(code === 0));
  });
  waiting.cancel = () => cancel();
  return waiting;
}

/**
 * Adapt cmux's native launch-sanitizing dispatcher to acknowledged delivery.
 * The native dispatcher starts the asynchronous child; this wrapper owns it
 * until close/error/timeout and provides only a boolean admission result.
 */
export function createDispatchingSender({
  dispatchSessionHook,
  spawnImpl,
  environment = process.env,
  pid = process.pid,
  awaitClose = waitForChildClose,
  onChild,
  onChildSettled,
}) {
  const children = new Set();
  const waits = new Set();
  const sender = async (event, payload) => {
    let child = null;
    const env = {
      ...environment,
      CMUX_OPENCODE_PID: String(pid),
      CMUX_OPENCODE_CMUX_BIN: environment.CMUX_BUNDLED_CLI_PATH || environment.CMUX_OPENCODE_CMUX_BIN || "cmux",
    };
    const admitted = dispatchSessionHook(event, payload, (...args) => {
      child = spawnImpl(...args);
      if (child) {
        children.add(child);
        onChild?.(child);
      }
      return child;
    }, env);
    if (!admitted || !child) return false;
    const waiting = awaitClose(child);
    waits.add(waiting);
    try {
      return await waiting;
    } finally {
      waits.delete(waiting);
      children.delete(child);
      onChildSettled?.(child);
    }
  };
  sender.dispose = () => {
    for (const waiting of waits) waiting.cancel?.();
    waits.clear();
    for (const child of children) {
      try { child.kill?.(); } catch (_) {}
    }
    children.clear();
  };
  return sender;
}

/** Dispose only resources created by this wrapper; never alter session state. */
export function cleanupTUI({ controller, sender, disposers = [] }) {
  return () => {
    controller.dispose();
    sender.dispose();
    for (const dispose of disposers) {
      try { dispose?.(); } catch (_) {}
    }
  };
}
