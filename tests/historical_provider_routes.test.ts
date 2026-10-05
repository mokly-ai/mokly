import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { readCatalogue } from "../packages/viewer/dist/catalogue/reader.js";
import { viewHref } from "../packages/viewer/dist/data.js";
import { routeFromUrl } from "../packages/viewer/dist/shell/routes.js";
import { viewerCatalogue } from "../packages/viewer/dist/viewer/projection.js";

const fixture = readCatalogue(
  JSON.parse(
    fs.readFileSync(
      new URL("../docs/protocol/fixtures/catalogue-v5.json", import.meta.url),
      "utf8",
    ),
  ),
);
const historical = fixture.removedEntries.find(
  ({ entry }) => entry.kind === "page",
)!;
const snapshotId = historical.snapshotId!;
const catalogue = viewerCatalogue(fixture);

test("provider-normalized history resolves the exact retained id", () => {
  const href = viewHref(historical.entry.path).replace(/\.html$/, "");
  const resolved = routeFromUrl(
    catalogue,
    new URL(`https://catalogue.test${href}?snapshot=${snapshotId}`),
  );
  assert.equal(resolved.view.kind, "target");
  assert.equal(
    resolved.view.kind === "target"
      ? resolved.view.target.entry.path
      : undefined,
    historical.entry.path,
  );
  assert.equal(
    resolved.view.kind === "target"
      ? resolved.view.target.entry.title
      : undefined,
    historical.entry.title,
  );
  assert.equal(resolved.snapshot, snapshotId);

  const inferred = routeFromUrl(
    catalogue,
    new URL(`https://catalogue.test${href}`),
  );
  assert.equal(inferred.view.kind, "target");
  assert.equal(inferred.snapshot, snapshotId);
});

test("provider normalization does not loosen historical identity", () => {
  for (const url of [
    `https://catalogue.test/view/pages/${historical.entry.path}?snapshot=${"e".repeat(64)}`,
    `https://catalogue.test/view/pages/missing?snapshot=${snapshotId}`,
  ])
    assert.equal(
      routeFromUrl(catalogue, new URL(url)).view.kind,
      "missing",
      url,
    );
});
