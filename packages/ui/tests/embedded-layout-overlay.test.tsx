import "./dom.js";

import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { render } from "@testing-library/react";
import type { ReactNode } from "react";

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
      topBar={null}
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

test("the overlay finds a flow or an embedded document when no workspace shows", () => {
  boxes.set(".mbk-flow", { left: 7, top: 9, width: 11, height: 13 });
  const { container } = render(
    layout(<div className="mbk-flow">Steps</div>, { stageOverlay: NOTE }),
  );
  assert.equal(overlay(container).hidden, false);
  assert.equal(overlay(container).style.width, "11px");
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
