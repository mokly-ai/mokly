import assert from "node:assert/strict";
import { test } from "node:test";

import {
  emptyLog,
  keptTailBytes,
  outputLines,
  receiveWindow,
  windowFull,
} from "../../viewer/build-log";
import { chunk, logWindow } from "./build-fixtures";

test("windows append in order and continue after the last sequence", () => {
  let view = receiveWindow(
    emptyLog,
    logWindow([chunk(1, "a\n"), chunk(2, "b\n")]),
  );
  view = receiveWindow(view, logWindow([chunk(3, "c\n")]));
  assert.deepEqual(
    view.chunks.map((held) => held.sequence),
    [1, 2, 3],
  );
  assert.equal(view.after, 3);
  // A window with nothing new keeps where the reader is.
  view = receiveWindow(view, logWindow([], { nextAfter: 3, complete: true }));
  assert.equal(view.after, 3);
  assert.equal(view.complete, true);
});

test("a chunk already held is not held twice", () => {
  const first = receiveWindow(emptyLog, logWindow([chunk(1, "a\n")]));
  const again = receiveWindow(
    first,
    logWindow([chunk(1, "a\n"), chunk(2, "b\n")]),
  );
  assert.deepEqual(
    again.chunks.map((held) => held.sequence),
    [1, 2],
  );
});

test("a newer attempt replaces the output of the older one", () => {
  const older = receiveWindow(emptyLog, logWindow([chunk(1, "first try\n")]));
  const newer = receiveWindow(
    older,
    logWindow([chunk(9, "second try\n", { attempt: 2 })]),
  );
  assert.equal(newer.attempt, 2);
  assert.deepEqual(outputLines(newer), [{ kind: "ink", text: "second try" }]);
  // A late chunk of the older attempt is not shown over the newer one.
  const late = receiveWindow(newer, logWindow([chunk(10, "late\n")]));
  assert.deepEqual(outputLines(late), [{ kind: "ink", text: "second try" }]);
});

test("output reads alike across streams and Mokly's lines stand alone", () => {
  const view = receiveWindow(
    emptyLog,
    logWindow([
      chunk(1, "$ npm ci\n", { stream: "system" }),
      chunk(2, "added 1 pack"),
      chunk(3, "age\nwarn: old\n", { stream: "stderr" }),
      chunk(4, "partial"),
      chunk(5, "exit 0\n", { stream: "system" }),
      chunk(6, "one\n\nthree\n"),
    ]),
  );
  assert.deepEqual(outputLines(view), [
    { kind: "system", text: "$ npm ci" },
    { kind: "ink", text: "added 1 package" },
    { kind: "ink", text: "warn: old" },
    { kind: "ink", text: "partial" },
    { kind: "system", text: "exit 0" },
    { kind: "ink", text: "one" },
    { kind: "ink", text: "" },
    { kind: "ink", text: "three" },
  ]);
});

test("one line marks where retained output was dropped", () => {
  const elision = { afterSequence: 2, bytes: 1_412_866 };
  const view = receiveWindow(
    emptyLog,
    logWindow(
      [chunk(1, "head\n"), chunk(2, "end of head\n"), chunk(9, "tail\n")],
      {
        elision,
      },
    ),
  );
  assert.deepEqual(outputLines(view), [
    { kind: "ink", text: "head" },
    { kind: "ink", text: "end of head" },
    { kind: "elision", text: "1.4 MB of output not kept" },
    { kind: "ink", text: "tail" },
  ]);
  // Before any later output arrives, the line closes what is shown.
  const headOnly = receiveWindow(
    emptyLog,
    logWindow([chunk(1, "head\n")], { elision }),
  );
  assert.equal(outputLines(headOnly).at(-1)?.kind, "elision");
});

test("a reader keeps no more output after the head than Mokly keeps", () => {
  const block = "x".repeat(60_000) + "\n";
  const chunks = Array.from({ length: 20 }, (_, index) =>
    chunk(index + 3, block),
  );
  const view = receiveWindow(
    emptyLog,
    logWindow([chunk(1, "head\n"), ...chunks], {
      elision: { afterSequence: 1, bytes: 500_000 },
    }),
  );
  const tail = view.chunks.filter((held) => held.sequence > 1);
  const bytes = tail.reduce((total, held) => total + held.bytes, 0);
  assert.ok(bytes <= keptTailBytes, "the tail is within what Mokly keeps");
  assert.equal(view.chunks[0].sequence, 1, "the head stays");
  assert.equal(view.chunks.at(-1)?.sequence, 22, "the newest output stays");
  // Without an elision Mokly has dropped nothing, so neither does the reader.
  const whole = receiveWindow(
    emptyLog,
    logWindow([chunk(1, "head\n"), ...chunks]),
  );
  assert.equal(whole.chunks.length, 21);
});

test("a window is full at its chunk limit or near its text limit", () => {
  assert.equal(windowFull(logWindow([chunk(1, "a")])), false);
  const hundred = Array.from({ length: 100 }, (_, index) =>
    chunk(index + 1, "a"),
  );
  assert.equal(windowFull(logWindow(hundred)), true);
  const large = [chunk(1, "x".repeat(200_000))];
  assert.equal(windowFull(logWindow(large)), true);
});
