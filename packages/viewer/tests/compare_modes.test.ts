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

test("Side by side has a chip for each frame that the canvas shows, in its order, named by the frame and drawn by its kind", () => {
  assert.deepEqual(
    compareFrames(
      new Map([
        [
          "home:desktop:light",
          {
            key: "home:desktop:light",
            kind: "desktop",
            name: "Desktop · Light",
          },
        ],
        [
          "home:mobile:light",
          { key: "home:mobile:light", kind: "mobile", name: "Mobile · Light" },
        ],
        [
          "action/default:dark",
          {
            key: "action/default:dark",
            kind: "component",
            name: "Default · Dark",
          },
        ],
      ] as const),
    ),
    [
      { key: "home:desktop:light", kind: "desktop", label: "Desktop · Light" },
      { key: "home:mobile:light", kind: "mobile", label: "Mobile · Light" },
      {
        key: "action/default:dark",
        kind: "component",
        label: "Default · Dark",
      },
    ],
  );
});
