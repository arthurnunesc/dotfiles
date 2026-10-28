import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import {
  cleanupTUI,
  createDispatchingSender,
  createResumeController,
  selectSnapshot,
} from "./resume.js";

const idle = (id, cwd = `/work/${id}`, extra = {}) => ({
  selected: { id, cwd, status: "idle", ...extra },
  family: [{ id, status: "idle" }],
  openFamilies: [{ id, status: "idle" }],
  event: "route-change",
});

const running = (id, cwd = `/work/${id}`, extra = {}) => ({
  selected: { id, cwd, status: "running", ...extra },
  family: [{ id, status: "running" }],
  openFamilies: [{ id, status: "running" }],
  event: "route-change",
});

function controllerFor(getSnapshot, calls, errors = []) {
  return createResumeController({
    getSnapshot,
    sendHook: async (event, payload) => {
      calls.push({ event, payload });
      return true;
    },
    onError: (error) => errors.push(error),
  });
}

test("selectSnapshot accepts cached selected metadata and no server event", () => {
  assert.deepEqual(selectSnapshot(idle("existing")), {
    id: "existing",
    cwd: "/work/existing",
    event: "route-change",
    removed: false,
    familyRunning: false,
    otherFamilyRunning: false,
  });
});

test("selected existing chat is checkpointed without server events", async () => {
  const calls = [];
  const controller = controllerFor(() => idle("existing"), calls);
  controller.update();
  await controller.flush();
  assert.deepEqual(calls.map(({ event }) => event), ["session-start", "stop"]);
  assert.equal(calls[0].payload.session_id, "existing");
});

test("a reactive route switch selects the new chat without server events", async () => {
  const calls = [];
  let snapshot = idle("first");
  const controller = controllerFor(() => snapshot, calls);
  controller.update();
  await controller.flush();
  snapshot = idle("second");
  controller.update();
  await controller.flush();
  assert.deepEqual(calls.map(({ event, payload }) => [event, payload.session_id]), [
    ["session-start", "first"], ["stop", "first"],
    ["session-start", "second"], ["stop", "second"],
  ]);
});

test("child completion keeps the selected parent checkpoint", async () => {
  const calls = [];
  const snapshot = idle("parent");
  snapshot.family = [{ id: "parent", status: "idle" }, { id: "child", status: "idle" }];
  const controller = controllerFor(() => snapshot, calls);
  controller.update();
  await controller.flush();
  assert.equal(calls.at(-1).payload.session_id, "parent");
  assert.equal(calls.some(({ payload }) => payload.session_id === "child"), false);
});

test("inactive tab state cannot replace the selected checkpoint", async () => {
  const calls = [];
  const snapshot = idle("active");
  snapshot.openFamilies = [{ id: "active", status: "idle" }, { id: "inactive", status: "running" }];
  const controller = controllerFor(() => snapshot, calls);
  controller.update();
  await controller.flush();
  assert.equal(calls[0].payload.session_id, "active");
  assert.equal(calls.at(-1).event, "prompt-submit");
});

test("separate TUI environments keep independent bindings", async () => {
  const a = [];
  const b = [];
  const first = controllerFor(() => idle("surface-a"), a);
  const second = controllerFor(() => idle("surface-b"), b);
  first.update();
  second.update();
  await Promise.all([first.flush(), second.flush()]);
  assert.equal(a[0].payload.session_id, "surface-a");
  assert.equal(b[0].payload.session_id, "surface-b");
});

test("a selected session move starts again with its new cwd", async () => {
  const calls = [];
  let snapshot = idle("moved", "/before");
  const controller = controllerFor(() => snapshot, calls);
  controller.update();
  await controller.flush();
  snapshot = idle("moved", "/after");
  controller.update();
  await controller.flush();
  assert.deepEqual(calls.filter(({ event }) => event === "session-start").map(({ payload }) => payload.cwd), ["/before", "/after"]);
});

test("a busy selected family publishes prompt-submit", async () => {
  const calls = [];
  const controller = controllerFor(() => running("busy"), calls);
  controller.update();
  await controller.flush();
  assert.deepEqual(calls.map(({ event }) => event), ["session-start", "prompt-submit"]);
});

test("an idle family does not stop while another open family runs", async () => {
  const calls = [];
  const snapshot = idle("idle");
  snapshot.openFamilies.push({ id: "other", status: "running" });
  const controller = controllerFor(() => snapshot, calls);
  controller.update();
  await controller.flush();
  assert.equal(calls.at(-1).event, "prompt-submit");
});

test("deleted or archived selected metadata only ends its delivered binding", async () => {
  const calls = [];
  let snapshot = idle("keep");
  const controller = controllerFor(() => snapshot, calls);
  controller.update();
  await controller.flush();
  snapshot = idle("keep", "/work/keep", { archived: true });
  controller.update();
  await controller.flush();
  assert.deepEqual(calls.at(-1), {
    event: "session-end",
    payload: { session_id: "keep", cwd: "/work/keep", event: "route-change", hook_event_name: "SessionEnd" },
  });
});

test("teardown retains the persistent binding and unregisters wrapper callbacks", async () => {
  const calls = [];
  const controller = controllerFor(() => idle("kept"), calls);
  controller.update();
  await controller.flush();
  const unregistered = [];
  cleanupTUI({
    controller,
    sender: { dispose: () => unregistered.push("child") },
    disposers: [() => unregistered.push("slot"), () => unregistered.push("event"), () => unregistered.push("feed")],
  })();
  await controller.flush();
  assert.equal(calls.some(({ event }) => event === "session-end"), false);
  assert.deepEqual(controller.binding(), { id: "kept", cwd: "/work/kept" });
  assert.deepEqual(unregistered, ["child", "slot", "event", "feed"]);
});

test("rapid selection updates coalesce and hook delivery stays serial", async () => {
  const calls = [];
  let snapshot = idle("first");
  let release;
  const firstAdmission = new Promise((resolve) => { release = resolve; });
  let admissions = 0;
  const controller = createResumeController({
    getSnapshot: () => snapshot,
    sendHook: async (event, payload) => {
      calls.push(`${event}:${payload.session_id}`);
      admissions += 1;
      if (admissions === 1) await firstAdmission;
      return true;
    },
  });
  controller.update();
  await new Promise((resolve) => setImmediate(resolve));
  snapshot = idle("second");
  controller.update();
  snapshot = idle("third");
  controller.update();
  release();
  await controller.flush();
  assert.deepEqual(calls, ["session-start:first", "session-start:third", "stop:third"]);
});

test("cleanup after session-start admission prevents a follow-on lifecycle hook", async () => {
  const calls = [];
  let release;
  const admission = new Promise((resolve) => { release = resolve; });
  const controller = createResumeController({
    getSnapshot: () => idle("closing"),
    sendHook: async (event) => {
      calls.push(event);
      if (event === "session-start") await admission;
      return true;
    },
  });
  controller.update();
  await new Promise((resolve) => setImmediate(resolve));
  controller.dispose();
  release();
  await controller.flush();
  assert.deepEqual(calls, ["session-start"]);
});

test("session-start admission uses the current lifecycle after it settles", async () => {
  const calls = [];
  let snapshot = running("settling");
  let release;
  const admission = new Promise((resolve) => { release = resolve; });
  const controller = createResumeController({
    getSnapshot: () => snapshot,
    sendHook: async (event) => {
      calls.push(event);
      if (event === "session-start") await admission;
      return true;
    },
  });
  controller.update();
  await new Promise((resolve) => setImmediate(resolve));
  snapshot = idle("settling");
  release();
  await controller.flush();
  assert.deepEqual(calls, ["session-start", "stop"]);
});

test("failed admission is not delivered and retries on a later update", async () => {
  const calls = [];
  let attempt = 0;
  const errors = [];
  const controller = createResumeController({
    getSnapshot: () => idle("retry"),
    sendHook: async (event) => {
      calls.push(event);
      attempt += 1;
      return attempt > 1;
    },
    onError: (error) => errors.push(error),
  });
  controller.update();
  await controller.flush();
  controller.update();
  await controller.flush();
  assert.deepEqual(calls, ["session-start", "session-start", "stop"]);
  assert.equal(errors.length, 1);
});

test("native hook dispatcher receives session_id and the real TUI PID", async () => {
  const seen = [];
  let serialized;
  const child = {
    on() {},
    kill() {},
    stdin: { end(value) { serialized = JSON.parse(value); } },
  };
  const sender = createDispatchingSender({
    pid: 4242,
    environment: { CMUX_SURFACE_ID: "surface", CMUX_BUNDLED_CLI_PATH: "/cmux.app/cmux" },
    dispatchSessionHook: (event, payload, spawnImpl, environment) => {
      const spawned = spawnImpl("bin", ["x"], {});
      spawned.stdin.end(JSON.stringify(payload));
      seen.push({ event, payload, environment, spawned });
      return true;
    },
    spawnImpl: () => child,
    awaitClose: async (received) => received === child,
  });
  assert.equal(await sender("session-start", { session_id: "chat", cwd: "/work", event: "route", hook_event_name: "SessionStart" }), true);
  assert.deepEqual(serialized, { session_id: "chat", cwd: "/work", event: "route", hook_event_name: "SessionStart" });
  assert.equal(seen[0].environment.CMUX_OPENCODE_PID, "4242");
  assert.equal(seen[0].environment.CMUX_OPENCODE_CMUX_BIN, "/cmux.app/cmux");
});

test("sender cleanup cancels its owned child wait without ending a session", async () => {
  const child = new EventEmitter();
  let killed = 0;
  child.kill = () => { killed += 1; };
  const sender = createDispatchingSender({
    environment: { CMUX_SURFACE_ID: "surface" },
    dispatchSessionHook: (_event, _payload, spawnImpl) => {
      spawnImpl("cmux", [], {});
      return true;
    },
    spawnImpl: () => child,
  });
  const pending = sender("stop", { session_id: "chat", cwd: "/work", event: "route", hook_event_name: "Stop" });
  sender.dispose();
  assert.equal(await pending, false);
  assert.equal(killed, 1);
});
