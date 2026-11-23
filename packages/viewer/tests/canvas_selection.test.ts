import assert from "node:assert/strict";
import { test } from "node:test";

import { EVERY_FRAME, workspaceFrames } from "../src/shell/canvas_frames.js";
import {
  canvasSelectionReducer,
  NO_SELECTION,
  type CanvasFrameState,
  type CanvasSelectionAction,
  type CanvasSelectionState,
} from "../src/shell/canvas_selection.js";
import {
  routeSelection,
  schemeFrame,
} from "../src/shell/canvas_selection_frames.js";

import { workspace } from "./canvas_workspace_fixture.js";

/** The state after each action, from nothing selected. */
function after(...actions: CanvasSelectionAction[]): CanvasSelectionState {
  return actions.reduce(canvasSelectionReducer, NO_SELECTION);
}

/** One frame's state: shown, mounted at `generation`, and its usage's keys. */
function frame(
  usage: readonly string[] | undefined,
  generation = 1,
  shown = true,
): ReadonlyMap<string, CanvasFrameState> {
  return new Map([
    ["mobile-light", { generation, shown, usage: usage && new Set(usage) }],
  ]);
}

const reconcile = (
  frames: ReadonlyMap<string, CanvasFrameState>,
  set = false,
): CanvasSelectionAction => ({ type: "reconcile", frames, set });

const toolbar = {
  type: "select",
  generation: 1,
  reveal: false,
  selected: { kind: "instance", frame: "mobile-light", key: "toolbar" },
} as const;

test("an instance selected without a reveal does not scroll Inspect when its usage leaves for one render and returns", () => {
  const state = after(
    toolbar,
    reconcile(frame(undefined)),
    reconcile(frame(["toolbar"])),
  );
  assert.deepEqual(state.selected, toolbar.selected);
  assert.equal(state.reveal, 0);
});

test("a route's instance waits for its frame's ready usage, then selects and reveals once", () => {
  const routed: CanvasSelectionAction = {
    type: "route",
    instance: { frame: "mobile-light", key: "toolbar" },
  };
  const waiting = after(routed, reconcile(frame(undefined)));
  assert.equal(waiting.selected, undefined);
  const shown = after(
    routed,
    reconcile(frame(undefined)),
    reconcile(frame(["toolbar"])),
    reconcile(frame(undefined)),
    reconcile(frame(["toolbar"])),
  );
  assert.deepEqual(shown.selected, toolbar.selected);
  assert.equal(shown.reveal, 1);
  // A ready usage without the instance drops the route's instance.
  assert.equal(after(routed, reconcile(frame(["other"]))).pending, undefined);
});

test("a frame's replacement or an instance that leaves its ready usage clears it, and a set keeps the frame", () => {
  assert.equal(
    after(toolbar, reconcile(frame(["toolbar"], 2))).selected,
    undefined,
  );
  assert.equal(after(toolbar, reconcile(frame(["other"]))).selected, undefined);
  assert.deepEqual(
    after(toolbar, reconcile(frame(["toolbar"], 2), true)).selected,
    {
      kind: "frame",
      frame: "mobile-light",
    },
  );
  // A frame that the Frames filter hides takes its selection with it.
  assert.equal(
    after(toolbar, reconcile(frame(["toolbar"], 1, false))).selected,
    undefined,
  );
  assert.equal(after(toolbar, { type: "clear" }).selected, undefined);
});

test("a frame that follows the selection's scheme moves only from the frame that it followed", () => {
  const light = { kind: "frame", frame: "set/row:light" } as const;
  const chosen: CanvasSelectionAction = {
    type: "select",
    generation: undefined,
    selected: light,
    reveal: false,
  };
  const follow: CanvasSelectionAction = {
    type: "follow",
    from: "set/row:light",
    frame: "set/row:dark",
  };
  assert.deepEqual(after(chosen, follow).selected, {
    kind: "frame",
    frame: "set/row:dark",
  });
  // A route that selects another frame in the same render wins.
  const routed: CanvasSelectionAction = {
    type: "route",
    frame: "set/other:dark",
  };
  assert.deepEqual(after(chosen, routed, follow).selected, {
    kind: "frame",
    frame: "set/other:dark",
  });
});

test("a Used by link selects its instance on the frame of its viewport and scheme", () => {
  const light = workspace("product/browse/home", false);
  const plans = workspaceFrames(light, EVERY_FRAME);
  const routed = {
    path: light.entry.path,
    savedVariant: false,
    scheme: "light",
  } as const;
  assert.deepEqual(
    routeSelection(
      {
        view: { kind: "home" },
        colorScheme: "dark",
        instance: "k",
        viewport: "desktop",
      },
      plans,
      routed,
    ),
    // The screen has no dark view, so its Light frame takes the instance.
    { instance: { frame: "desktop-light", key: "k" } },
  );
  assert.equal(
    routeSelection({ view: { kind: "home" } }, plans, routed),
    undefined,
  );
});

test("a routed saved variant selects its frame in the scheme that the layout names", () => {
  const variant = workspace("components/action/default", true);
  const plans = workspaceFrames(variant, EVERY_FRAME);
  const route = { view: { kind: "home" } } as const;
  const path = "components/action/default";
  assert.deepEqual(
    routeSelection(route, plans, { path, savedVariant: true, scheme: "light" }),
    { frame: "components/action/default:light" },
  );
  assert.deepEqual(
    routeSelection(route, plans, { path, savedVariant: true, scheme: "dark" }),
    { frame: "components/action/default:dark" },
  );
  // The set's own route selects no frame.
  assert.equal(
    routeSelection(route, plans, {
      path: "components/action",
      savedVariant: false,
      scheme: "light",
    }),
    undefined,
  );
});

test("in the compact layout a set's selected frame moves to its row's frame of the selection's scheme", () => {
  const plans = workspaceFrames(
    workspace("components/action/default", true),
    EVERY_FRAME,
  );
  const light = "components/action/default:light";
  assert.equal(
    schemeFrame(plans, light, "dark"),
    "components/action/default:dark",
  );
  assert.equal(schemeFrame(plans, light, "light"), undefined);
  assert.equal(schemeFrame(plans, undefined, "dark"), undefined);
  // A row without a dark frame keeps its Light frame.
  const lightOnly = workspaceFrames(
    workspace("components/action/default", false),
    EVERY_FRAME,
  );
  assert.equal(schemeFrame(lightOnly, light, "dark"), undefined);
});
