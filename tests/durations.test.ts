import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import test from "node:test";

import { reportDuration, startDuration } from "./helpers/durations.js";

test("duration text is a string with one decimal place and a millisecond suffix", (context) => {
  const reads = [1_000, 2_423.75];
  const clock = context.mock.method(performance, "now", () => reads.shift());
  const duration = startDuration();
  const text = duration();
  assert.equal(typeof text, "string");
  assert.equal(text, "1423.8 ms");
  assert.equal(clock.mock.callCount(), 2);
});

test("duration text includes the start of its own observation window", (context) => {
  const reads = [10, 20, 21, 23];
  context.mock.method(performance, "now", () => reads.shift());
  const first = startDuration();
  const second = startDuration();
  assert.equal(first(), "11.0 ms");
  assert.equal(second(), "3.0 ms");
});

for (const asynchronous of [false, true]) {
  test(`reports once and returns a ${asynchronous ? "async" : "sync"} callback's result`, async (context) => {
    const reads = [100, 1_523.75];
    const clock = context.mock.method(performance, "now", () => reads.shift());
    const reports: string[] = [];
    const result = { value: "callback result" };
    let calls = 0;
    const observed = await reportDuration(
      "20,000-file collection",
      (text) => reports.push(text),
      () => {
        calls += 1;
        return asynchronous ? Promise.resolve(result) : result;
      },
    );
    assert.equal(observed, result);
    assert.equal(calls, 1);
    assert.deepEqual(reports, ["20,000-file collection: 1423.8 ms"]);
    assert.equal(clock.mock.callCount(), 2);
  });
}

test("reports through the test context's diagnostic method and returns the callback result", async (context) => {
  context.mock.method(performance, "now", () => 10);
  const result = { value: "callback result" };
  const observed = await reportDuration(
    "context diagnostic",
    (text) => context.diagnostic(text),
    () => result,
  );
  assert.equal(observed, result);
});

test("reports an async callback only after it settles", async (context) => {
  const reads = [0, 4];
  context.mock.method(performance, "now", () => reads.shift());
  const events: string[] = [];
  let resolveResult: (value: string) => void = () =>
    assert.fail("callback did not start");
  const observed = reportDuration(
    "readiness",
    (text) => events.push(text),
    () =>
      new Promise<string>((resolve) => {
        events.push("started");
        resolveResult = resolve;
      }),
  );
  assert.deepEqual(events, ["started"]);
  await Promise.resolve();
  assert.deepEqual(events, ["started"]);
  resolveResult("ready");
  assert.equal(await observed, "ready");
  assert.deepEqual(events, ["started", "readiness: 4.0 ms"]);
});

for (const failure of [
  new Error("callback failed"),
  { message: "object failure" },
  undefined,
]) {
  for (const asynchronous of [false, true]) {
    test(`reports once and preserves ${String(failure)} after a ${asynchronous ? "rejection" : "throw"}`, async (context) => {
      const reads = [0, 2.25];
      const clock = context.mock.method(performance, "now", () =>
        reads.shift(),
      );
      const reports: string[] = [];
      await assert.rejects(
        reportDuration(
          "failed operation",
          (text) => reports.push(text),
          () => {
            if (asynchronous) return Promise.reject(failure);
            throw failure;
          },
        ),
        (error) => error === failure,
      );
      assert.deepEqual(reports, ["failed operation: 2.3 ms"]);
      assert.equal(clock.mock.callCount(), 2);
    });
  }
}

test("keeps the callback's failure when its reporter also throws", async (context) => {
  const reads = [0, 1];
  context.mock.method(performance, "now", () => reads.shift());
  const failure = new Error("callback failed");
  let reports = 0;
  await assert.rejects(
    reportDuration(
      "failed operation",
      () => {
        reports += 1;
        throw new Error("reporter failed");
      },
      () => {
        throw failure;
      },
    ),
    (error) => error === failure,
  );
  assert.equal(reports, 1);
});

test("duration text can join a count annotation without exposing a number", (context) => {
  const reads = [0, 12];
  context.mock.method(performance, "now", () => reads.shift());
  const duration = startDuration();
  const annotations = [
    { type: "evidence", description: `4 cases; ${duration()}` },
  ];
  assert.deepEqual(annotations, [
    { type: "evidence", description: "4 cases; 12.0 ms" },
  ]);
});
