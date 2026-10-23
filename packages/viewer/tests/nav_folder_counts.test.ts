import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToString } from "react-dom/server";

import { MoklyViewer } from "../src/viewer/component.js";
import type { ViewerSelection } from "../src/viewer/types.js";

import { detailFixture, rawIndexFixture } from "./catalogue_v7_fixture.js";

/**
 * The protocol catalogue with Details neither moved nor changed, so Browse
 * holds one changed screen, Home (tagged `landing`), beside the unchanged
 * Details.
 */
function catalogue() {
  const model = rawIndexFixture();
  const details = model.screens.find(
    (entry) => entry.path === "product/browse/details",
  );
  assert.ok(details);
  delete details.previousPath;
  details.changes = { status: "ready", included: false, kind: "unmodified" };
  return model;
}

/**
 * Each folder's count as the first render shows it under one selection. Only
 * the embedded viewer starts from a filtered selection, so it renders here.
 */
function counts(selection: Partial<ViewerSelection>) {
  const html = renderToString(
    createElement(MoklyViewer, {
      index: catalogue(),
      baseUrl: "https://catalogue.test",
      detail: (path, snapshotId) =>
        detailFixture(
          snapshotId === undefined ? { path } : { path, snapshotId },
        ),
      defaultSelection: { screenPath: "guide", ...selection },
    }),
  );
  return Object.fromEntries(
    ["folder:product", "folder:product/browse"].map((folder) => {
      const summary = html
        .slice(html.indexOf(`data-nav-folder="${folder}"`))
        .split("</summary>")[0]!;
      return [folder, /class="mbk-nav-count">(\d+)</u.exec(summary)?.[1]];
    }),
  );
}

test("All counts every child row a folder shows", () => {
  assert.deepEqual(counts({ view: "all" }), {
    "folder:product": "2",
    "folder:product/browse": "2",
  });
});

test("Changes counts only the child rows it keeps", () => {
  assert.deepEqual(counts({ view: "changes" }), {
    "folder:product": "2",
    "folder:product/browse": "1",
  });
});

test("search and tags count only the child rows they keep", () => {
  for (const selection of [{ search: "home" }, { tags: ["landing"] }] as const)
    assert.deepEqual(
      counts(selection),
      { "folder:product": "1", "folder:product/browse": "1" },
      JSON.stringify(selection),
    );
});
