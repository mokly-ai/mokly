import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CANVAS_PROPERTY,
  createComparisonScrollSync,
} from "../src/shell/comparison_scroll_sync.js";

import {
  FakeDocument,
  FakeFrame,
  FakeStyle,
  FakeViewport,
  fakeEnvironment,
  flushScrolls,
  stepAnimations,
} from "./comparison_scroll_fakes.js";

const SIZE = { height: 700, width: 1000 };

function setup(viewports = 1) {
  const fake = fakeEnvironment();
  const sync = createComparisonScrollSync(fake.environment);
  const shared = Array.from(
    { length: viewports },
    () => new FakeViewport(SIZE),
  );
  for (const viewport of shared)
    sync.attachViewport(
      viewport as unknown as HTMLElement,
      viewport.spacer as unknown as HTMLElement,
    );
  const layer = (viewport = shared[0]!) => {
    const frame = new FakeFrame();
    const surface = { style: new FakeStyle() };
    const release = sync.attachLayer({
      frame: frame as unknown as HTMLIFrameElement,
      surface: surface as unknown as HTMLElement,
      viewport: viewport as unknown as HTMLElement,
    });
    return { frame, release, surface };
  };
  return { fake, layer, shared, sync };
}

function presented(content: { height: number; width?: number }) {
  const doc = new FakeDocument(SIZE);
  return {
    doc,
    content: { height: content.height, width: content.width ?? SIZE.width },
  };
}

function key(
  name: string,
  target: unknown = null,
  modifiers: Partial<Record<"ctrlKey" | "shiftKey", boolean>> = {},
): Event {
  const event = Object.assign(new Event("keydown", { cancelable: true }), {
    altKey: false,
    ctrlKey: false,
    isComposing: false,
    key: name,
    metaKey: false,
    shiftKey: false,
    ...modifiers,
  });
  if (target) Object.defineProperty(event, "target", { value: target });
  return event;
}

test("a viewport scroll writes one offset to every version", () => {
  const { layer, shared } = setup();
  const before = presented({ height: 2400 });
  const after = presented({ height: 2400 });
  layer().frame.present(before.doc, before.content);
  layer().frame.present(after.doc, after.content);
  assert.equal(shared[0]!.spacer.style.height, "1700px");
  assert.equal(shared[0]!.spacer.style.width, "calc(100% + 0px)");
  shared[0]!.scrollTop = 300;
  flushScrolls();
  assert.equal(before.doc.scroller.scrollTop, 300);
  assert.equal(after.doc.scroller.scrollTop, 300);
  assert.equal(shared[0]!.scrollTop, 300);
});

test("the spacer takes the largest range and a shorter version shifts past its end", () => {
  const { layer, shared } = setup();
  const tall = presented({ height: 2400, width: 1300 });
  const short = presented({ height: 1000 });
  layer().frame.present(tall.doc, tall.content);
  const shorter = layer();
  shorter.frame.present(short.doc, short.content);
  assert.equal(shared[0]!.spacer.style.height, "1700px");
  assert.equal(shared[0]!.spacer.style.width, "calc(100% + 300px)");
  shared[0]!.scrollTop = 1200;
  shared[0]!.scrollLeft = 200;
  flushScrolls();
  assert.equal(tall.doc.scroller.scrollTop, 1200);
  assert.equal(short.doc.scroller.scrollTop, 300);
  assert.equal(short.doc.scroller.scrollLeft, 0);
  assert.equal(shorter.frame.style.transform, "translate(-200px, -900px)");
  shared[0]!.scrollTop = 100;
  shared[0]!.scrollLeft = 0;
  flushScrolls();
  assert.equal(shorter.frame.style.transform, "");
});

test("a scroll the controller did not make moves the viewport and every version", () => {
  const { layer, shared } = setup();
  const first = presented({ height: 3000 });
  const second = presented({ height: 3000 });
  layer().frame.present(first.doc, first.content);
  layer().frame.present(second.doc, second.content);
  first.doc.scroller.scrollTop = 900;
  flushScrolls();
  assert.equal(shared[0]!.scrollTop, 900);
  assert.equal(second.doc.scroller.scrollTop, 900);
});

test("side by side viewports mirror each other in both directions", () => {
  const { layer, shared } = setup(2);
  const before = presented({ height: 2000 });
  const after = presented({ height: 1500 });
  layer(shared[0]).frame.present(before.doc, before.content);
  layer(shared[1]).frame.present(after.doc, after.content);
  for (const viewport of shared)
    assert.equal(viewport.spacer.style.height, "1300px");
  shared[0]!.scrollTop = 400;
  flushScrolls();
  assert.deepEqual(
    [
      shared[1]!.scrollTop,
      before.doc.scroller.scrollTop,
      after.doc.scroller.scrollTop,
    ],
    [400, 400, 400],
  );
  shared[1]!.scrollTop = 250;
  flushScrolls();
  assert.deepEqual(
    [
      shared[0]!.scrollTop,
      before.doc.scroller.scrollTop,
      after.doc.scroller.scrollTop,
    ],
    [250, 250, 250],
  );
});

test("scroll keys pressed in a version move the shared viewport", () => {
  const { layer, shared } = setup();
  const version = presented({ height: 3000 });
  layer().frame.present(version.doc, version.content);
  const space = key(" ");
  version.doc.dispatchEvent(space);
  assert.equal(space.defaultPrevented, true);
  assert.equal(shared[0]!.scrollTop, 612);
  assert.equal(version.doc.scroller.scrollTop, 612);
  version.doc.dispatchEvent(key(" ", null, { shiftKey: true }));
  assert.equal(shared[0]!.scrollTop, 0);
  version.doc.dispatchEvent(key("End"));
  assert.equal(shared[0]!.scrollTop, 2300);
  const typed = key(" ", { localName: "input" });
  version.doc.dispatchEvent(typed);
  assert.equal(typed.defaultPrevented, false);
  const command = key("Home", null, { ctrlKey: true });
  version.doc.dispatchEvent(command);
  assert.equal(command.defaultPrevented, false);
  assert.equal(shared[0]!.scrollTop, 2300);
});

test("an anchor target moves every version to its document position", () => {
  const { layer, shared, sync } = setup();
  const first = presented({ height: 3000 });
  const second = presented({ height: 3000 });
  const shown = layer();
  shown.frame.present(first.doc, first.content);
  layer().frame.present(second.doc, second.content);
  shared[0]!.scrollTop = 300;
  flushScrolls();
  const target = {
    getBoundingClientRect: () => ({
      bottom: 180,
      left: 20,
      right: 80,
      top: 120,
    }),
  };
  sync.reveal(
    shown.frame as unknown as HTMLIFrameElement,
    target as unknown as Element,
  );
  assert.equal(shared[0]!.scrollTop, 420);
  assert.equal(second.doc.scroller.scrollTop, 420);
});

test("a document is followed from its commit, before its slow load ends", () => {
  const { fake, layer, shared } = setup();
  const { frame } = layer();
  const version = presented({ height: 2000 });
  frame.commit(version.doc);
  assert.equal(fake.animate(), 1);
  assert.equal(shared[0]!.spacer.style.height, "0px");
  version.doc.parse(version.content);
  version.doc.dispatchEvent(new Event("readystatechange"));
  assert.equal(fake.animate(), 1);
  assert.equal(shared[0]!.spacer.style.height, "1300px");
  assert.ok(fake.observed.has(version.doc.documentElement));
  version.doc.scroller.contentHeight = 2600;
  fake.resize();
  fake.resize();
  assert.equal(fake.animate(), 1);
  assert.equal(shared[0]!.spacer.style.height, "1900px");
});

test("a replaced document is followed and its predecessor released", () => {
  const { fake, layer, shared } = setup();
  const { frame, release, surface } = layer();
  const first = presented({ height: 2000 });
  frame.present(first.doc, first.content);
  first.doc.canvas.body = "rgb(1, 2, 3)";
  fake.resize();
  fake.animate();
  assert.equal(surface.style.properties.get(CANVAS_PROPERTY), "rgb(1, 2, 3)");
  shared[0]!.scrollTop = 500;
  flushScrolls();
  const second = presented({ height: 2000 });
  frame.commit(second.doc);
  second.doc.parse(second.content);
  fake.animate();
  assert.equal(second.doc.scroller.scrollTop, 500);
  assert.equal(surface.style.properties.has(CANVAS_PROPERTY), false);
  first.doc.scroller.scrollTop = 100;
  flushScrolls();
  assert.equal(shared[0]!.scrollTop, 500);
  shared[0]!.scrollTop = 1300;
  flushScrolls();
  release();
  assert.equal(frame.style.transform, "");
  second.doc.scroller.scrollTop = 0;
  flushScrolls();
  assert.equal(shared[0]!.scrollTop, 1300);
  assert.equal(fake.observed.has(second.doc.documentElement), false);
});

test("smooth-scrolling documents and viewports still move as one at once", () => {
  const { layer, shared } = setup();
  const before = presented({ height: 2400 });
  const after = presented({ height: 2400 });
  before.doc.scroller.smooth = true;
  after.doc.scroller.smooth = true;
  shared[0]!.smooth = true;
  const top = layer();
  layer().frame.present(before.doc, before.content);
  top.frame.present(after.doc, after.content);
  shared[0]!.userScroll({ top: 400 });
  flushScrolls();
  assert.deepEqual(
    [before.doc.scroller.scrollTop, after.doc.scroller.scrollTop],
    [400, 400],
  );
  assert.equal(top.frame.style.transform, "");
  for (let step = 0; step < 12; step += 1) {
    stepAnimations();
    flushScrolls();
  }
  assert.deepEqual(
    [
      shared[0]!.scrollTop,
      before.doc.scroller.scrollTop,
      after.doc.scroller.scrollTop,
    ],
    [400, 400, 400],
  );
});
