import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { exportCatalogue } from "../dist/export/run.js";
import { readManifest } from "../dist/registry/manifest.js";
import { committedReviewRepository } from "../dist/review/repository.js";
import {
  ComponentChangeCache,
  RepositoryComponentChanges,
} from "../dist/server/component_changes.js";
import { configuredServedReview } from "../dist/server/configured_review.js";
import { startCatalogueServer } from "../dist/server/http.js";
import { parseReviewResult } from "../packages/viewer/dist/review/result_validation.js";

import { inlineChangesFixture } from "./helpers/inline_changes.js";

test("inline ownership agrees across live, complete, selected and publication boundaries", async (t) => {
  const fixture = await inlineChangesFixture(
    t,
    "<style>.actual-only{color:red}</style>",
    "<style>.actual-only{color:blue}</style>",
  );
  const manifest = readManifest(fixture.config);
  const cache = new ComponentChangeCache(
    new RepositoryComponentChanges(fixture.config, manifest, "main"),
  );
  const snapshot = await cache.read(1);
  assert.ok(snapshot?.result);
  const artifact = await fixture.complete();
  assert.equal(artifact.result.schemaVersion, 3);
  if (artifact.result.schemaVersion !== 3) return;
  assert.deepEqual(snapshot.result, artifact.result);

  const server = await startCatalogueServer(fixture.config, {
    base: "main",
    port: 0,
    manifest,
    componentChanges: snapshot,
    review: configuredServedReview(
      fixture.config,
      "main",
      committedReviewRepository(fixture.config),
    ),
  });
  t.after(() => server.close());
  const response = await fetch(
    `${server.url}/__mokly/diffs/review.json?route=screens%2Fhome.html`,
  );
  assert.equal(response.status, 200, await response.clone().text());
  const selected = parseReviewResult(await response.json());
  assert.deepEqual(selected.screens, [
    artifact.result.screens.find((screen) => screen.id === "home"),
  ]);

  const exported = await exportCatalogue(fixture.config, {
    outDir: "site-inline",
    base: "main",
  });
  assert.ok(exported.comparisonUrl);
  const published = parseReviewResult(
    JSON.parse(
      await fs.readFile(
        path.join(exported.outDir, exported.comparisonUrl),
        "utf8",
      ),
    ),
  );
  assert.deepEqual(published, artifact.result);
});
