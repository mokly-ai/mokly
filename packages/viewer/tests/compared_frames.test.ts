import assert from "node:assert/strict";
import { test } from "node:test";

import type { ComparedEntry, ReviewView } from "../src/review/types.js";
import {
  comparedFrames,
  comparedRowDocuments,
  type ComparedFramePlan,
  type ComparedRow,
} from "../src/shell/comparison_selection.js";

const ONE = "https://catalogue.test/mokly-viewer/diffs/generations/one/";
const TWO = "https://catalogue.test/mokly-viewer/diffs/generations/two/";

function view(
  viewport: "desktop" | "mobile",
  colorScheme: "dark" | "light",
  state: ReviewView["state"] = "changed",
): ReviewView {
  return { colorScheme, ignoredIds: [], state, viewport };
}

function row(path: string, views: readonly ReviewView[]): ComparedRow {
  const compared: ComparedEntry = {
    basePath: path,
    path,
    reasons: [{ kind: "material" }],
    views,
  };
  return { compared, usingChanged: new Set() };
}

function frame(
  path: string,
  scheme: "dark" | "light",
  viewport: "desktop" | "mobile" = "desktop",
): ComparedFramePlan {
  return { entry: { path }, key: `${path}:${scheme}`, scheme, viewport };
}

const ACTION = "example/components/action";
const DEFAULT = "example/components/action/default";

test("each frame of a variant set reads its own row's documents from that row's generation", () => {
  const rows = new Map([
    [ACTION, row(ACTION, [view("desktop", "light"), view("desktop", "dark")])],
    [DEFAULT, row(DEFAULT, [view("desktop", "light")])],
  ]);
  const frames = comparedFrames(
    [
      frame(ACTION, "light"),
      frame(ACTION, "dark"),
      frame(DEFAULT, "light"),
      frame("example/components/action/disabled", "light"),
    ],
    new Map([
      [ACTION, { url: ONE }],
      [DEFAULT, { url: TWO }],
    ]),
    (entry) => rows.get(entry),
  );
  assert.deepEqual(
    frames.map(({ documents, entry, key }) => ({ documents, entry, key })),
    [
      {
        documents: {
          after: `${ONE}snapshots/after/mokly-generated/example/components/action/index.desktop.html`,
          before: `${ONE}snapshots/before/mokly-generated/example/components/action/index.desktop.html`,
        },
        entry: ACTION,
        key: `${ACTION}:light`,
      },
      {
        documents: {
          after: `${ONE}snapshots/after/mokly-generated/example/components/action/index.desktop.dark.html`,
          before: `${ONE}snapshots/before/mokly-generated/example/components/action/index.desktop.dark.html`,
        },
        entry: ACTION,
        key: `${ACTION}:dark`,
      },
      {
        documents: {
          after: `${TWO}snapshots/after/mokly-generated/example/components/action/default/index.desktop.html`,
          before: `${TWO}snapshots/before/mokly-generated/example/components/action/default/index.desktop.html`,
        },
        entry: DEFAULT,
        key: `${DEFAULT}:light`,
      },
    ],
  );
  assert.deepEqual(comparedRowDocuments(frames), [
    {
      addresses: [
        `${ONE}snapshots/before/mokly-generated/example/components/action/index.desktop.html`,
        `${ONE}snapshots/after/mokly-generated/example/components/action/index.desktop.html`,
        `${ONE}snapshots/before/mokly-generated/example/components/action/index.desktop.dark.html`,
        `${ONE}snapshots/after/mokly-generated/example/components/action/index.desktop.dark.html`,
      ],
      entry: ACTION,
    },
    {
      addresses: [
        `${TWO}snapshots/before/mokly-generated/example/components/action/default/index.desktop.html`,
        `${TWO}snapshots/after/mokly-generated/example/components/action/default/index.desktop.html`,
      ],
      entry: DEFAULT,
    },
  ]);
});

test("a frame compares its own viewport and scheme, a missing side, and a moved base path", () => {
  const home = row("home", [
    view("mobile", "light"),
    view("desktop", "light", "added"),
    view("desktop", "dark", "removed"),
  ]);
  const moved: ComparedRow = {
    ...home,
    compared: { ...home.compared, basePath: "Earlier/Home" },
  };
  const frames = comparedFrames(
    [
      frame("home", "light", "mobile"),
      frame("home", "dark", "mobile"),
      frame("home", "light"),
      frame("home", "dark"),
    ],
    new Map([["home", { url: ONE }]]),
    () => moved,
  );
  assert.deepEqual(
    frames.map(({ documents, lightOnly, view }) => ({
      documents,
      lightOnly,
      scheme: view.colorScheme,
    })),
    [
      {
        documents: {
          after: `${ONE}snapshots/after/mokly-generated/home/index.mobile.html`,
          before: `${ONE}snapshots/before/mokly-generated/Earlier/Home/index.mobile.html`,
        },
        lightOnly: false,
        scheme: "light",
      },
      {
        documents: {
          after: `${ONE}snapshots/after/mokly-generated/home/index.mobile.html`,
          before: `${ONE}snapshots/before/mokly-generated/Earlier/Home/index.mobile.html`,
        },
        lightOnly: true,
        scheme: "light",
      },
      {
        documents: {
          after: `${ONE}snapshots/after/mokly-generated/home/index.desktop.html`,
        },
        lightOnly: false,
        scheme: "light",
      },
      {
        documents: {
          before: `${ONE}snapshots/before/mokly-generated/Earlier/Home/index.desktop.dark.html`,
        },
        lightOnly: false,
        scheme: "dark",
      },
    ],
  );
});
