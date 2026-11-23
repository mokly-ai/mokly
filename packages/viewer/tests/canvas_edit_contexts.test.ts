import assert from "node:assert/strict";
import { test } from "node:test";

import { VIEWER_DIRECTORY } from "@mokly/model";

import type { GeneratedComponentView } from "../src/components/views.js";
import {
  compactFrames,
  pickedScreenFrame,
} from "../src/shell/canvas_compact.js";
import {
  canvasEditContexts,
  EVERY_FRAME,
  withEditPreviews,
  workspaceFrames,
} from "../src/shell/canvas_frames.js";

import { workspace } from "./canvas_workspace_fixture.js";

/** Each context's row, viewport and scheme. */
function axes(views: readonly GeneratedComponentView[]) {
  return views.map((view) => [
    view.variantPath,
    view.viewport,
    view.colorScheme,
  ]);
}

/** A temporary render of a view, as an accepted edit gives it. */
function rendered(view: GeneratedComponentView): GeneratedComponentView {
  return {
    ...view,
    path: `/${VIEWER_DIRECTORY}/components/renders/${view.viewport}-${view.colorScheme}.html`,
  };
}

test("a live edit of a row renders the row's desktop views in both schemes", () => {
  const data = workspace("components/action/default", true);
  const frames = workspaceFrames(data, EVERY_FRAME);
  const stage = data.views.slice(0, 1);
  assert.deepEqual(
    axes(
      canvasEditContexts(
        data.views,
        frames,
        "components/action/default",
        stage,
      ),
    ),
    [
      ["components/action/default", "desktop", "light"],
      ["components/action/default", "desktop", "dark"],
    ],
  );
  // A row without a desktop view keeps the selection's views.
  assert.equal(
    canvasEditContexts(
      data.views.filter((view) => view.viewport !== "desktop"),
      frames,
      "components/action/default",
      stage,
    ),
    stage,
  );
});

test("on the wide canvas a screen's edit renders every frame that the Frames filter shows", () => {
  const data = workspace("product/browse/home", true);
  assert.deepEqual(
    axes(
      canvasEditContexts(
        data.views,
        workspaceFrames(data, EVERY_FRAME),
        undefined,
        [],
      ),
    ),
    [
      [undefined, "desktop", "light"],
      [undefined, "mobile", "light"],
      [undefined, "desktop", "dark"],
      [undefined, "mobile", "dark"],
    ],
  );
  // The hidden Mobile frames take no edit's render.
  assert.deepEqual(
    axes(
      canvasEditContexts(
        data.views,
        workspaceFrames(data, {
          schemes: ["light", "dark"],
          viewports: ["desktop"],
        }),
        undefined,
        [],
      ),
    ),
    [
      [undefined, "desktop", "light"],
      [undefined, "desktop", "dark"],
    ],
  );
});

test("in the compact layout an edit renders the picked frame alone, and a set's own route its whole row", () => {
  const screen = workspace("product/browse/home", true);
  const frames = workspaceFrames(screen, EVERY_FRAME);
  const dark = compactFrames(
    frames,
    pickedScreenFrame(frames, { colorScheme: "dark", viewport: "desktop" }),
  );
  assert.deepEqual(
    axes(canvasEditContexts(screen.views, dark, undefined, [])),
    [[undefined, "desktop", "dark"]],
  );
  const variant = workspace("components/action/default", true);
  const set = workspaceFrames(variant, EVERY_FRAME);
  const picked = compactFrames(set, "components/action/default:light");
  assert.deepEqual(
    axes(
      canvasEditContexts(
        variant.views,
        picked,
        "components/action/default",
        [],
      ),
    ),
    [["components/action/default", "desktop", "light"]],
  );
  // Without a selected frame no frame is picked, so the row's frames both
  // show.
  const own = workspace("components/action", true);
  const whole = compactFrames(workspaceFrames(own, EVERY_FRAME), undefined);
  assert.deepEqual(
    axes(canvasEditContexts(own.views, whole, "components/action", [])),
    [
      ["components/action", "desktop", "light"],
      ["components/action", "desktop", "dark"],
    ],
  );
});

test("a screen's frame shows its view's temporary render, and else its saved document", () => {
  const data = workspace("product/browse/home", true);
  const darkDesktop = data.views.find(
    (view) => view.viewport === "desktop" && view.colorScheme === "dark",
  )!;
  const edited = data.views.map((view) =>
    view === darkDesktop ? rendered(view) : view,
  );
  assert.deepEqual(
    withEditPreviews(workspaceFrames(data, EVERY_FRAME), edited).map(
      (frame) => [frame.key, frame.preview?.path],
    ),
    [
      ["desktop-light", undefined],
      ["mobile-light", undefined],
      [
        "desktop-dark",
        `/${VIEWER_DIRECTORY}/components/renders/desktop-dark.html`,
      ],
      ["mobile-dark", undefined],
    ],
  );
});
