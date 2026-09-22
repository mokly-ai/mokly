import assert from "node:assert/strict";
import test from "node:test";

import type { ChangedView } from "../packages/viewer/dist/shell/view_marks.js";
import {
  changedViewsLabel,
  orderChangedViews,
  viewMarks,
} from "../packages/viewer/dist/shell/view_marks.js";

const DARK_ONLY: readonly ChangedView[] = [
  { viewport: "mobile", colorScheme: "dark" },
  { viewport: "desktop", colorScheme: "dark" },
];
const DESKTOP_LIGHT: readonly ChangedView[] = [
  { viewport: "desktop", colorScheme: "light" },
];

test("no evidence never marks a control", () => {
  for (const viewport of ["both", "mobile", "desktop"] as const)
    for (const scheme of ["light", "dark"] as const)
      assert.deepEqual(viewMarks([], viewport, scheme), {
        scheme: false,
        viewport: false,
      });
});

test("the theme control is marked only when another scheme changed", () => {
  assert.deepEqual(viewMarks(DARK_ONLY, "both", "light"), {
    scheme: true,
    viewport: false,
  });
  assert.deepEqual(viewMarks(DARK_ONLY, "both", "dark"), {
    scheme: false,
    viewport: false,
  });
});

test("a light-only catalogue never marks the theme control in light", () => {
  assert.equal(
    viewMarks(
      [
        { viewport: "mobile", colorScheme: "light" },
        { viewport: "desktop", colorScheme: "light" },
      ],
      "both",
      "light",
    ).scheme,
    false,
  );
});

test("the viewport control is marked only when another viewport changed", () => {
  assert.equal(viewMarks(DESKTOP_LIGHT, "mobile", "light").viewport, true);
  assert.equal(viewMarks(DESKTOP_LIGHT, "desktop", "light").viewport, false);
});

test("selecting both viewports never marks the viewport control", () => {
  assert.equal(viewMarks(DESKTOP_LIGHT, "both", "light").viewport, false);
  assert.equal(viewMarks(DARK_ONLY, "both", "dark").viewport, false);
});

test("a dark-only change marks both controls while mobile light is shown", () => {
  assert.deepEqual(viewMarks(DARK_ONLY, "mobile", "light"), {
    scheme: true,
    viewport: true,
  });
});

test("changed views are ordered and named mobile first, light before dark", () => {
  assert.deepEqual(
    orderChangedViews([
      { viewport: "desktop", colorScheme: "dark" },
      { viewport: "mobile", colorScheme: "light" },
      { viewport: "desktop", colorScheme: "dark" },
      { viewport: "mobile", colorScheme: "dark" },
    ]),
    [
      { viewport: "mobile", colorScheme: "light" },
      { viewport: "mobile", colorScheme: "dark" },
      { viewport: "desktop", colorScheme: "dark" },
    ],
  );
  assert.equal(changedViewsLabel(DARK_ONLY), "Mobile · Dark, Desktop · Dark");
  assert.equal(changedViewsLabel([]), "");
});
