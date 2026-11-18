import assert from "node:assert/strict";
import test from "node:test";

import { classifyLocalActivation } from "../src/adapters/same_origin_navigation.js";

import {
  hidden,
  inner,
  innerBox,
  outer,
  outerBox,
  repeatedBox,
  runtimeFixture,
} from "./probe_runtime_fixture.js";

test("the core lists authenticated boundaries and rejects missing instances directly", (t) => {
  const { runtime, doc } = runtimeFixture(t);
  assert.deepEqual(runtime.__list(), [
    {
      key: outer,
      ranges: [
        { id: "r-1", boxes: [outerBox] },
        { id: "r-4", boxes: [repeatedBox] },
      ],
    },
    { key: inner, ranges: [{ id: "r-2", boxes: [innerBox, repeatedBox] }] },
    { key: hidden, ranges: [{ id: "r-5", boxes: [] }] },
  ]);
  assert.doesNotThrow(() => runtime.__scroll(hidden));
  assert.throws(
    () => runtime.__scroll("f".repeat(64)),
    (error) => error === "missing-instance",
  );
  assert.throws(
    () => runtime.__highlight(["f".repeat(64)], "pick"),
    (error) => error === "missing-instance",
  );
  doc.body.prepend(doc.createComment('mokly-instance:end id="r-1"'));
  assert.throws(runtime.__list, (error) => error === "invalid-boundary");
});

test("hover and click choose the innermost reportable range in every mode", (t) => {
  const fixture = runtimeFixture(t);
  const { runtime, events } = fixture;
  runtime.__subscribe(["hover", "click"]);
  for (const [keys, mode, x, key, boxes] of [
    [[], "off", 25, inner, [innerBox, repeatedBox]],
    [[outer, inner], "highlight", 25, inner, [innerBox, repeatedBox]],
    [[outer, inner], "pick", 85, outer, [outerBox, repeatedBox]],
    [[outer], "highlight", 25, outer, [outerBox, repeatedBox]],
    [[inner], "pick", 85, inner, [innerBox, repeatedBox]],
    [[], "highlight", 25, null, []],
    [[], "pick", 25, null, []],
    [[], "off", 25, inner, [innerBox, repeatedBox]],
  ] as const) {
    runtime.__highlight(keys, mode);
    events.length = 0;
    fixture.point("pointermove", x);
    fixture.flush();
    const prevented = fixture.point("click", x);
    assert.deepEqual(
      events,
      [
        { type: "hover", key, boxes },
        ...(key === null ? [] : [{ type: "click", key, boxes }]),
      ],
      `${mode}: ${keys.join(",")} at ${x}`,
    );
    assert.equal(prevented, mode !== "off" && key !== null);
  }
  fixture.doc.dispatchEvent(new fixture.win.Event("pointerleave"));
  fixture.flush();
  assert.deepEqual(events.at(-1), { type: "hover", key: null, boxes: [] });
});

test("the core uses the supplied link classifier and pick takes precedence", (t) => {
  const navigation = {
    screenPath: "details",
    target: { kind: "self" },
    activation: "primary",
  } as const;
  let classified = 0;
  const fixture = runtimeFixture(t, () => {
    classified++;
    return navigation;
  });
  const { runtime, events } = fixture;
  runtime.__subscribe(["navigation"]);
  assert.equal(fixture.point("click"), true);
  assert.deepEqual(events, [{ type: "navigation", navigation }]);
  runtime.__highlight([inner], "pick");
  runtime.__subscribe(["click", "navigation", "pick-end"]);
  events.length = 0;
  assert.equal(fixture.point("click"), true);
  assert.deepEqual(events, [
    { type: "click", key: inner, boxes: [innerBox, repeatedBox] },
  ]);
  assert.equal(classified, 1);
  fixture.doc.dispatchEvent(
    new fixture.win.KeyboardEvent("keydown", {
      key: "Escape",
      cancelable: true,
    }),
  );
  assert.deepEqual(events.at(-1), { type: "pick-end", reason: "escape" });
  runtime.__subscribe([]);
  events.length = 0;
  assert.equal(fixture.point("click"), false);
  assert.deepEqual(events, []);

  const endingPick = runtimeFixture(
    t,
    () => navigation,
    undefined,
    (event) => {
      if (event.type === "click") endingPick.runtime.__highlight([], "off");
    },
  );
  endingPick.runtime.__subscribe(["click", "navigation"]);
  endingPick.runtime.__highlight([inner], "pick");
  assert.equal(endingPick.point("click"), true);
  assert.deepEqual(endingPick.events, [
    { type: "click", key: inner, boxes: [innerBox, repeatedBox] },
  ]);
});

test("inspection overflow preserves marked link navigation", (t) => {
  const fixture = runtimeFixture(t, classifyLocalActivation, {
    ranges: [[inner, null]],
    links: [],
  });
  const { runtime, doc, win, events } = fixture;
  doc.body.innerHTML = `<!--mokly-instance:start id="r-0" instance="${inner}"-->
<a data-box="inner" data-mokly-link="details">Open details</a>
<!--mokly-instance:end id="r-0"-->`;
  const link = doc.querySelector<HTMLAnchorElement>("a")!;
  const rects = Array.from(
    { length: 65 },
    (_, index) =>
      new win.DOMRect(
        20 + (index % 13) * 2,
        20 + Math.floor(index / 13) * 2,
        1,
        1,
      ),
  );
  link.getClientRects = () =>
    Object.assign(rects, { item: (index: number) => rects[index] ?? null });
  runtime.__subscribe(["click", "navigation"]);
  const prevented = fixture.point("click", 25, link);
  assert.deepEqual(events, [
    { type: "error", code: "limit" },
    {
      type: "navigation",
      navigation: {
        screenPath: "details",
        target: { kind: "self" },
        activation: "primary",
      },
    },
  ]);
  assert.equal(prevented, true);
});

test("scheduled callback exceptions retain identity without inspection errors", (t) => {
  for (const type of ["geometry", "hover"] as const) {
    const error = new Error(`${type} callback failed`);
    const fixture = runtimeFixture(t, undefined, undefined, (event) => {
      if (event.type === type) throw error;
    });
    fixture.runtime.__subscribe([type]);
    if (type === "geometry") fixture.changed();
    else fixture.point("pointermove");
    assert.throws(
      () => fixture.flush(),
      (caught) => caught === error,
    );
    assert.deepEqual(
      fixture.events.map((event) => event.type),
      [type],
    );
  }
});

test("host callbacks coalesce events and disposal removes all work once", (t) => {
  const fixture = runtimeFixture(t);
  const { runtime, events, doc, win, frames } = fixture;
  assert.deepEqual(fixture.observed, [doc.body, doc]);
  runtime.__subscribe(["hover", "geometry"]);
  fixture.point("pointermove", 85);
  fixture.point("pointermove", 25);
  fixture.changed();
  assert.equal(frames.size, 1);
  fixture.flush(10);
  assert.deepEqual(events, []);
  assert.equal(frames.size, 1);
  fixture.flush(7);
  assert.deepEqual(events, [
    { type: "geometry" },
    { type: "hover", key: inner, boxes: [innerBox, repeatedBox] },
  ]);
  fixture.point("pointermove");
  assert.equal(frames.size, 1);
  win.dispatchEvent(new win.Event("pagehide"));
  runtime.__dispose();
  assert.equal(frames.size, 0);
  assert.deepEqual(fixture.facts(), { disconnected: 2, disposed: 1 });
  events.length = 0;
  fixture.point("pointermove");
  fixture.point("click");
  doc.dispatchEvent(new win.Event("scroll"));
  win.dispatchEvent(new win.Event("resize"));
  fixture.flush();
  assert.deepEqual(events, []);
  assert.equal(frames.size, 0);
});

test("the core cancels pending measurements and listeners on disposal", (t) => {
  const fixture = runtimeFixture(t);
  const { runtime, signals, cancelled, frames } = fixture;
  fixture.changed();
  assert.equal(frames.size, 1);
  assert.equal(signals.length, 2);
  assert.ok(signals.every((signal) => !signal.aborted));
  runtime.__dispose();
  assert.ok(signals.every((signal) => signal.aborted));
  assert.deepEqual(cancelled, [1]);
});
