import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { readCatalogue } from "../packages/viewer/dist/catalogue/reader.js";
import { viewHref } from "../packages/viewer/dist/data.js";
import type { StaticDelivery } from "../packages/viewer/dist/navigation/delivery.js";
import { routeFromUrl } from "../packages/viewer/dist/shell/routes.js";
import { viewerCatalogue } from "../packages/viewer/dist/viewer/projection.js";

const fixture = readCatalogue(
  JSON.parse(
    fs.readFileSync(
      new URL("../docs/protocol/fixtures/catalogue-v3.json", import.meta.url),
      "utf8",
    ),
  ),
);
const current = fixture.pages[0]!;
const source = fixture.removedEntries.find(
  ({ entry }) => entry.kind === "page",
)!;
const snapshotId = "f".repeat(64);
const historical = {
  ...source,
  entry: {
    ...source.entry,
    id: current.id,
    title: "Archived guide",
  },
  snapshotId,
};
const catalogue = viewerCatalogue({
  ...fixture,
  removedEntries: [...fixture.removedEntries, historical],
});
const delivery: StaticDelivery = {
  schemaVersion: 2,
  deploymentId: fixture.deploymentId,
  canonicalPath: viewHref(current.kind, current.id),
  comparisonUrl: null,
  idRoutes: { [current.id]: viewHref(current.kind, current.id) },
};

test("provider-normalized history resolves the exact retained id", () => {
  const resolved = routeFromUrl(
    catalogue,
    new URL(`https://catalogue.test/view/pages/guide?snapshot=${snapshotId}`),
    delivery,
  );
  assert.equal(resolved.view.kind, "target");
  assert.equal(
    resolved.view.kind === "target" ? resolved.view.target.entry.id : undefined,
    historical.entry.id,
  );
  assert.equal(
    resolved.view.kind === "target"
      ? resolved.view.target.entry.title
      : undefined,
    "Archived guide",
  );
  assert.equal(resolved.snapshot, snapshotId);

  const inferred = routeFromUrl(
    catalogue,
    new URL("https://catalogue.test/view/pages/guide"),
    delivery,
  );
  assert.equal(inferred.view.kind, "target");
  assert.equal(inferred.snapshot, undefined);
});

test("provider normalization does not loosen historical identity", () => {
  for (const url of [
    `https://catalogue.test/view/pages/guide?snapshot=${"e".repeat(64)}`,
    `https://catalogue.test/view/pages/missing?snapshot=${snapshotId}`,
  ])
    assert.equal(
      routeFromUrl(catalogue, new URL(url), delivery).view.kind,
      "missing",
      url,
    );
});
