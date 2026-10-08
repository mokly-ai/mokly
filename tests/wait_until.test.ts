import assert from "node:assert/strict";
import test from "node:test";

import { waitUntil, type WaitUntilOptions } from "./helpers/wait_until.js";

async function settle(): Promise<void> {
  for (let turn = 0; turn < 8; turn++) await Promise.resolve();
}

function settlement(promise: Promise<unknown>) {
  const state = { status: "pending" };
  void promise.then(
    () => {
      state.status = "resolved";
    },
    () => {
      state.status = "rejected";
    },
  );
  return state;
}

test("returns a narrowed value from the first probe before any pause", async (context) => {
  context.mock.timers.enable({ apis: ["Date", "setTimeout"] });
  const expected = { path: "ready" };
  const probe = context.mock.fn(
    (): typeof expected | undefined | null | false => expected,
  );
  const options: WaitUntilOptions = {};
  const waiting: Promise<typeof expected> = waitUntil(probe, options);
  settlement(waiting);
  assert.equal(probe.mock.callCount(), 1);
  assert.equal(await waiting, expected);
});

test("narrows a boolean probe to true", async (context) => {
  context.mock.timers.enable({ apis: ["Date", "setTimeout"] });
  const probe = context.mock.fn((): boolean => true);
  const result: true = await waitUntil(probe);
  assert.equal(result, true);
  assert.equal(probe.mock.callCount(), 1);
});

for (const value of [0, ""] as const) {
  test(`returns the value ${JSON.stringify(value)} without treating it as absent`, async (context) => {
    context.mock.timers.enable({ apis: ["Date", "setTimeout"] });
    assert.equal(await waitUntil(() => value), value);
  });
}

for (const absent of [undefined, null, false] as const) {
  test(`polls again after ${String(absent)} with the default 10 ms interval`, async (context) => {
    context.mock.timers.enable({ apis: ["Date", "setTimeout"] });
    const values: (string | undefined | null | false)[] = [absent, "ready"];
    const probe = context.mock.fn(() => values.shift());
    const waiting: Promise<string> = waitUntil(probe);
    settlement(waiting);
    await settle();
    assert.equal(probe.mock.callCount(), 1);
    context.mock.timers.tick(9);
    await settle();
    assert.equal(probe.mock.callCount(), 1);
    context.mock.timers.tick(1);
    await settle();
    assert.equal(probe.mock.callCount(), 2);
    assert.equal(await waiting, "ready");
  });
}

test("awaits an async probe and returns its narrowed value", async (context) => {
  context.mock.timers.enable({ apis: ["Date", "setTimeout"] });
  const values: (string | false)[] = [false, "ready"];
  const probe = context.mock.fn(async () => {
    await Promise.resolve();
    return values.shift();
  });
  const waiting: Promise<string> = waitUntil(probe);
  settlement(waiting);
  await settle();
  assert.equal(probe.mock.callCount(), 1);
  context.mock.timers.tick(10);
  await settle();
  assert.equal(probe.mock.callCount(), 2);
  assert.equal(await waiting, "ready");
});

test("accepts a PromiseLike probe and returns its narrowed value", async (context) => {
  context.mock.timers.enable({ apis: ["Date", "setTimeout"] });
  const values = [false, "ready"];
  const probe = context.mock.fn(
    (): PromiseLike<string | boolean | undefined> => ({
      then(onfulfilled, onrejected) {
        return Promise.resolve(values.shift()).then(onfulfilled, onrejected);
      },
    }),
  );
  const waiting: Promise<string | true> = waitUntil(probe);
  settlement(waiting);
  await settle();
  assert.equal(probe.mock.callCount(), 1);
  context.mock.timers.tick(10);
  await settle();
  assert.equal(await waiting, "ready");
  assert.equal(probe.mock.callCount(), 2);
});

test("rethrows a synchronous probe failure unchanged without retrying", async (context) => {
  context.mock.timers.enable({ apis: ["Date", "setTimeout"] });
  const failure = { message: "probe failed" };
  const probe = context.mock.fn(() => {
    throw failure;
  });
  await assert.rejects(waitUntil(probe), (error) => error === failure);
  context.mock.timers.tick(15_000);
  await settle();
  assert.equal(probe.mock.callCount(), 1);
});

test("rethrows an async probe failure unchanged without retrying", async (context) => {
  context.mock.timers.enable({ apis: ["Date", "setTimeout"] });
  const failure = new Error("async probe failed");
  const probe = context.mock.fn(async () => {
    throw failure;
  });
  await assert.rejects(waitUntil(probe), (error) => error === failure);
  context.mock.timers.tick(15_000);
  await settle();
  assert.equal(probe.mock.callCount(), 1);
});

for (const message of [undefined, "catalogue did not become ready", ""]) {
  test(`rejects at the deadline with ${message === undefined ? "the default error" : `message ${JSON.stringify(message)}`}`, async (context) => {
    context.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 5_000 });
    const probe = context.mock.fn(() => undefined);
    const waiting = waitUntil(probe, {
      timeoutMs: 10_000,
      intervalMs: 10_000,
      ...(message === undefined ? {} : { message }),
    });
    const state = settlement(waiting);
    await settle();
    context.mock.timers.tick(9_999);
    await settle();
    assert.equal(state.status, "pending");
    assert.equal(probe.mock.callCount(), 1);
    context.mock.timers.tick(1);
    await assert.rejects(waiting, {
      name: "Error",
      message: message ?? /10000 ms/u,
    });
    assert.equal(state.status, "rejected");
    assert.equal(probe.mock.callCount(), 2);
  });
}

test("uses the default 15,000 ms deadline", async (context) => {
  context.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 5_000 });
  const probe = context.mock.fn(() => false);
  const waiting = waitUntil(probe, { intervalMs: 15_000 });
  const state = settlement(waiting);
  await settle();
  context.mock.timers.tick(14_999);
  await settle();
  assert.equal(state.status, "pending");
  assert.equal(probe.mock.callCount(), 1);
  context.mock.timers.tick(1);
  await assert.rejects(waiting, { name: "Error", message: /15000 ms/u });
  assert.equal(state.status, "rejected");
  assert.equal(probe.mock.callCount(), 2);
});

test("calls the message function once at timeout and uses its latest text", async (context) => {
  context.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 0 });
  let probes = 0;
  const calledAt: number[] = [];
  const message = context.mock.fn(() => {
    calledAt.push(Date.now());
    return `catalogue did not become ready after ${probes} probes`;
  });
  const waiting = waitUntil(
    () => {
      probes++;
      return false;
    },
    {
      timeoutMs: 10_000,
      intervalMs: 5_000,
      message,
    },
  );
  const state = settlement(waiting);
  await settle();
  assert.equal(message.mock.callCount(), 0);
  context.mock.timers.tick(5_000);
  await settle();
  assert.equal(probes, 2);
  assert.equal(message.mock.callCount(), 0);
  context.mock.timers.tick(4_999);
  await settle();
  assert.equal(state.status, "pending");
  assert.equal(message.mock.callCount(), 0);
  context.mock.timers.tick(1);
  await assert.rejects(waiting, {
    name: "Error",
    message: "catalogue did not become ready after 3 probes",
  });
  assert.equal(message.mock.callCount(), 1);
  assert.deepEqual(calledAt, [10_000]);
  context.mock.timers.tick(10_000);
  await settle();
  assert.equal(message.mock.callCount(), 1);
});

for (const delayed of [false, true]) {
  test(`does not call the message function for ${delayed ? "deadline" : "immediate"} probe success`, async (context) => {
    context.mock.timers.enable({ apis: ["Date", "setTimeout"] });
    let ready = !delayed;
    const message = context.mock.fn(() => "unused timeout message");
    const waiting = waitUntil(() => ready, {
      timeoutMs: 10_000,
      intervalMs: 10_000,
      message,
    });
    settlement(waiting);
    await settle();
    assert.equal(message.mock.callCount(), 0);
    if (delayed) {
      ready = true;
      context.mock.timers.tick(10_000);
    }
    assert.equal(await waiting, true);
    context.mock.timers.tick(10_000);
    await settle();
    assert.equal(message.mock.callCount(), 0);
  });
}

for (const timeoutMs of [-1, 0, 9_999]) {
  test(`rejects timeoutMs ${timeoutMs} with RangeError before the first probe`, async (context) => {
    context.mock.timers.enable({ apis: ["Date", "setTimeout"] });
    const probe = context.mock.fn(() => "ready");
    await assert.rejects(waitUntil(probe, { timeoutMs }), RangeError);
    assert.equal(probe.mock.callCount(), 0);
  });
}

test("probes once per interval and stops after the first value", async (context) => {
  context.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000 });
  const calls: number[] = [];
  const waiting = waitUntil(
    () => {
      calls.push(Date.now());
      return calls.length === 4 ? "ready" : undefined;
    },
    { intervalMs: 25 },
  );
  settlement(waiting);
  await settle();
  assert.deepEqual(calls, [1_000]);
  for (let index = 1; index < 4; index++) {
    context.mock.timers.tick(24);
    await settle();
    assert.equal(calls.length, index);
    context.mock.timers.tick(1);
    await settle();
    assert.equal(calls.length, index + 1);
  }
  assert.equal(await waiting, "ready");
  assert.deepEqual(calls, [1_000, 1_025, 1_050, 1_075]);
  context.mock.timers.tick(15_000);
  await settle();
  assert.equal(calls.length, 4);
});

for (const intervalMs of [10_000, 11_000]) {
  test(`accepts a result from the probe after a ${intervalMs} ms pause at or after the deadline`, async (context) => {
    context.mock.timers.enable({ apis: ["Date", "setTimeout"] });
    const values = [undefined, "ready"];
    const probe = context.mock.fn(() => values.shift());
    const waiting = waitUntil(probe, { timeoutMs: 10_000, intervalMs });
    settlement(waiting);
    await settle();
    context.mock.timers.tick(intervalMs);
    await settle();
    assert.equal(await waiting, "ready");
    assert.equal(probe.mock.callCount(), 2);
  });
}
