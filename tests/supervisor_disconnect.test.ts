import assert from "node:assert/strict";
import test from "node:test";

import { ReadyProcessSupervisor } from "../packages/mokly/dist/server/supervisor.js";

import {
  ControlledChildFactory,
  settle,
  settlement,
} from "./helpers/supervised_child.js";

const timings = { gracefulMilliseconds: 10, terminateMilliseconds: 10 };

for (const phase of ["waiting", "ready"] as const) {
  test(`IPC disconnect while ${phase} starts cleanup without another update`, async (context) => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    const factory = new ControlledChildFactory();
    context.after(() => factory.finish());
    const supervisor = new ReadyProcessSupervisor(factory, [], 0, timings);
    const failures: Error[] = [];
    supervisor.onUnexpectedExit((error) => failures.push(error));
    const starting = supervisor.start();
    const started = settlement(starting);
    const child = factory.children[0]!;
    if (phase === "ready") {
      child.ready();
      await starting;
    }

    child.disconnect();
    await settle();
    assert.deepEqual(child.messages, [{ type: "shutdown" }]);
    assert.equal(failures.length, phase === "ready" ? 1 : 0);
    if (phase === "ready")
      assert.match(failures[0]!.message, /IPC disconnected/);
    else assert.equal(started.status, "pending");
    child.ready();
    supervisor.notifyUpdate(["home"]);
    assert.deepEqual(child.messages, [{ type: "shutdown" }]);
    const closing = supervisor.close();
    const closed = settlement(closing);
    context.mock.timers.tick(10);
    assert.equal(child.terminations, 1);
    context.mock.timers.tick(10);
    assert.equal(child.forceKills, 1);
    await settle();
    assert.equal(closed.status, "pending");
    await assert.rejects(supervisor.start(), /already running/);
    assert.equal(factory.children.length, 1);

    child.fail();
    child.exit(17);
    await closing;
    if (phase === "waiting") await assert.rejects(starting, /IPC disconnected/);
    assert.equal(failures.length, phase === "ready" ? 1 : 0);
    const restarting = supervisor.start();
    factory.children[1]!.ready();
    assert.equal(await restarting, 48123);
    assert.equal(
      factory.arguments_[1]!.includes("--strict-port"),
      phase === "ready",
    );
    factory.children[1]!.exitOnShutdown = true;
    await supervisor.close();
  });
}

test("an already-disconnected child replays transport loss during startup", async (context) => {
  const factory = new ControlledChildFactory();
  factory.alreadyDisconnected = true;
  context.after(() => factory.finish());
  const supervisor = new ReadyProcessSupervisor(factory, [], 0, timings);
  const starting = supervisor.start();
  const started = settlement(starting);
  await settle();
  assert.deepEqual(factory.children[0]!.messages, [{ type: "shutdown" }]);
  assert.equal(started.status, "pending");
  factory.children[0]!.exit(17);
  await assert.rejects(starting, /IPC disconnected/);
});

test("same-turn readiness and disconnect cannot report startup success", async (context) => {
  const factory = new ControlledChildFactory();
  context.after(() => factory.finish());
  const supervisor = new ReadyProcessSupervisor(factory, [], 0, timings);
  const failures: Error[] = [];
  supervisor.onUnexpectedExit((error) => failures.push(error));
  const starting = supervisor.start();
  const started = settlement(starting);
  const child = factory.children[0]!;
  child.ready();
  child.disconnect();
  await settle();
  assert.equal(started.status, "pending");
  child.exit(0);
  await assert.rejects(starting, /IPC disconnected/);
  assert.deepEqual(failures, []);
});

test("intentional and late disconnects never report an unexpected failure", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const factory = new ControlledChildFactory();
  context.after(() => factory.finish());
  const supervisor = new ReadyProcessSupervisor(factory, [], 0, timings);
  const failures: Error[] = [];
  supervisor.onUnexpectedExit((error) => failures.push(error));
  const starting = supervisor.start();
  const child = factory.children[0]!;
  child.ready();
  await starting;
  child.disconnectOnShutdown = true;
  const closing = supervisor.close();
  const closed = settlement(closing);
  await settle();
  assert.equal(closed.status, "pending");
  assert.deepEqual(failures, []);
  child.exit(0);
  await closing;
  context.mock.timers.tick(20_000);
  assert.equal(child.terminations, 0);
  assert.equal(child.forceKills, 0);

  const replacement = supervisor.start();
  const next = factory.children[1]!;
  next.ready();
  await replacement;
  next.exitOnShutdown = true;
  await supervisor.close();
  next.disconnect();
  assert.deepEqual(failures, []);
});

test("disconnect during failed startup preserves the first diagnostic", async (context) => {
  const factory = new ControlledChildFactory();
  context.after(() => factory.finish());
  const supervisor = new ReadyProcessSupervisor(factory, [], 0, timings);
  const starting = supervisor.start();
  settlement(starting);
  factory.children[0]!.fail();
  factory.children[0]!.disconnect();
  factory.children[0]!.exit(17);
  await assert.rejects(starting, /child transport failed/);
});
