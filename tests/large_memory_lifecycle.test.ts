import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";

import { lifetime } from "../scripts/large/lifetime.js";
import type { ChildState } from "../scripts/large/lifetime.js";
import type { MemorySystem } from "../scripts/large/memory.js";
import { monitorChild } from "../scripts/large/memory_lifecycle.js";

function fixture(ps: () => Promise<string>) {
  const child: EventEmitter & ChildState = Object.assign(new EventEmitter(), {
    pid: 20,
    exitCode: null,
    signalCode: null,
  });
  const events: string[] = [];
  let nativeAlive = true,
    cancelled = false,
    tick = () => {};
  const owned = lifetime(child, {
    pid: 10,
    kill: (pid, signal) => {
      assert.equal(pid, -20);
      assert.equal(signal, "SIGKILL");
      assert.equal(child.signalCode, null);
      events.push("group");
      nativeAlive = false;
    },
    onExit: () => () => {},
  });
  const boundary: MemorySystem = {
    pid: 10,
    ps,
    kill: (pid, signal) => {
      assert.equal(signal, "SIGKILL");
      assert.ok(pid > 1 && pid !== 10);
      assert.equal(
        nativeAlive,
        false,
        "the core's group must stop before its shim is killed",
      );
      events.push(`pid:${pid}`);
    },
    every: (callback) => {
      tick = callback;
      return () => {
        cancelled = true;
      };
    },
  };
  return {
    child,
    owned,
    events,
    boundary,
    tick: () => tick(),
    cancelled: () => cancelled,
  };
}

test("failed sampling kills the live owned group before its shim", async () => {
  const fake = fixture(async () => {
    throw new Error("ps failed");
  });
  const errors: string[] = [];
  const finish = monitorChild(
    fake.child,
    fake.owned.kill,
    (error) => {
      errors.push(error);
    },
    500,
    fake.boundary,
  );
  await Promise.resolve();
  await finish();
  assert.deepEqual(fake.events, ["group", "pid:20"]);
  assert.match(errors[0]!, /ps failed/);
  assert.equal(fake.cancelled(), true);
});

test("memory stop kills the group before detached sidecars", async () => {
  const fake = fixture(
    async () =>
      "10 0 10 100\n20 10 20 100\n21 20 20 200\n30 21 30 300\n99 0 99 9000",
  );
  const finish = monitorChild(
    fake.child,
    fake.owned.kill,
    () => {},
    500,
    fake.boundary,
  );
  await Promise.resolve();
  await finish();
  assert.deepEqual(fake.events, ["group", "pid:30", "pid:21", "pid:20"]);
});

for (const failed of [false, true]) {
  test(`child exit cancels an in-flight ${failed ? "failed" : "successful"} sample without stale signals`, async () => {
    let resolve: (value: string) => void = () => {};
    let reject: (error: Error) => void = () => {};
    let reads = 0;
    const pending = new Promise<string>((accept, fail) => {
      resolve = accept;
      reject = fail;
    });
    const fake = fixture(() => {
      reads++;
      return pending;
    });
    const finish = monitorChild(
      fake.child,
      fake.owned.kill,
      () => assert.fail("late monitor failure"),
      1,
      fake.boundary,
    );
    fake.child.exitCode = 0;
    fake.child.emit("exit");
    assert.equal(fake.cancelled(), true);
    if (failed) reject(new Error("late ps failure"));
    else resolve("10 0 10 100\n20 10 20 99999");
    await finish();
    fake.tick();
    assert.equal(reads, 1);
    assert.deepEqual(fake.events, []);
  });
}
