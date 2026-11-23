import "./dom.js";

import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { render } from "@testing-library/react";
import type { ReactNode } from "react";

import {
  CanvasStage,
  type CanvasStageSection,
} from "../src/canvas-stage/canvas-stage.js";
import {
  EmbeddedLayout,
  MarkerLayer,
  type EmbeddedSlots,
} from "../src/embedded-layout/embedded-layout.js";

import { assertSameElement } from "./dom-assertions.js";

/** A resize observer that records what it observes and runs on request. */
class RecordingObserver {
  static all: RecordingObserver[] = [];
  readonly observed: Element[] = [];
  disconnected = false;
  constructor(readonly callback: () => void) {
    RecordingObserver.all.push(this);
  }
  observe(element: Element) {
    this.observed.push(element);
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
}

/** The box of each measured element, by a selector that matches it. */
const boxes = new Map<string, Partial<DOMRect>>();
const observer = globalThis.ResizeObserver;

/** happy-dom lays nothing out, so each element measures as the test says. */
function measure(this: HTMLElement): DOMRect {
  const selector = [...boxes.keys()].find((name) => this.matches(name));
  const box = { left: 0, top: 0, width: 0, height: 0 };
  return { ...box, ...boxes.get(selector ?? "") } as DOMRect;
}

beforeEach(() => {
  RecordingObserver.all = [];
  boxes.clear();
  globalThis.ResizeObserver =
    RecordingObserver as unknown as typeof ResizeObserver;
  Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
    configurable: true,
    value: measure,
  });
});

afterEach(() => {
  globalThis.ResizeObserver = observer;
  // The elements measure through happy-dom's own method again.
  Reflect.deleteProperty(HTMLElement.prototype, "getBoundingClientRect");
});

function layout(main: ReactNode, slots?: EmbeddedSlots) {
  return (
    <EmbeddedLayout
      announcement=""
      colorScheme="light"
      drawerOpen={false}
      emptyStateShown={false}
      main={main}
      mainHref="#main"
      markerLayer={<MarkerLayer markers={[]} />}
      navigation={null}
      slots={slots}
      statusId="status"
      theme="auto"
      topBar={() => null}
    />
  );
}

const NOTE = { content: <span>Note</span>, pointerEvents: "none" } as const;

function overlay(container: HTMLElement): HTMLElement {
  const element = container.querySelector<HTMLElement>(
    '[data-mokly-slot="stageOverlay"]',
  );
  assert.ok(element);
  return element;
}

test("the stage overlay covers the shown preview inside the stage host", () => {
  boxes.set(".mokly-stage-host", { left: 100, top: 40 });
  boxes.set("[data-workspace-preview]", {
    left: 130,
    top: 90,
    width: 200,
    height: 120,
  });
  const { container } = render(
    layout(<div data-workspace-preview="">Preview</div>, {
      stageOverlay: NOTE,
    }),
  );
  const element = overlay(container);
  assert.equal(element.hidden, false);
  assert.deepEqual(
    [
      element.style.left,
      element.style.top,
      element.style.width,
      element.style.height,
    ],
    ["30px", "50px", "200px", "120px"],
  );
  const [observer] = RecordingObserver.all;
  assertSameElement(
    observer?.observed[0],
    container.querySelector(".mokly-stage-host"),
  );
  assertSameElement(
    observer?.observed[1],
    container.querySelector("[data-workspace-preview]"),
  );
  // A resize of the host or the preview measures again.
  boxes.set("[data-workspace-preview]", {
    left: 100,
    top: 40,
    width: 50,
    height: 60,
  });
  observer?.callback();
  assert.deepEqual(
    [
      element.style.left,
      element.style.top,
      element.style.width,
      element.style.height,
    ],
    ["0px", "0px", "50px", "60px"],
  );
});

/** A use case's section: its step frames in one row. */
const USE_CASE: CanvasStageSection = {
  frames: [
    { key: "step-0", column: 0, row: 0, width: 390, height: 844, node: <i /> },
    { key: "step-1", column: 1, row: 0, width: 390, height: 844, node: <i /> },
  ],
  kind: "use-case",
  path: "example/tour",
  title: "Example tour",
};

test("the overlay finds the routed canvas of a use case's steps when no workspace shows", () => {
  boxes.set(".mbk-canvas", { left: 7, top: 9, width: 11, height: 13 });
  const { container } = render(
    layout(<CanvasStage routed section={USE_CASE} />, { stageOverlay: NOTE }),
  );
  assert.equal(overlay(container).hidden, false);
  assert.equal(overlay(container).style.width, "11px");
});

/** A document's section: its one reading frame, which takes the reading size. */
const READING: CanvasStageSection = {
  frames: [{ key: "document", column: 0, row: 0, node: <i /> }],
  kind: "document",
  path: "example/getting-started",
  title: "Getting started",
};

/** The overlay's place in the stage host and its size. */
function placement(element: HTMLElement): string[] {
  const { height, left, top, width } = element.style;
  return [left, top, width, height];
}

test("the overlay covers the routed canvas that holds a document's reading frame", () => {
  boxes.set(".mokly-stage-host", { left: 100, top: 40 });
  boxes.set(".mbk-canvas", { left: 110, top: 50, width: 640, height: 480 });
  const { container } = render(
    layout(<CanvasStage routed section={READING} />, { stageOverlay: NOTE }),
  );
  const element = overlay(container);
  assert.equal(element.hidden, false);
  assert.deepEqual(placement(element), ["10px", "10px", "640px", "480px"]);
});

test("a workspace's preview keeps the overlay over the canvas that it holds", () => {
  boxes.set(".mokly-stage-host", { left: 100, top: 40 });
  boxes.set("[data-workspace-preview]", {
    left: 100,
    top: 90,
    width: 900,
    height: 600,
  });
  boxes.set(".mbk-canvas", { left: 110, top: 150, width: 640, height: 480 });
  const { container } = render(
    layout(
      <div data-workspace-preview="">
        <CanvasStage routed section={READING} />
      </div>,
      { stageOverlay: NOTE },
    ),
  );
  assert.deepEqual(placement(overlay(container)), [
    "0px",
    "50px",
    "900px",
    "600px",
  ]);
});

test("a canvas that is not the routed stage takes no overlay", () => {
  const { container } = render(
    layout(<CanvasStage section={READING} />, { stageOverlay: NOTE }),
  );
  assert.equal(overlay(container).hidden, true);
});

test("the overlay hides while the host gives no content or no preview shows", () => {
  const { container, rerender } = render(
    layout(<p>Home</p>, { stageOverlay: NOTE }),
  );
  assert.equal(overlay(container).hidden, true);
  assert.equal(RecordingObserver.all.length, 0);
  rerender(
    layout(<div data-workspace-preview="">Preview</div>, {
      stageOverlay: NOTE,
    }),
  );
  assert.equal(overlay(container).hidden, false);
  rerender(layout(<div data-workspace-preview="">Preview</div>));
  assert.equal(overlay(container).hidden, true);
  assert.equal(RecordingObserver.all[0]?.disconnected, true);
});

test("an unmounted overlay stops observing", () => {
  const { unmount } = render(
    layout(<div data-workspace-preview="">Preview</div>, {
      stageOverlay: NOTE,
    }),
  );
  const [observer] = RecordingObserver.all;
  assert.equal(observer?.disconnected, false);
  unmount();
  assert.equal(observer?.disconnected, true);
});
