/** Which developer browser arguments can narrow the global setup fixtures. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  browserSelectionArguments,
  selectionNeedsCopiedHost,
} from "../scripts/verification/browser-developer-selection.mjs";

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

const spec = "tests/browser/pages.spec.ts";
const decisions: {
  name: string;
  args: string[];
  listed: string[] | Error;
  readers: string[];
  needed: boolean;
}[] = [
  {
    name: "a complete run",
    args: [],
    listed: [spec],
    readers: [],
    needed: true,
  },
  {
    name: "a failed list",
    args: [spec],
    listed: new Error("no tests"),
    readers: [],
    needed: true,
  },
  {
    name: "listed specs that do not read it",
    args: [spec, "-g", "metadata"],
    listed: [spec],
    readers: [],
    needed: false,
  },
  {
    name: "a listed spec that reads it",
    args: ["static"],
    listed: ["tests/browser/static_a.spec.ts", spec],
    readers: ["tests/browser/static_a.spec.ts"],
    needed: true,
  },
];

for (const scenario of decisions) {
  test(`copied example decision: ${scenario.name}`, async () => {
    const lists: (readonly string[])[] = [];
    const needed = await selectionNeedsCopiedHost(scenario.args, {
      list: async (filters) => {
        lists.push(filters);
        if (scenario.listed instanceof Error) throw scenario.listed;
        return scenario.listed;
      },
      readers: async (files) =>
        new Set(files.filter((file) => scenario.readers.includes(file))),
    });
    assert.equal(needed, scenario.needed);
    assert.deepEqual(lists, scenario.args.length ? [scenario.args] : []);
  });
}
