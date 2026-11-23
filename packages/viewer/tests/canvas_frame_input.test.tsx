import assert from "node:assert/strict";
import test from "node:test";

import { act } from "@testing-library/react";

import type { FrameEvent } from "@mokly/frame";
import { wheelZoom, type CanvasStageHandle } from "@mokly/ui/canvas-stage";

import { DESKTOP_FRAME_SIZE } from "../src/shell/canvas_frame_size.js";
import { CanvasLiveFrame } from "../src/shell/canvas_live_frame.js";
import { CanvasReadingStage } from "../src/shell/canvas_reading.js";
import {
  CanvasControlContext,
  type CanvasControl,
} from "../src/shell/canvas_stage.js";
import { createCatalogue } from "../src/shell/catalogue.js";
import {
  DocumentStageFrame,
  type DocumentEntry,
} from "../src/shell/document_stage_frame.js";

import {
  canvasPlans,
  fakeAdapter,
  registerDom,
  renderInShell,
} from "./canvas_frame_fixture.js";
import { shellModelFixture } from "./catalogue_v9_fixture.js";
import { flush } from "./data_fakes.js";

/** The canvas input of one document, and an event that no canvas reads. */
const EVENTS: readonly FrameEvent[] = [
  { type: "canvas-wheel", deltaY: -40, deltaMode: 0, x: 10, y: 20 },
  { type: "canvas-pinch", scale: 1.5, x: 10, y: 20 },
  { type: "canvas-key", key: "fit" },
  { type: "hover", key: null, boxes: [] },
];

/** A document entry of the fixture catalogue. */
function documentEntry(path: string): DocumentEntry {
  const entry = createCatalogue(shellModelFixture()).byPath.get(path);
  assert.ok(entry?.kind === "page" || entry?.kind === "document", path);
  return entry;
}

/** A canvas whose handle records what the frames ask of it. */
function recordingControl(): { calls: unknown[][]; control: CanvasControl } {
  const calls: unknown[][] = [];
  const handle: CanvasStageHandle = {
    fit: () => calls.push(["fit"]),
    run: (command) => calls.push(["run", command]),
    zoomAt: (factor, x, y) => calls.push(["zoomAt", factor, x, y]),
    zoomIn: () => calls.push(["zoomIn"]),
    zoomOut: () => calls.push(["zoomOut"]),
    zoomTo: (zoom) => calls.push(["zoomTo", zoom]),
  };
  return {
    calls,
    control: {
      canvas: { current: null },
      handle: { current: handle },
      zoom: { current: 1 },
    },
  };
}

test("a screen or component frame asks for canvas input and hands its wheel, pinch and keys to the canvas", async (t) => {
  registerDom(t);
  const [desktop] = canvasPlans("product/browse/home");
  const [component] = canvasPlans("components/action");
  for (const plan of [desktop, component]) {
    assert.ok(plan);
    const { adapter, mounts } = fakeAdapter();
    const { calls, control } = recordingControl();
    const frame = renderInShell(
      adapter,
      plan.entry.path,
      <CanvasControlContext value={control}>
        <CanvasLiveFrame
          hasDarkFragments={false}
          plan={plan}
          size={DESKTOP_FRAME_SIZE}
        />
      </CanvasControlContext>,
    );
    try {
      await act(flush);
      assert.equal(mounts.length, 1, plan.key);
      assert.equal(mounts[0]!.canvasInput, true, plan.key);
      act(() => EVENTS.forEach((event) => mounts[0]!.onEvent!(event)));
      // The frame is known, so the wheel and the pinch zoom about their
      // point in it: happy-dom lays the frame out at the page's top left.
      assert.deepEqual(calls, [
        ["zoomAt", wheelZoom(1, -40), 10, 20],
        ["zoomAt", 1.5, 10, 20],
        ["run", "fit"],
      ]);
    } finally {
      frame.unmount();
    }
  }
});

test("a reading frame asks for canvas input, and a frame outside the canvas does not", async (t) => {
  registerDom(t);
  const entry = documentEntry("guide");
  const catalogue = createCatalogue(shellModelFixture());
  for (const [node, canvasInput] of [
    [<CanvasReadingStage catalogue={catalogue} entry={entry} />, true],
    [<DocumentStageFrame entry={entry} hasDarkFragments={false} />, undefined],
  ] as const) {
    const { adapter, mounts } = fakeAdapter();
    const frame = renderInShell(adapter, entry.path, node);
    try {
      await act(flush);
      assert.equal(mounts.length, 1);
      assert.equal(mounts[0]!.canvasInput, canvasInput);
    } finally {
      frame.unmount();
    }
  }
});
