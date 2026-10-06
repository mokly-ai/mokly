import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout } from "node:timers/promises";

import { NodeBaselineProcessRunner } from "../packages/mokly/dist/baseline/process.js";

import { windowsProcessFixture } from "./helpers/windows_process.js";

test("Windows cancellation drains descendants even after their launcher exits", async (t) => {
  const fixture = windowsProcessFixture(t);
  const controller = new AbortController();
  const reason = new Error("stop baseline");
  const pending = new NodeBaselineProcessRunner().run({
    argv: ["node.exe", "build.js"],
    cwd: "C:\\source",
    env: {},
    signal: controller.signal,
  });
  const outcome = pending.then(
    () => "completed",
    (error: unknown) => error,
  );
  await fixture.waitForEvent("release");
  fixture.exitLauncher();
  controller.abort(reason);
  assert.equal(await Promise.race([outcome, setTimeout(1200, "hung")]), reason);
  assert.ok(fixture.events.includes("terminate-tree"));
  assert.ok(fixture.events.includes("query"));
  assert.ok(fixture.events.includes("close-job"));
});

test("Windows commands cannot start before kill-on-close job ownership is established", async (t) => {
  const fixture = windowsProcessFixture(t);
  const pending = new NodeBaselineProcessRunner().run({
    argv: ["node.exe", "build.js"],
    cwd: "C:\\source",
    env: {},
  });
  await fixture.waitForEvent("release");
  fixture.close();
  await pending;
  assert.ok(fixture.events.includes("limits:8192"));
  assert.ok(fixture.events.indexOf("assign") > fixture.events.indexOf("spawn"));
  assert.ok(
    fixture.events.indexOf("release") > fixture.events.indexOf("assign"),
  );
});

test("unavailable Windows job ownership fails before launching a build", async (t) => {
  const fixture = windowsProcessFixture(t);
  fixture.failConfiguration();
  const pending = new NodeBaselineProcessRunner().run({
    argv: ["node.exe", "build.js"],
    cwd: "C:\\source",
    env: {},
  });
  await assert.rejects(pending, /Windows.*job|SetInformationJobObject/i);
  assert.ok(!fixture.events.includes("spawn"));
  assert.ok(fixture.events.includes("close-job"));
});

test("failed Windows job assignment drains the unopened worker without releasing the command", async (t) => {
  const fixture = windowsProcessFixture(t);
  fixture.failAssignment();
  await assert.rejects(
    new NodeBaselineProcessRunner().run({
      argv: ["node.exe", "build.js"],
      cwd: "C:\\source",
      env: {},
    }),
    /AssignProcessToJobObject/,
  );
  assert.ok(!fixture.events.includes("release"));
  assert.ok(fixture.events.includes("kill-child"));
  assert.ok(fixture.events.includes("close-process"));
  assert.ok(fixture.events.includes("close-job"));
});

test("reentrant process errors cannot start a second cancellation sequence", async (t) => {
  const fixture = windowsProcessFixture(t);
  const controller = new AbortController();
  const kill = fixture.child.kill.bind(fixture.child);
  let emitted = false;
  t.mock.method(fixture.child, "kill", () => {
    kill();
    if (!emitted) {
      emitted = true;
      fixture.child.exitCode = null;
      fixture.child.emit("error", new Error("termination failed"));
    }
    return true;
  });
  const pending = new NodeBaselineProcessRunner().run({
    argv: ["node.exe", "build.js"],
    cwd: "C:\\source",
    env: {},
    signal: controller.signal,
  });
  const rejected = assert.rejects(pending, { name: "AbortError" });
  await fixture.waitForEvent("release");
  controller.abort();
  assert.equal(
    fixture.events.filter((event) => event === "kill-child").length,
    1,
  );
  await rejected;
});

test("Windows disposal waits for all job processes after command pipes close", async (t) => {
  const fixture = windowsProcessFixture(t);
  fixture.holdDrain(2);
  const pending = new NodeBaselineProcessRunner().run({
    argv: ["node.exe", "build.js"],
    cwd: "C:\\source",
    env: {},
  });
  await fixture.waitForEvent("release");
  fixture.close();
  assert.ok(!fixture.events.includes("close-job"));
  await pending;
  assert.equal(fixture.events.filter((event) => event === "query").length, 3);
  assert.equal(fixture.events.at(-1), "close-job");
});

test("failed Windows job termination still closes the kill-on-close handle", async (t) => {
  const fixture = windowsProcessFixture(t);
  fixture.failTermination();
  const controller = new AbortController();
  const pending = new NodeBaselineProcessRunner().run({
    argv: ["node.exe", "build.js"],
    cwd: "C:\\source",
    env: {},
    signal: controller.signal,
  });
  const rejected = assert.rejects(pending, { name: "AbortError" });
  await fixture.waitForEvent("release");
  controller.abort();
  await rejected;
  assert.equal(
    fixture.events.filter((event) => event === "close-job").length,
    1,
  );
});
