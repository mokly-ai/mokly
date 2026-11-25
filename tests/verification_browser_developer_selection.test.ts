/** Which developer browser arguments can narrow the global setup fixtures. */
import assert from "node:assert/strict";
import test from "node:test";

import { browserSelectionArguments } from "../scripts/verification/browser-developer-selection.mjs";

const cases: {
  name: string;
  args: string[];
  selection: string[] | undefined;
}[] = [
  { name: "a complete run", args: [], selection: undefined },
  {
    name: "a spec with a title filter",
    args: ["tests/browser/pages.spec.ts", "-g", "retain metadata"],
    selection: ["tests/browser/pages.spec.ts", "-g", "retain metadata"],
  },
  {
    name: "spec filters with equals and inverted title filters",
    args: ["pages", "--grep=anchors", "--grep-invert", "1280px", "-G", "x"],
    selection: [
      "pages",
      "--grep=anchors",
      "--grep-invert",
      "1280px",
      "-G",
      "x",
    ],
  },
  {
    name: "a title filter without a spec filter",
    args: ["-g", "retain metadata"],
    selection: undefined,
  },
  {
    name: "a title flag without its value",
    args: ["tests/browser/pages.spec.ts", "-g"],
    selection: undefined,
  },
  {
    name: "a spec with another flag",
    args: ["tests/browser/pages.spec.ts", "--headed"],
    selection: undefined,
  },
  {
    name: "a spec with a flag that changes the selection",
    args: ["tests/browser/pages.spec.ts", "--last-failed"],
    selection: undefined,
  },
];

for (const scenario of cases) {
  test(`browser selection arguments: ${scenario.name}`, () => {
    assert.deepEqual(
      browserSelectionArguments(scenario.args),
      scenario.selection,
    );
  });
}
