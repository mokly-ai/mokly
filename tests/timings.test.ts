import assert from "node:assert/strict";
import test from "node:test";

import { parseArguments } from "../packages/mokly/dist/cli/arguments.js";
import {
  bindTimings,
  runWithTimings,
  timeAsync,
  timeSync,
  timingCounts,
  type TimingEvent,
} from "../packages/mokly/dist/diagnostics/timings.js";

test("debug timings is an opt-in common CLI flag", () => {
  assert.equal(parseArguments([]).debugTimings, undefined);
  for (const command of ["serve", "build", "check", "__serve-child"])
    assert.equal(
      parseArguments([command, "--debug-timings"]).debugTimings,
      true,
    );
  assert.equal(
    parseArguments(["export", "--out", "site", "--debug-timings"]).debugTimings,
    true,
  );
  assert.throws(
    () => parseArguments(["--debug-timings", "true"]),
    /unknown option/,
  );
});

test("disabled timing performs no clock, sink, or count work", async () => {
  const unexpected = () => {
    throw new Error("Disabled diagnostics ran");
  };
  await runWithTimings(
    false,
    "test",
    async () => {
      assert.equal(
        timeSync("sync", () => 7),
        7,
      );
      assert.equal(await timeAsync("async", async () => 9), 9);
      timingCounts("catalogue", unexpected);
    },
    { clock: unexpected, write: unexpected },
  );
});

test("a failed diagnostic sink does not change command success or failure", async () => {
  const failure = new Error("Original operation failed");
  await runWithTimings(
    true,
    "test",
    async () => {
      assert.equal(
        timeSync("success", () => 1),
        1,
      );
      await assert.rejects(
        timeAsync("failure", async () => {
          throw failure;
        }),
        (error) => error === failure,
      );
    },
    {
      write: () => {
        throw new Error("Sink unavailable");
      },
    },
  );
});

test("nested spans retain parentage, elapsed time, counts, and failure without error data", async () => {
  let clock = 0;
  const events: TimingEvent[] = [];
  const failure = new Error("private consumer contents");
  await runWithTimings(
    true,
    "test",
    async () => {
      await timeAsync("outer", async () => {
        clock = 5;
        timeSync("inner", () => {
          clock = 8;
          return 1;
        });
        timingCounts("catalogue", () => ({ entries: 12 }));
        await assert.rejects(
          timeAsync("failure", async () => {
            throw failure;
          }),
          (error) => error === failure,
        );
        assert.throws(
          () =>
            timeSync("sync-failure", () => {
              throw failure;
            }),
          (error) => error === failure,
        );
        clock = 10;
      });
    },
    { clock: () => clock, write: (event) => events.push(event) },
  );
  const ends = events.filter((event) => event.event === "end");
  assert.equal(ends.find((event) => event.stage === "inner")?.durationMs, 3);
  assert.equal(ends.find((event) => event.stage === "outer")?.durationMs, 10);
  assert.equal(
    ends.find((event) => event.stage === "inner")?.parentId,
    events[0]!.id,
  );
  assert.equal(
    ends.find((event) => event.stage === "failure")?.status,
    "error",
  );
  assert.deepEqual(events.find((event) => event.event === "counts")?.counts, {
    entries: 12,
  });
  assert.doesNotMatch(JSON.stringify(events), /private consumer/);
});

test("concurrent sessions and later watcher callbacks retain isolated diagnostic sinks", async () => {
  const a: TimingEvent[] = [];
  const b: TimingEvent[] = [];
  let callback = () => {};
  await Promise.all([
    runWithTimings(
      true,
      "a",
      async () => {
        callback = bindTimings(() => timeSync("watch.rebuild", () => 0));
        await timeAsync("a.build", async () => {
          await Promise.resolve();
        });
      },
      { write: (event) => a.push(event) },
    ),
    runWithTimings(
      true,
      "b",
      async () => {
        await timeAsync("b.build", async () => {
          await Promise.resolve();
        });
      },
      { write: (event) => b.push(event) },
    ),
  ]);
  callback();
  assert.ok(a.every((event) => event.role === "a"));
  assert.ok(b.every((event) => event.role === "b"));
  assert.ok(a.some((event) => event.stage === "watch.rebuild"));
  assert.notEqual(a[0]!.session, b[0]!.session);
});

test("result metadata is opt-in and cannot replace an operation's outcome", async () => {
  const events: TimingEvent[] = [];
  const unavailable = () => {
    throw new Error("metadata failed");
  };
  assert.equal(
    await runWithTimings(false, "test", () =>
      timeAsync("baseline", async () => 7, unavailable),
    ),
    7,
  );
  await runWithTimings(
    true,
    "test",
    async () => {
      assert.equal(await timeAsync("baseline", async () => 7, unavailable), 7);
      await timeAsync(
        "baseline",
        async () => true,
        (cacheHit) => ({ cacheHit }),
      );
    },
    { write: (event) => events.push(event) },
  );
  assert.deepEqual(
    events
      .filter((event) => event.event === "end")
      .map((event) => [event.status, event.cacheHit]),
    [
      ["ok", undefined],
      ["ok", true],
    ],
  );
});
