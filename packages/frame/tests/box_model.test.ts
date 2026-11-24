import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import type { ProbeMetadata } from "../src/probe/metadata.js";

import { inner, outer, runtimeFixture } from "./probe_runtime_fixture.js";

function fixture(
  t: TestContext,
  content: string,
  metadata: ProbeMetadata = {
    ranges: [[outer, null]],
    links: [],
  },
) {
  const result = runtimeFixture(t, undefined, metadata);
  result.doc.body.innerHTML = `<!--mokly-instance:start id="r-0" instance="${outer}"-->${content}<!--mokly-instance:end id="r-0"-->`;
  const element = result.doc.querySelector<HTMLElement>("button");
  if (element) {
    element.style.cssText =
      "border-style: solid; border-width: 2px 3px 4px 5px; padding: 6.1px 12.2px 8.3px 14.4px";
    const rect = new result.win.DOMRect(-12.5, 6.25, 160.4, 40.6);
    element.getBoundingClientRect = () => rect;
    element.getClientRects = () => Object.assign([rect], { item: () => rect });
  }
  return { ...result, element };
}

test("box model measures the element's full border box and computed sides", (t) => {
  const { runtime, element, win } = fixture(t, "<button>Action</button>");
  const fragment = new win.DOMRect(10, 20, 20, 10);
  element!.getClientRects = () =>
    Object.assign([fragment, fragment], { item: () => fragment });
  assert.deepEqual(runtime.__boxModel(outer), {
    box: { x: -12.5, y: 6.25, width: 160.4, height: 40.6 },
    border: { top: 2, right: 3, bottom: 4, left: 5 },
    padding: { top: 6.1, right: 12.2, bottom: 8.3, left: 14.4 },
  });
});

test("box model accepts ASCII whitespace and nested instance and slot comments", (t) => {
  const { runtime } = fixture(
    t,
    ` \t\n\f\r<!-- ordinary -->
    <!--mokly-instance:start id="r-1" instance="${inner}"-->
    <!--mokly-slot:start id="r-2"--><button>Action</button><!--mokly-slot:end id="r-2"-->
    <!--mokly-instance:end id="r-1"--> `,
    {
      ranges: [
        [outer, null],
        [inner, 0],
        [null, 1],
      ],
      links: [],
    },
  );
  assert.deepEqual(runtime.__boxModel(outer), {
    box: { x: -12.5, y: 6.25, width: 160.4, height: 40.6 },
    border: { top: 2, right: 3, bottom: 4, left: 5 },
    padding: { top: 6.1, right: 12.2, bottom: 8.3, left: 14.4 },
  });
});

test("box model is null for multiple ranges, multiple roots, content text and absent boxes", (t) => {
  for (const content of [
    "",
    "Text",
    "\u00a0<button>Action</button>",
    "<button>Action</button><span>Other</span>",
  ]) {
    const { runtime } = fixture(t, content);
    assert.equal(runtime.__boxModel(outer), null, content);
  }
  const repeated = runtimeFixture(t);
  assert.equal(repeated.runtime.__boxModel(outer), null);
  const hidden = fixture(t, "<button>Hidden</button>");
  hidden.element!.getClientRects = () =>
    Object.assign([], { item: () => null });
  assert.equal(hidden.runtime.__boxModel(outer), null);
  const split = fixture(
    t,
    '<section><!--mokly-instance:end id="r-0"--></section>',
  );
  split.doc.body.lastChild!.remove();
  assert.equal(split.runtime.__boxModel(outer), null);
});

test("box model rejects out-of-bounds geometry, unavailable evidence and unauthenticated markers", (t) => {
  const measured = fixture(t, "<button>Action</button>");
  for (const [x, width] of [
    [0, 1000001],
    [-1000001, 20],
    [0, -1],
    [NaN, 20],
    [0, Infinity],
  ]) {
    measured.element!.getBoundingClientRect = () =>
      new measured.win.DOMRect(x, 0, width, 20);
    assert.throws(
      () => measured.runtime.__boxModel(outer),
      (error) => error === "limit",
    );
  }
  measured.element!.getBoundingClientRect = () =>
    new measured.win.DOMRect(0, 0, 20, 20);
  measured.element!.style.paddingLeft = "1000001px";
  assert.throws(
    () => measured.runtime.__boxModel(outer),
    (error) => error === "limit",
  );
  assert.throws(
    () => measured.runtime.__boxModel("f".repeat(64)),
    (error) => error === "missing-instance",
  );
  for (const error of ["unavailable", "limit"] as const) {
    const unavailable = fixture(t, "", { ranges: [], links: [], error });
    assert.throws(
      () => unavailable.runtime.__boxModel(outer),
      (caught) => caught === error,
    );
  }
  measured.doc.body.lastChild!.remove();
  assert.throws(
    () => measured.runtime.__boxModel(outer),
    (error) => error === "invalid-boundary",
  );
});
