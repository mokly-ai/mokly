import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import { FrameError, measureContentBox } from "@mokly/frame/internal";

import type { ProbeMetadata } from "../src/probe/metadata.js";

import { runtimeFixture } from "./probe_runtime_fixture.js";

function fixture(
  t: TestContext,
  html: string,
  metadata: ProbeMetadata = { ranges: [], links: [] },
) {
  const result = runtimeFixture(t, undefined, metadata);
  result.doc.body.innerHTML = html;
  return result;
}

function rects(...values: DOMRect[]): DOMRectList {
  return Object.assign(values, {
    item: (index: number) => values[index] ?? null,
  });
}

test("content box unions all rectangles of element and text children", (t) => {
  const { doc, win, runtime } = fixture(t, "<span><b>Inside</b></span>Outside");
  const element = doc.querySelector("span")!;
  element.getClientRects = () =>
    rects(new win.DOMRect(10, 6, 15, 4), new win.DOMRect(11, 10, 24, 8));
  doc.querySelector("b")!.getClientRects = () =>
    rects(new win.DOMRect(-100, -100, 20, 20));
  win.Range.prototype.getClientRects = function () {
    assert.equal(this.startContainer, doc.body.lastChild);
    return rects(new win.DOMRect(8, 12, 6, 9));
  };
  assert.deepEqual(runtime.__contentBox(), {
    x: 8,
    y: 6,
    width: 27,
    height: 15,
  });
});

test("content box skips comments and rectangles with zero width or height", (t) => {
  const { doc, win, runtime } = fixture(
    t,
    " \t\n<!-- comment --><span>A</span>",
  );
  doc.querySelector("span")!.getClientRects = () =>
    rects(new win.DOMRect(4, 3, 10, 2), new win.DOMRect(-50, -50, 40, 0));
  win.Range.prototype.getClientRects = function () {
    const width = this.startContainer.nodeType === 8 ? 80 : 0;
    return rects(new win.DOMRect(-100, -100, width, 30));
  };
  assert.deepEqual(runtime.__contentBox(), {
    x: 4,
    y: 3,
    width: 10,
    height: 2,
  });
});

test("content box follows descendants of elements without client rectangles", (t) => {
  const { doc, win, runtime } = fixture(
    t,
    "<div><span><button>Action</button></span></div><p><b>Zero box parent</b></p>",
  );
  doc.querySelector("div")!.getClientRects = () => rects();
  doc.querySelector("span")!.getClientRects = () => rects();
  doc.querySelector("button")!.getClientRects = () =>
    rects(new win.DOMRect(-2, 5, 12, 6));
  doc.querySelector("p")!.getClientRects = () =>
    rects(new win.DOMRect(0, 0, 0, 0));
  doc.querySelector("b")!.getClientRects = () =>
    rects(new win.DOMRect(-100, -100, 20, 20));
  assert.deepEqual(runtime.__contentBox(), {
    x: -2,
    y: 5,
    width: 12,
    height: 6,
  });
});

test("content box is null for an empty or absent body", (t) => {
  const { doc, runtime } = fixture(t, "");
  assert.equal(runtime.__contentBox(), null);
  doc.body.remove();
  assert.equal(runtime.__contentBox(), null);
});

test("content box remeasures in unrounded document coordinates after scrolling", (t) => {
  const { doc, win, runtime } = fixture(t, "<button>Action</button>");
  let x = 24.25;
  doc.querySelector("button")!.getClientRects = () =>
    rects(new win.DOMRect(x - win.scrollX, 63.5 - win.scrollY, 160.5, 40.25));
  const before = { x: 24.25, y: 63.5, width: 160.5, height: 40.25 };
  assert.deepEqual(runtime.__contentBox(), before);
  win.scrollTo(12, 40);
  assert.equal(win.scrollX, 12);
  assert.equal(win.scrollY, 40);
  assert.deepEqual(runtime.__contentBox(), before);
  x = 32;
  assert.deepEqual(runtime.__contentBox(), { ...before, x: 32 });
});

test("content box rejects results outside the wire bounds", (t) => {
  const { doc, win, runtime } = fixture(t, "<span>Large</span>");
  const element = doc.querySelector("span")!;
  for (const [x, width] of [
    [0, 1_000_000.25],
    [-1_000_001, 20],
  ] as const) {
    element.getClientRects = () => rects(new win.DOMRect(x, 0, width, 20));
    assert.throws(
      () => runtime.__contentBox(),
      (error) => error === "limit",
    );
  }
});

test("content box measures a document whose published map reports an error", (t) => {
  const { doc, win, runtime } = fixture(t, "<button>Action</button>", {
    ranges: [],
    links: [],
    error: "limit",
  });
  doc.querySelector("button")!.getClientRects = () =>
    rects(new win.DOMRect(10, 20, 160, 40));
  assert.deepEqual(runtime.__contentBox(), {
    x: 10,
    y: 20,
    width: 160,
    height: 40,
  });
});

test("the internal content measurement returns a box and maps a limit to FrameError", (t) => {
  const { doc, win } = fixture(t, "<span>Comparison content</span>");
  const element = doc.querySelector("span")!;
  element.getClientRects = () => rects(new win.DOMRect(1, 2, 30, 40));
  assert.deepEqual(measureContentBox(doc), {
    x: 1,
    y: 2,
    width: 30,
    height: 40,
  });
  element.getClientRects = () => rects(new win.DOMRect(1_000_001, 2, 30, 40));
  assert.throws(
    () => measureContentBox(doc),
    (error) => error instanceof FrameError && error.code === "limit",
  );
});
