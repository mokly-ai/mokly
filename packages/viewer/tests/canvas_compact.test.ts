import assert from "node:assert/strict";
import { test } from "node:test";

import type { CatalogueReadModel } from "@mokly/model";

import type { ShellCatalogueRoutedEntry } from "../src/catalogue/scoped_types.js";
import {
  compactFrames,
  frameChoices,
  pickedAlone,
  pickedFrameKey,
  pickedScreenFrame,
  pickerFrames,
} from "../src/shell/canvas_compact.js";
import { EVERY_FRAME, workspaceFrames } from "../src/shell/canvas_frames.js";
import { createCatalogue } from "../src/shell/catalogue.js";
import { publicWorkspace } from "../src/shell/public_workspace.js";

import { indexFixture, shellModelFixture } from "./catalogue_v9_fixture.js";

/** Give each screen and component of the index a dark render of each view. */
function withDarkViews(index: CatalogueReadModel): void {
  for (const entry of [...index.screens, ...index.components]) {
    entry.colorSchemes = ["light", "dark"];
    entry.views = entry.views.flatMap((view) => [
      view,
      { ...view, colorScheme: "dark" as const },
    ]);
  }
}

/** The frames of one routed path on the compact canvas, before a pick. */
function frames(path: string, dark: boolean) {
  const model = shellModelFixture(
    indexFixture(dark ? withDarkViews : undefined),
  );
  const catalogue = createCatalogue(model);
  const entry = catalogue.byPath.get(path) as ShellCatalogueRoutedEntry;
  assert.ok(entry.kind === "screen" || entry.kind === "component", path);
  const data = publicWorkspace(catalogue, model, entry);
  return workspaceFrames(data, EVERY_FRAME, data.views);
}

test("the picker lists a screen's frames Mobile first, Light before Dark, and a set's in its order", () => {
  assert.deepEqual(
    pickerFrames(frames("product/browse/home", true)).map(
      ({ kind, label, value }) => [kind, label, value],
    ),
    [
      ["mobile", "Mobile · Light", "mobile-light"],
      ["mobile", "Mobile · Dark", "mobile-dark"],
      ["desktop", "Desktop · Light", "desktop-light"],
      ["desktop", "Desktop · Dark", "desktop-dark"],
    ],
  );
  assert.deepEqual(
    pickerFrames(frames("components/action/default", true)).map(
      (frame) => frame.label,
    ),
    ["Action · Light", "Action · Dark", "Default · Light", "Default · Dark"],
  );
});

test("a screen shows the frame of the selection's viewport and scheme, Both read as Mobile", () => {
  const screen = frames("product/browse/home", true);
  const pick = (
    viewport: "both" | "desktop" | "mobile",
    colorScheme: "dark" | "light",
  ) => pickedScreenFrame(screen, { colorScheme, viewport });
  assert.equal(pick("both", "light"), "mobile-light");
  assert.equal(pick("both", "dark"), "mobile-dark");
  assert.equal(pick("desktop", "dark"), "desktop-dark");
  // A screen without a dark view keeps the viewport's Light frame.
  const light = frames("product/browse/home", false);
  assert.equal(
    pickedScreenFrame(light, { colorScheme: "dark", viewport: "both" }),
    "mobile-light",
  );
  assert.equal(
    pickedScreenFrame(light, { colorScheme: "dark", viewport: "desktop" }),
    "desktop-light",
  );
});

test("frames keyed by viewport and scheme, as a removed screen's, pick the same way, or fall back to the first", () => {
  const removed = [
    { key: "desktop-light" },
    { key: "mobile-light" },
    { key: "desktop-dark" },
  ];
  assert.equal(
    pickedFrameKey(removed, { colorScheme: "dark", viewport: "desktop" }),
    "desktop-dark",
  );
  assert.equal(
    pickedFrameKey(removed, { colorScheme: "dark", viewport: "both" }),
    "mobile-light",
  );
  assert.equal(
    pickedFrameKey([{ key: "desktop-light" }], {
      colorScheme: "light",
      viewport: "mobile",
    }),
    "desktop-light",
  );
  assert.equal(
    pickedFrameKey([], { colorScheme: "light", viewport: "both" }),
    undefined,
  );
});

test("a picker lists frames in their order, and a pick stands alone in the first cell", () => {
  const steps: {
    column: number;
    hidden?: boolean;
    key: string;
    kind: "mobile";
    label: string;
    row: number;
  }[] = [
    { column: 0, key: "step-0", kind: "mobile", label: "1 · Home", row: 0 },
    { column: 1, key: "step-1", kind: "mobile", label: "2 · Save", row: 0 },
  ];
  assert.deepEqual(frameChoices(steps), [
    { kind: "mobile", label: "1 · Home", value: "step-0" },
    { kind: "mobile", label: "2 · Save", value: "step-1" },
  ]);
  assert.deepEqual(
    pickedAlone(steps, "step-1").map(({ column, hidden, key }) => [
      key,
      column,
      hidden,
    ]),
    [
      ["step-0", 0, true],
      ["step-1", 0, false],
    ],
  );
});

test("the compact canvas holds the picked frame alone, and a screen frame leads with the entry's slug", () => {
  const screen = frames("product/browse/home", true);
  assert.deepEqual(
    compactFrames(screen, "mobile-dark").map((frame) => [
      frame.key,
      frame.hidden ?? false,
      frame.column,
      frame.row,
      frame.label,
    ]),
    [
      ["desktop-light", true, 0, 0, "Desktop · Light"],
      ["mobile-light", true, 1, 0, "Mobile · Light"],
      ["desktop-dark", true, 0, 1, "Desktop · Dark"],
      ["mobile-dark", false, 0, 0, "home · Mobile · Dark"],
    ],
  );
  const set = frames("components/action/default", true);
  const picked = compactFrames(set, "components/action/default:light").find(
    (frame) => !frame.hidden,
  );
  assert.equal(picked?.label, "Default · Light");
  // Without a picked frame, as for a whole variant set, every frame shows.
  assert.equal(compactFrames(set, undefined), set);
});
