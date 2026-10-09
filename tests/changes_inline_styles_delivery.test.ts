import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { exportCatalogue } from "../dist/export/run.js";
import { readManifest } from "../dist/registry/manifest.js";
import { prepareReviewRepository } from "../dist/review/prepare.js";
import { ComponentChangeCache } from "../dist/server/component_change_cache.js";
import { RepositoryComponentChanges } from "../dist/server/component_changes.js";
import { configuredServedReview } from "../dist/server/configured_review.js";
import { startCatalogueServer } from "../dist/server/http.js";
import { parseReviewResult } from "../packages/viewer/dist/review/result_validation.js";

import { committedReviewRepository } from "./helpers/committed_repository.js";
import { inlineChangesFixture } from "./helpers/inline_changes.js";

test("inline ownership agrees across live, complete, selected and publication boundaries", async (t) => {
  const fixture = await inlineChangesFixture(
    t,
    "<style>.entry{color:red}</style>",
    "<style>.entry{color:blue}</style>",
  );
  const manifest = readManifest(fixture.config);
  const prepared = await prepareReviewRepository(fixture.config, "main");
  const cache = new ComponentChangeCache(
    new RepositoryComponentChanges(
      fixture.config,
      manifest,
      "main",
      undefined,
      undefined,
      {
        commit: prepared.commit,
        selection: prepared.selection,
        descriptor: prepared.descriptor,
      },
    ),
  );
  const snapshot = await cache.read(1);
  assert.ok(snapshot?.result);
  const artifact = await fixture.complete();
  assert.equal(artifact.result.schemaVersion, 7);
  if (artifact.result.schemaVersion !== 7) return;
  assert.deepEqual(snapshot.result, artifact.result);
  assert.ok(
    artifact.result.screens
      .find((screen) => screen.path === "home")!
      .views.every(
        (view) =>
          view.inlineStyles?.status === "matched" &&
          JSON.stringify(view.inlineStyles.selectors) ===
            JSON.stringify([".entry"]),
      ),
  );

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
    `${server.url}/mokly-viewer/diffs/review.json?path=home`,
  );
  assert.equal(response.status, 200, await response.clone().text());
  const selected = parseReviewResult(await response.json());
  assert.deepEqual(selected.screens, [
    artifact.result.screens.find((screen) => screen.path === "home"),
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
