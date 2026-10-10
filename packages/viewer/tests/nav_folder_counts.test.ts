import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { renderViewer } from "../src/viewer/server.js";
import type { ViewerSelection } from "../src/viewer/types.js";

/**
 * The protocol catalogue with Details neither moved nor changed, so Browse
 * holds one changed screen, Home (tagged `landing`), beside the unchanged
 * Details.
 */
function catalogue() {
  const model = JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../docs/protocol/fixtures/catalogue-v6.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const details = model.screens.find(
    (entry: { path: string }) => entry.path === "product/browse/details",
  );
  delete details.previousPath;
  details.changes = { status: "ready", included: false, kind: "unmodified" };
  return model;
}

/** Each folder's count as the server renders it under one selection. */
function counts(selection: Partial<ViewerSelection>) {
  const html = renderViewer({
    viewerId: "counts",
    catalogue: catalogue(),
    baseUrl: "https://catalogue.example",
    defaultSelection: { screenPath: "guide", ...selection },
  });
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
