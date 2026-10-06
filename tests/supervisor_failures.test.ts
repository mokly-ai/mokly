import assert from "node:assert/strict";
import test from "node:test";

import { ReadyProcessSupervisor } from "../packages/mokly/dist/server/supervisor.js";

import {
  ControlledChildFactory,
  settle,
  settlement,
} from "./helpers/supervised_child.js";

const timings = { gracefulMilliseconds: 10, terminateMilliseconds: 10 };

for (const failure of [
  "readiness-timeout",
  "pre-ready-error",
  "post-ready-error",
] as const) {
  test(`${failure} retains ownership until bounded cleanup confirms exit`, async (context) => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    const factory = new ControlledChildFactory();
    context.after(() => factory.finish());
    const supervisor = new ReadyProcessSupervisor(
      factory,
      ["__serve-child"],
      0,
      timings,
    );
    const failures: Error[] = [];
    supervisor.onUnexpectedExit((error) => failures.push(error));
    const starting = supervisor.start();
    const started = settlement(starting);
    const child = factory.children[0]!;
    if (failure === "post-ready-error") {
      child.ready();
      await starting;
    }
    if (failure === "readiness-timeout") {
      context.mock.timers.tick(299_999);
      await settle();
      assert.deepEqual(
        child.messages,
        [],
        "startup must remain active throughout the five-minute allowance",
      );
      context.mock.timers.tick(1);
    } else child.fail();
    await settle();

    const closing = supervisor.close();
    const closed = settlement(closing);
    await settle();
    assert.equal(
      closed.status,
      "pending",
      "close must await the failed child's exit",
    );
    if (failure !== "post-ready-error") assert.equal(started.status, "pending");
    assert.deepEqual(child.messages, [{ type: "shutdown" }]);
    context.mock.timers.tick(10);
    assert.equal(child.terminations, 1);
    context.mock.timers.tick(10);
    assert.equal(child.forceKills, 1);
    await settle();
    assert.equal(
      closed.status,
      "pending",
      "SIGKILL is not an exit acknowledgement",
    );

    const blocked = supervisor.start();
    settlement(blocked);
    await settle();
    assert.equal(
      factory.children.length,
      1,
      "do not replace a child still being cleaned up",
    );
    await assert.rejects(blocked, /already running/);
    child.exit(17);
    await closing;
    if (failure !== "post-ready-error")
      await assert.rejects(
        starting,
        failure === "readiness-timeout"
          ? /readiness timed out/
          : /child transport failed/,
      );
    assert.equal(failures.length, failure === "post-ready-error" ? 1 : 0);

    const replacement = supervisor.start();
    factory.children[1]!.ready();
    assert.equal(await replacement, 48123);
    assert.equal(
      factory.arguments_[1]!.includes("--strict-port"),
      failure === "post-ready-error",
    );
    const stopped = supervisor.close();
    factory.children[1]!.exit(0);
    await stopped;
  });
}

test("an exit before readiness never waits for a second exit or signals an exited child", async (context) => {
  const factory = new ControlledChildFactory();
  factory.alreadyExited = true;
  const supervisor = new ReadyProcessSupervisor(factory, [], 0, timings);
  const starting = supervisor.start();
  const state = settlement(starting);
  context.after(() => factory.finish());
  await settle();
  assert.equal(state.status, "rejected");
  await assert.rejects(starting, /exited before readiness/);
  await supervisor.close();
  assert.deepEqual(factory.children[0]!.messages, []);
  assert.equal(factory.children[0]!.terminations, 0);
});

test("a same-turn ready/error race rejects startup only after the child exits", async (context) => {
  const factory = new ControlledChildFactory();
  context.after(() => factory.finish());
  const supervisor = new ReadyProcessSupervisor(factory, [], 0, timings);
  const starting = supervisor.start();
  const state = settlement(starting);
  const child = factory.children[0]!;
  child.ready();
  child.fail();
  await settle();
  assert.equal(state.status, "pending");
  assert.deepEqual(child.messages, [{ type: "shutdown" }]);
  child.exit(0);
  await assert.rejects(starting, /child transport failed/);
  await supervisor.close();
});
