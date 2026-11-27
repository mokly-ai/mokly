import assert from "node:assert/strict";
import test from "node:test";

import { act } from "@testing-library/react";
import type { ReactNode } from "react";

import type { FrameAdapter } from "@mokly/frame";
import { FrameError } from "@mokly/frame/internal";

import { DESKTOP_FRAME_SIZE } from "../src/shell/canvas_frame_size.js";
import { CanvasLiveFrame } from "../src/shell/canvas_live_frame.js";
import { CanvasReadingStage } from "../src/shell/canvas_reading.js";
import { CanvasUseCaseFrame } from "../src/shell/canvas_use_case_frame.js";
import {
  openingUseCaseChoice,
  useCaseFrames,
} from "../src/shell/canvas_use_case_frames.js";
import { createCatalogue } from "../src/shell/catalogue.js";

import {
  canvasPlans,
  registerDom,
  renderInShell,
} from "./canvas_frame_fixture.js";
import { shellModelFixture } from "./catalogue_v9_fixture.js";
import { flush } from "./data_fakes.js";

/** An adapter whose every mount finds a page that an earlier Mokly built. */
const outdatedAdapter: FrameAdapter = {
  mount: () => Promise.reject(new FrameError("version")),
};

/** One live frame of each kind, with the path of the canvas that holds it. */
function liveFrames(): { kind: string; path: string; node: ReactNode }[] {
  const model = shellModelFixture();
  const catalogue = createCatalogue(model);
  const [screenPlan] = canvasPlans("product/browse/home");
  const tour = model.useCases.find((useCase) => useCase.path === "tour");
  assert.ok(screenPlan && tour);
  const [step] = useCaseFrames(model.screens, tour, openingUseCaseChoice(true));
  const guide = catalogue.byPath.get("guide");
  assert.ok(step && (guide?.kind === "page" || guide?.kind === "document"));
  return [
    {
      kind: "screen",
      path: screenPlan.entry.path,
      node: (
        <CanvasLiveFrame
          hasDarkFragments={false}
          plan={screenPlan}
          size={DESKTOP_FRAME_SIZE}
        />
      ),
    },
    {
      kind: "use-case step",
      path: "tour",
      node: (
        <CanvasUseCaseFrame
          hasDarkFragments={false}
          plan={step}
          size={DESKTOP_FRAME_SIZE}
        />
      ),
    },
    {
      kind: "reading",
      path: guide.path,
      node: <CanvasReadingStage catalogue={catalogue} entry={guide} />,
    },
  ];
}

test("each live frame whose page an earlier Mokly built names the way on, without Try again", async (t) => {
  registerDom(t);
  for (const { kind, path, node } of liveFrames()) {
    const frame = renderInShell(outdatedAdapter, path, node);
    try {
      await act(flush);
      const status = frame.container.querySelector('[role="status"]');
      assert.equal(
        status?.textContent,
        "This preview was built with an older version of Mokly. Update Mokly in the project, then publish it again.",
        kind,
      );
      assert.equal(status?.querySelector("button, a"), null, kind);
    } finally {
      frame.unmount();
    }
  }
});
