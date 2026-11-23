import assert from "node:assert/strict";
import { test } from "node:test";

import { VIEWER_DIRECTORY } from "@mokly/model";

import { generatedViews } from "../src/components/views.js";
import {
  framesViews,
  readingFrameLabel,
  workspaceFrames,
  type CanvasFramePlan,
} from "../src/shell/canvas_frames.js";

import { workspace } from "./canvas_workspace_fixture.js";

/** What a reader sees of each frame, and the view that it shows. */
function shown(frames: readonly CanvasFramePlan[]) {
  return frames.map((frame) => ({
    cell: [frame.column, frame.row],
    key: frame.key,
    label: frame.label,
    selected: frame.selected,
    title: frame.entry.title,
    view: frame.view && `${frame.view.viewport} ${frame.view.colorScheme}`,
  }));
}

test("a screen opens as Desktop beside Mobile, its Light row above its Dark row", () => {
  const data = workspace("product/browse/home", true);
  assert.deepEqual(shown(workspaceFrames(data, "both", data.views)), [
    {
      cell: [0, 0],
      key: "desktop-light",
      label: "Desktop · Light",
      selected: false,
      title: "Home",
      view: "desktop light",
    },
    {
      cell: [1, 0],
      key: "mobile-light",
      label: "Mobile · Light",
      selected: false,
      title: "Home",
      view: "mobile light",
    },
    {
      cell: [0, 1],
      key: "desktop-dark",
      label: "Desktop · Dark",
      selected: false,
      title: "Home",
      view: "desktop dark",
    },
    {
      cell: [1, 1],
      key: "mobile-dark",
      label: "Mobile · Dark",
      selected: false,
      title: "Home",
      view: "mobile dark",
    },
  ]);
});

test("a screen without a dark view has the Light row alone, and the viewport choice keeps one column", () => {
  const data = workspace("product/browse/home", false);
  assert.deepEqual(
    shown(workspaceFrames(data, "both", data.views)).map(({ cell, key }) => [
      key,
      cell,
    ]),
    [
      ["desktop-light", [0, 0]],
      ["mobile-light", [1, 0]],
    ],
  );
  const dark = workspace("product/browse/home", true);
  const mobile = workspaceFrames(dark, "mobile", dark.views);
  // The Desktop frames stay mounted, hidden, and Mobile takes the first
  // column.
  assert.deepEqual(
    mobile.map((frame) => [
      frame.key,
      frame.hidden === true,
      [frame.column, frame.row],
    ]),
    [
      ["desktop-light", true, [0, 0]],
      ["mobile-light", false, [0, 0]],
      ["desktop-dark", true, [0, 1]],
      ["mobile-dark", false, [0, 1]],
    ],
  );
  // Inspection draws on the shown frames only.
  assert.deepEqual(
    framesViews(dark.views, mobile).map((view) => [
      view.viewport,
      view.colorScheme,
    ]),
    [
      ["mobile", "light"],
      ["mobile", "dark"],
    ],
  );
});

test("a component opens as its variant set: its own example, then each saved variant, Light beside Dark", () => {
  const data = workspace("components/action", true);
  const frames = workspaceFrames(data, "both", data.views);
  assert.deepEqual(shown(frames), [
    {
      cell: [0, 0],
      key: "components/action:light",
      label: "Action · Light",
      selected: false,
      title: "Action",
      view: "desktop light",
    },
    {
      cell: [1, 0],
      key: "components/action:dark",
      label: "Action · Dark",
      selected: false,
      title: "Action",
      view: "desktop dark",
    },
    {
      cell: [0, 1],
      key: "components/action/default:light",
      label: "Default · Light",
      selected: false,
      title: "Default",
      view: "desktop light",
    },
    {
      cell: [1, 1],
      key: "components/action/default:dark",
      label: "Default · Dark",
      selected: false,
      title: "Default",
      view: "desktop dark",
    },
  ]);
  // Inspection draws on every shown frame: each row's desktop view.
  assert.deepEqual(
    framesViews(data.views, frames).map((view) => [
      view.variantPath,
      view.viewport,
      view.colorScheme,
    ]),
    [
      ["components/action", "desktop", "light"],
      ["components/action", "desktop", "dark"],
      ["components/action/default", "desktop", "light"],
      ["components/action/default", "desktop", "dark"],
    ],
  );
});

test("a saved variant's page opens the set with its Light frame selected, and a live edit shows in its row", () => {
  const data = workspace("components/action/default", true);
  const edited = generatedViews(data.variants[1]!.value).map((view) => ({
    ...view,
    path: `/${VIEWER_DIRECTORY}/components/renders/${view.viewport}-${view.colorScheme}.html`,
  }));
  const frames = workspaceFrames(data, "both", [
    ...data.views.filter(
      (view) => view.variantPath !== "components/action/default",
    ),
    ...edited,
  ]);
  // The parent's row keeps its saved documents.
  const saved = (colorScheme: string) =>
    data.views.find(
      (view) =>
        view.variantPath === "components/action" &&
        view.viewport === "desktop" &&
        view.colorScheme === colorScheme,
    )?.path;
  assert.deepEqual(
    frames.map((frame) => [frame.key, frame.selected, frame.preview?.path]),
    [
      ["components/action:light", false, saved("light")],
      ["components/action:dark", false, saved("dark")],
      [
        "components/action/default:light",
        true,
        `/${VIEWER_DIRECTORY}/components/renders/desktop-light.html`,
      ],
      [
        "components/action/default:dark",
        false,
        `/${VIEWER_DIRECTORY}/components/renders/desktop-dark.html`,
      ],
    ],
  );
});

test("a component without saved variants has one row for its own example, without a removed row", () => {
  const data = workspace("components/action", false);
  const own = { ...data, variants: data.variants.slice(0, 1) };
  assert.deepEqual(
    shown(workspaceFrames(own, "both", data.views)).map(({ key }) => key),
    ["components/action:light"],
  );
  const removed = {
    ...data,
    variants: data.variants.map((row, index) => ({
      ...row,
      removed: index > 0,
    })),
  };
  assert.deepEqual(
    shown(workspaceFrames(removed, "both", data.views)).map(({ key }) => key),
    ["components/action:light"],
  );
});

test("a reading frame is named by its source file", () => {
  assert.equal(
    readingFrameLabel({
      details: { sourcePath: "specs/account/billing/payment-terms.md" },
      path: "account/billing/payment-terms",
    }),
    "payment-terms.md",
  );
  assert.equal(
    readingFrameLabel({
      details: { sourcePath: "" },
      path: "example/getting-started",
    }),
    "getting-started",
  );
});
