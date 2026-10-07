import assert from "node:assert/strict";
import test from "node:test";

import { readManifest } from "../dist/registry/manifest.js";
import { readCatalogueChanges } from "../dist/server/component_changes.js";
import { configuredServedReview } from "../dist/server/configured_review.js";
import { startCatalogueServer } from "../dist/server/http.js";
import { readCatalogue } from "../packages/viewer/src/catalogue/reader.js";

import { committedReviewRepository } from "./helpers/committed_repository.js";
import { createRemovedDeliveryFixture } from "./helpers/removed_delivery_fixture.js";

test("Serve publishes snapshot ids when a local comparison request gains a public URL", async (t) => {
  const fixture = await createRemovedDeliveryFixture();
  t.after(() => fixture.close());
  const repository = committedReviewRepository(fixture.config);
  const manifest = readManifest(fixture.config);
  const changes = await readCatalogueChanges(
    fixture.config,
    manifest,
    "origin/main",
    repository,
    fixture.baseCommit,
  );
  const server = await startCatalogueServer(fixture.config, {
    base: "origin/main",
    changesStatus: "ready",
    componentChanges: changes,
    manifest,
    port: 0,
    review: configuredServedReview(fixture.config, "origin/main", repository),
  });
  t.after(() => server.close());
  const read = async () =>
    (await fetch(server.url + "/mokly-viewer/catalogue.json")).json();
  const before = readCatalogue(await read());
  assert.equal(before.comparisonUrl, null);
  assert.ok(before.removedEntries.length > 0);
  assert.ok(
    before.removedEntries.every((entry) =>
      /^[a-f0-9]{64}$/.test(entry.snapshotId ?? ""),
    ),
  );

  const requestPath = "mokly-viewer/diffs/review.json";
  const response = await fetch(server.url + "/" + requestPath);
  assert.equal(response.status, 200, await response.clone().text());
  const value = await read();
  const published = readCatalogue(value);
  assert.match(
    published.comparisonUrl ?? "",
    /^mokly-viewer\/diffs\/generations\/[a-f0-9]{64}\/review\.json$/,
  );
  assert.deepEqual(
    published.removedEntries.map((entry) => entry.snapshotId),
    before.removedEntries.map((entry) => entry.snapshotId),
  );
  assert.throws(
    () => readCatalogue({ ...value, comparisonUrl: requestPath }),
    /invalid comparison path/,
  );
  delete value.removedEntries[0].snapshotId;
  assert.throws(() => readCatalogue(value), {
    message:
      "[mokly/components] $catalogue: removed entry needs snapshotId when comparisonUrl is non-null",
  });
});
