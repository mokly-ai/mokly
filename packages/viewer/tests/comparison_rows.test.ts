/**
 * The frames that a compare draws for a removed component or variant, which
 * has no live frames: one for each desktop view of its comparison, of the
 * schemes that the Frames filter shows, as a variant set's row draws them.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { ComparedEntry, ReviewView } from "../src/review/types.js";
import { removedComparisonPlans } from "../src/shell/comparison_rows.js";
import type { FramesChoice } from "../src/shell/frames_filter.js";

const ENTRY = { path: "components/card/archived", title: "Archived" };

/** Every frame shown, as a full page load starts. */
const EVERY: FramesChoice = {
  dark: true,
  desktop: true,
  light: true,
  mobile: true,
};

function view(
  viewport: "desktop" | "mobile",
  colorScheme: "dark" | "light",
): ReviewView {
  return { viewport, colorScheme, state: "removed", ignoredIds: [] };
}

function compared(views: readonly ReviewView[]): ComparedEntry {
  return { path: ENTRY.path, basePath: ENTRY.path, reasons: [], views };
}

/** The place, the key and the name of each frame that the compare draws. */
function frames(entry: ComparedEntry, choice: FramesChoice) {
  return removedComparisonPlans(entry, ENTRY, choice).map(
    ({ column, key, name }) => ({ column, key, name }),
  );
}

const LIGHT = {
  key: "components/card/archived:light",
  name: "Archived · Light",
};
const DARK = { key: "components/card/archived:dark", name: "Archived · Dark" };

test("a removed variant's compare draws the desktop views of the schemes that the Frames filter shows", () => {
  const both = compared([
    view("desktop", "light"),
    view("desktop", "dark"),
    view("mobile", "light"),
    view("mobile", "dark"),
  ]);
  assert.deepEqual(frames(both, EVERY), [
    { column: 0, ...LIGHT },
    { column: 1, ...DARK },
  ]);
  assert.deepEqual(frames(both, { ...EVERY, light: false }), [
    { column: 0, ...DARK },
  ]);
  assert.deepEqual(frames(both, { ...EVERY, dark: false }), [
    { column: 0, ...LIGHT },
  ]);
});

test("a removed variant without a dark view keeps its Light frame while the filter shows Dark alone", () => {
  const light = compared([view("desktop", "light"), view("mobile", "light")]);
  assert.deepEqual(frames(light, { ...EVERY, light: false }), [
    { column: 0, ...LIGHT },
  ]);
});
