import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EventEmitter } from "node:events";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const settle = async () => {
  for (let index = 0; index < 5; index++) await new Promise((resolve) => setImmediate(resolve));
};

async function loadPlugin(environment) {
  const context = vm.createContext({ process: { env: environment, pid: 4242 }, setTimeout, clearTimeout });
  const source = await readFile(path.join(directory, "tui.js"), "utf8");
  const tui = new vm.SourceTextModule(source, { context, identifier: "cmux-resume/tui.js" });
  const resumeSource = await readFile(path.join(directory, "resume.js"), "utf8");
  const resume = new vm.SourceTextModule(resumeSource, { context, identifier: "cmux-resume/resume.js" });
  const state = { effects: [], events: [], hooks: [], slots: [], feedDisposals: 0 };
  const childProcess = new vm.SyntheticModule(["spawn"], function () {
    this.setExport("spawn", () => {
      const child = new EventEmitter();
      child.stdin = { on() {}, end(serialized) { state.hooks.push(JSON.parse(serialized)); } };
      child.unref = () => {};
      child.kill = () => child.emit("close", 1);
      setImmediate(() => child.emit("close", 0));
      return child;
    });
  }, { context });
  const plugin = new vm.SyntheticModule(["Plugin"], function () {
    this.setExport("Plugin", { define: (definition) => definition });
  }, { context });
  const solid = new vm.SyntheticModule(["createEffect"], function () {
    this.setExport("createEffect", (effect) => state.effects.push(effect));
  }, { context });
  const cmux = new vm.SyntheticModule(["createCMUXTUIBridge", "dispatchSessionHook"], function () {
    this.setExport("createCMUXTUIBridge", async () => () => { state.feedDisposals++; });
    this.setExport("dispatchSessionHook", (event, payload, spawnImpl, env) => {
      if (env.CMUX_OPENCODE_HOOKS_DISABLED === "1" || !env.CMUX_SURFACE_ID) return false;
      const child = spawnImpl(env.CMUX_OPENCODE_CMUX_BIN, ["hooks", "enqueue", "opencode", event], {});
      child.stdin.end(JSON.stringify(payload));
      return true;
    });
  }, { context });
  await tui.link(async (specifier) => {
    if (specifier === "./resume.js") return resume;
    if (specifier === "node:child_process") return childProcess;
    if (specifier === "@opencode/plugin/tui") return plugin;
    if (specifier === "solid-js") return solid;
    if (specifier === "../../plugins/cmux/tui.js") return cmux;
    throw new Error(`Unexpected import: ${specifier}`);
  });
  await tui.evaluate();
  state.definition = tui.namespace.default;
  return state;
}

function makeContext() {
  const sessions = new Map();
  let route = { type: "session", sessionID: "first" };
  let sessionEvents;
  const unregistered = [];
  const ctx = {
    location: { directory: "/launch" },
    ui: {
      router: { current: () => route },
      tabs: { enabled: () => true, list: () => [{ sessionID: "background" }] },
      slot: (slot) => { ctx.slot = slot; return () => unregistered.push("slot"); },
      toast: { show() {} },
    },
    data: {
      session: {
        get: (id) => sessions.get(id),
        family: (id) => [id],
        status: (id) => sessions.get(id)?.status || "idle",
        root: (id) => sessions.get(id)?.root || id,
      },
      listen: (listener) => { sessionEvents = listener; return () => unregistered.push("event"); },
    },
  };
  const setRoute = (next) => { route = next; };
  const setSession = (id, data) => sessions.set(id, data);
  const emit = (event) => sessionEvents({ details: { event } });
  return { ctx, emit, setRoute, setSession, unregistered };
}

test("actual TUI plugin checkpoints the selected route and preserves its binding", async () => {
  const state = await loadPlugin({ CMUX_SURFACE_ID: "surface" });
  const { ctx, emit, setRoute, setSession, unregistered } = makeContext();
  setSession("first", { location: { directory: "/before" }, status: "idle" });
  setSession("second", { location: { directory: "/second" }, status: "idle" });
  setSession("background", { location: { directory: "/background" }, status: "running" });

  const cleanup = await state.definition.setup(ctx);
  ctx.slot.render();
  for (const effect of state.effects) effect();
  await settle();
  assert.deepEqual(state.hooks.map(({ session_id }) => session_id), ["first", "first"]);
  assert.equal(state.hooks[0].cwd, "/before");
  assert.equal(state.hooks.some(({ id }) => id), false);

  setRoute({ type: "session", sessionID: "second" });
  for (const effect of state.effects) effect();
  await settle();
  assert.deepEqual(state.hooks.slice(2).map(({ session_id, hook_event_name }) => [session_id, hook_event_name]), [["second", "SessionStart"], ["second", "UserPromptSubmit"]]);

  ctx.ui.tabs.enabled = () => false;
  ctx.ui.tabs.list = () => { throw new Error("disabled tabs must not be queried"); };
  emit({ type: "session.idle", data: { sessionID: "child" } });
  emit({ type: "session.idle", data: { sessionID: "background" } });
  emit({ type: "session.updated", data: { info: { id: "first", time: { archived: 1 } } } });
  await settle();
  assert.equal(state.hooks.at(-1).session_id, "second");

  setSession("second", { location: { directory: "/after" }, status: "idle" });
  for (const effect of state.effects) effect();
  await settle();
  assert.equal(state.hooks.at(-2).session_id, "second");
  assert.equal(state.hooks.at(-2).cwd, "/after");

  setRoute({ type: "home" });
  for (const effect of state.effects) effect();
  await settle();
  const countAtHome = state.hooks.length;
  emit({ type: "session.deleted", data: { info: { id: "unrelated" } } });
  await settle();
  assert.equal(state.hooks.length, countAtHome);
  emit({ type: "session.deleted", data: { info: { id: "second" } } });
  await settle();
  assert.deepEqual(state.hooks.at(-1), {
    session_id: "second",
    cwd: "/after",
    event: "tui-reactive-update",
    hook_event_name: "SessionEnd",
  });

  setSession("third", { location: { directory: "/third" }, status: "idle" });
  setRoute({ type: "session", sessionID: "third" });
  for (const effect of state.effects) effect();
  await settle();
  setRoute({ type: "plugin", name: "example" });
  for (const effect of state.effects) effect();
  await settle();
  emit({ type: "session.updated", data: { info: { id: "third", time: { archived: 1 } } } });
  await settle();
  assert.deepEqual(state.hooks.at(-1), {
    session_id: "third",
    cwd: "/third",
    event: "tui-reactive-update",
    hook_event_name: "SessionEnd",
  });

  cleanup();
  assert.deepEqual(unregistered, ["slot", "event"]);
  assert.equal(state.feedDisposals, 1);
});

test("disabled or non-cmux TUI setup is inert", async () => {
  for (const environment of [
    { CMUX_SURFACE_ID: "surface", CMUX_OPENCODE_HOOKS_DISABLED: "1" },
    {},
  ]) {
    const state = await loadPlugin(environment);
    const { ctx } = makeContext();
    assert.equal(await state.definition.setup(ctx), undefined);
    assert.equal(state.effects.length, 0);
    assert.equal(state.feedDisposals, 0);
  }
});
