import assert from "node:assert/strict";
import { test } from "node:test";

import { compareFrames, offeredModes } from "../src/shell/compare_modes.js";
import type { EntryStatus } from "../src/shell/view_status.js";

const EVERY_MODE = ["current", "side", "overlay", "difference", "swipe"];

test("eligible views offer every mode, a shown Added status Current alone, and other views and a removed screen none", () => {
  const cases: readonly [
    name: string,
    eligible: boolean,
    removedScreen: boolean,
    status: EntryStatus | undefined,
    offered: readonly string[],
  ][] = [
    ["a changed view", true, false, "Changed", EVERY_MODE],
    [
      "an unmodified view that uses a changed component",
      true,
      false,
      "Unmodified",
      EVERY_MODE,
    ],
    ["a removed component", true, false, "Removed", EVERY_MODE],
    ["an added view", false, false, "Added", ["current"]],
    ["an unmodified view", false, false, "Unmodified", []],
    ["a view whose status is not known yet", false, false, undefined, []],
    ["a removed screen", false, true, "Removed", []],
    ["a removed screen with an eligible comparison", true, true, "Removed", []],
  ];
  for (const [name, eligible, removedScreen, status, offered] of cases)
    assert.deepEqual(
      offeredModes({ eligible, removedScreen, status }),
      offered,
      name,
    );
});

test("Side by side has a chip for each shown frame whose row compares, in the canvas's order, named by the frame and drawn by its kind, and a removed entry one for each of its views", () => {
  const plans = new Map([
    [
      "home:desktop:light",
      { key: "home:desktop:light", kind: "desktop", name: "Desktop · Light" },
    ],
    // The routed row's frame, which does not compare, as on a set whose
    // routed row is unmodified.
    [
      "action:light",
      { key: "action:light", kind: "component", name: "Action · Light" },
    ],
    [
      "home:mobile:light",
      { key: "home:mobile:light", kind: "mobile", name: "Mobile · Light" },
    ],
    [
      "action/default:dark",
      { key: "action/default:dark", kind: "component", name: "Default · Dark" },
    ],
  ] as const);
  const compared = [
    { key: "home:desktop:light" },
    { key: "home:mobile:light" },
    { key: "action/default:dark" },
  ];
  assert.deepEqual(compareFrames(plans, compared), [
    { key: "home:desktop:light", kind: "desktop", label: "Desktop · Light" },
    { key: "home:mobile:light", kind: "mobile", label: "Mobile · Light" },
    {
      key: "action/default:dark",
      kind: "component",
      label: "Default · Dark",
    },
  ]);
  // A removed component or variant has no live frames, so it passes no
  // compared frames, and each of its own views compares.
  const removed = new Map([
    [
      "action/retired:light",
      {
        key: "action/retired:light",
        kind: "component",
        name: "Retired · Light",
      },
    ],
    [
      "action/retired:dark",
      { key: "action/retired:dark", kind: "component", name: "Retired · Dark" },
    ],
  ] as const);
  assert.deepEqual(compareFrames(removed, undefined), [
    {
      key: "action/retired:light",
      kind: "component",
      label: "Retired · Light",
    },
    { key: "action/retired:dark", kind: "component", label: "Retired · Dark" },
  ]);
});
