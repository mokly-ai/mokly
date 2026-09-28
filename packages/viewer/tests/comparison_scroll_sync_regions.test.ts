import assert from "node:assert/strict";
import { test } from "node:test";

import { createScrollOwner } from "../src/shell/comparison_scroll_owner.js";

import {
  FakeRegionDocument,
  type FakeElement,
} from "./comparison_region_fakes.js";
import { flushScrolls } from "./comparison_scroll_fakes.js";
import { key, setup, SIZE } from "./comparison_sync_harness.js";

/** A version whose page is `height` tall and holds a scrolling list panel. */
function version(height = 700, direction: "ltr" | "rtl" = "ltr") {
  const doc = new FakeRegionDocument(SIZE, { height, width: SIZE.width });
  const panel = doc.add("div", {
    attributes: { id: "list" },
    content: { height: 900, width: 600 },
    direction,
    layout: { height: 300, left: 0, top: 100, width: 300 },
    overflow: "auto",
  });
  const row = panel.add("p", {
    layout: { height: 40, left: 0, top: 800, width: 300 },
  });
  return { content: { height, width: SIZE.width }, doc, panel, row };
}

function pointer(doc: FakeRegionDocument, target: FakeElement): void {
  const event = new Event("pointerdown");
  Object.defineProperty(event, "target", { value: target });
  doc.dispatchEvent(event);
}

test("a panel's scroll moves its counterpart while the page stays", () => {
  const { layer, shared } = setup();
  const before = version();
  const after = version();
  layer(shared[0], "before").frame.present(before.doc, before.content);
  layer(shared[0], "after").frame.present(after.doc, after.content);
  after.panel.userScroll({ left: 50, top: 200 });
  flushScrolls();
  assert.deepEqual(
    [before.panel.scrollLeft, before.panel.scrollTop],
    [50, 200],
  );
  assert.deepEqual(
    [
      shared[0]!.scrollTop,
      before.doc.scroller.scrollTop,
      after.doc.scroller.scrollTop,
    ],
    [0, 0, 0],
  );
});

test("a key goes to the panel that can move, else to the page", () => {
  const { layer, shared } = setup();
  const before = version(3000);
  const after = version(3000);
  layer(shared[0], "before").frame.present(before.doc, before.content);
  layer(shared[0], "after").frame.present(after.doc, after.content);
  pointer(after.doc, after.row);
  const kept = key("PageDown");
  after.doc.dispatchEvent(kept);
  assert.equal(kept.defaultPrevented, false, "the browser scrolls the panel");
  assert.equal(shared[0]!.scrollTop, 0);
  after.panel.userScroll({ top: 600 });
  flushScrolls();
  const page = key("PageDown");
  after.doc.dispatchEvent(page);
  assert.equal(page.defaultPrevented, true);
  assert.equal(shared[0]!.scrollTop, 612);
  after.doc.activeElement = after.panel;
  const up = key("ArrowUp");
  after.doc.dispatchEvent(up);
  assert.equal(up.defaultPrevented, false, "the focused panel can move up");
  after.row.connected = false;
  after.doc.activeElement = after.doc.body;
  const detached = key("ArrowUp");
  after.doc.dispatchEvent(detached);
  assert.equal(detached.defaultPrevented, true);
});

test("right-to-left panels keep ArrowLeft until they reach their far end", () => {
  const { layer, shared } = setup();
  const doc = version(700, "rtl");
  layer(shared[0], "after").frame.present(doc.doc, doc.content);
  pointer(doc.doc, doc.row);
  const right = key("ArrowRight");
  doc.doc.dispatchEvent(right);
  assert.equal(
    right.defaultPrevented,
    true,
    "a new RTL panel cannot move right",
  );
  const left = key("ArrowLeft");
  doc.doc.dispatchEvent(left);
  assert.equal(left.defaultPrevented, false);
  doc.panel.userScroll({ left: -300 });
  flushScrolls();
  const end = key("ArrowLeft");
  doc.doc.dispatchEvent(end);
  assert.equal(end.defaultPrevented, true);
});

test("an anchor reveals its panels first, then moves the page", () => {
  const { layer, shared, sync } = setup();
  const before = version(3000);
  const after = version(3000);
  const shown = layer(shared[0], "before");
  shown.frame.present(before.doc, before.content);
  layer(shared[0], "after").frame.present(after.doc, after.content);
  sync.reveal(
    shown.frame as unknown as HTMLIFrameElement,
    before.row as unknown as Element,
  );
  assert.equal(before.panel.scrollTop, 540);
  assert.equal(after.panel.scrollTop, 540);
  assert.equal(shared[0]!.scrollTop, 360);
  assert.equal(after.doc.scroller.scrollTop, 360);
});

test("off lets Side by side part; on realigns to the version scrolled last", () => {
  const { layer, shared, sync } = setup(2);
  const before = version(3000);
  const after = version(3000);
  layer(shared[0], "before").frame.present(before.doc, before.content);
  layer(shared[1], "after").frame.present(after.doc, after.content);
  sync.setTogether(false);
  shared[0]!.userScroll({ top: 300 });
  after.panel.userScroll({ top: 40 });
  flushScrolls();
  before.panel.userScroll({ top: 100 });
  flushScrolls();
  assert.deepEqual(
    [shared[1]!.scrollTop, after.doc.scroller.scrollTop, after.panel.scrollTop],
    [0, 0, 40],
  );
  assert.equal(before.doc.scroller.scrollTop, 300);
  sync.setTogether(true);
  assert.deepEqual(
    [shared[1]!.scrollTop, after.doc.scroller.scrollTop, after.panel.scrollTop],
    [300, 300, 100],
  );
  flushScrolls();
  shared[1]!.userScroll({ top: 500 });
  flushScrolls();
  assert.equal(shared[0]!.scrollTop, 500);
});

test("off keeps a stack's page together while its panels part", () => {
  const owner = createScrollOwner();
  const { layer, shared, sync } = setup(1, { owner, together: false });
  const before = version(3000);
  const after = version(3000);
  layer(shared[0], "before").frame.present(before.doc, before.content);
  layer(shared[0], "after").frame.present(after.doc, after.content);
  shared[0]!.userScroll({ top: 400 });
  flushScrolls();
  assert.deepEqual(
    [before.doc.scroller.scrollTop, after.doc.scroller.scrollTop],
    [400, 400],
  );
  pointer(before.doc, before.row);
  assert.equal(owner.side(), "before");
  shared[0]!.userScroll({ top: 500 });
  flushScrolls();
  assert.equal(owner.side(), "before", "the shared scrollbar has no version");
  after.panel.userScroll({ top: 70 });
  flushScrolls();
  assert.equal(before.panel.scrollTop, 0);
  assert.equal(owner.side(), "after");
  sync.setTogether(true);
  assert.equal(before.panel.scrollTop, 70);
  flushScrolls();
  assert.equal(owner.side(), "after", "realigning claims nothing");
});

test("each measurement matches panels afresh", () => {
  const { fake, layer, shared } = setup();
  const before = version();
  const after = version();
  for (const side of [before, after]) {
    side.panel.attributes.delete("id");
    side.panel.text = "Notes glacier harbor lantern";
  }
  layer(shared[0], "before").frame.present(before.doc, before.content);
  layer(shared[0], "after").frame.present(after.doc, after.content);
  after.panel.userScroll({ top: 30 });
  flushScrolls();
  assert.equal(before.panel.scrollTop, 30);
  before.panel.layout = { height: 300, left: 700, top: 400, width: 300 };
  before.panel.text = "Rewritten entirely";
  after.panel.userScroll({ top: 60 });
  flushScrolls();
  assert.equal(before.panel.scrollTop, 60, "kept until the next measurement");
  fake.resize();
  fake.animate();
  after.panel.userScroll({ top: 90 });
  flushScrolls();
  assert.equal(before.panel.scrollTop, 60);
});
