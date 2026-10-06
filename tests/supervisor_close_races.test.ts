import assert from "node:assert/strict";
import test from "node:test";

import { ReadyProcessSupervisor } from "../packages/mokly/dist/server/supervisor.js";

import {
  ControlledChildFactory,
  settle,
  settlement,
} from "./helpers/supervised_child.js";

const timings = { gracefulMilliseconds: 10, terminateMilliseconds: 10 };

test("concurrent close and restart share cleanup and spawn only after exit", async (context) => {
  const factory = new ControlledChildFactory();
  context.after(() => factory.finish());
  const supervisor = new ReadyProcessSupervisor(factory, [], 0, timings);
  const failures: Error[] = [];
  supervisor.onUnexpectedExit((error) => failures.push(error));
  const starting = supervisor.start();
  const first = factory.children[0]!;
  first.ready();
  await starting;
  const firstClose = supervisor.close();
  const secondClose = supervisor.close();
  const closed = settlement(secondClose);
  const restarting = supervisor.restart();
  settlement(restarting);
  await settle();
  assert.equal(closed.status, "pending");
  assert.equal(factory.children.length, 1);
  assert.deepEqual(first.messages, [{ type: "shutdown" }]);

  first.exit(0);
  await Promise.all([firstClose, secondClose]);
  await settle();
  assert.equal(factory.children.length, 2);
  assert.ok(factory.arguments_[1]!.includes("--strict-port"));
  factory.children[1]!.ready();
  await restarting;
  first.fail();
  assert.deepEqual(failures, []);
  const closing = supervisor.close();
  factory.children[1]!.exit(0);
  await closing;
});

test("close cancels readiness and a late ready message cannot turn startup into success", async (context) => {
  const factory = new ControlledChildFactory();
  context.after(() => factory.finish());
  const supervisor = new ReadyProcessSupervisor(factory, [], 0, timings);
  const starting = supervisor.start();
  const started = settlement(starting);
  const closing = supervisor.close();
  factory.children[0]!.ready();
  await settle();
  assert.equal(started.status, "pending");
  factory.children[0]!.exit(0);
  await closing;
  await assert.rejects(starting, /closed before readiness/);
});

test("a failed graceful send still escalates and waits for confirmed exit", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const factory = new ControlledChildFactory();
  context.after(() => factory.finish());
  const supervisor = new ReadyProcessSupervisor(factory, [], 0, timings);
  const starting = supervisor.start();
  const child = factory.children[0]!;
  child.ready();
  await starting;
  child.throwOnSend = true;
  const closing = supervisor.close();
  const state = settlement(closing);
  await settle();
  assert.equal(state.status, "pending");
  context.mock.timers.tick(10);
  assert.equal(child.terminations, 1);
  context.mock.timers.tick(10);
  assert.equal(child.forceKills, 1);
  child.exit(0);
  await closing;
});

test("synchronous graceful exit cancels every escalation timer", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const factory = new ControlledChildFactory();
  const supervisor = new ReadyProcessSupervisor(factory, [], 0, timings);
  const starting = supervisor.start();
  const child = factory.children[0]!;
  child.ready();
  await starting;
  child.exitOnShutdown = true;
  await supervisor.close();
  context.mock.timers.tick(10000);
  assert.equal(child.terminations, 0);
  assert.equal(child.forceKills, 0);
});
