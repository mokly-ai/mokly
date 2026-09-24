import assert from "node:assert/strict";
import test from "node:test";

import { readCatalogue } from "@mokly/viewer";
import { parseRemovedPagePreview, parseReviewResult } from "@mokly/viewer/data";

import { readCatalogueChanges } from "../dist/server/component_changes.js";
import { configuredServedReview } from "../dist/server/configured_review.js";
import { startCatalogueServer } from "../dist/server/http.js";

import { committedReviewRepository } from "./helpers/committed_repository.js";
import {
  createRemovedDeliveryFixture,
  REMOVED_BASELINE_IMAGE_BYTES,
} from "./helpers/removed_delivery_fixture.js";

test("Serve routes removed screens and pages without capture during browsing", async (t) => {
  const fixture = await createRemovedDeliveryFixture();
  t.after(() => fixture.close());
  const repository = committedReviewRepository(fixture.config);
  const changes = await readCatalogueChanges(
    fixture.config,
    (await import("../dist/registry/manifest.js")).readManifest(fixture.config),
    "origin/main",
    repository,
    fixture.baseCommit,
  );
  const configured = configuredServedReview(
    fixture.config,
    "origin/main",
    repository,
  );
  let pageCaptures = 0;
  let screenCaptures = 0;
  assert.ok(configured.selected);
  assert.ok(configured.pagePreview);
  const server = await startCatalogueServer(fixture.config, {
    base: "origin/main",
    changesStatus: "ready",
    componentChanges: changes,
    manifest: (await import("../dist/registry/manifest.js")).readManifest(
      fixture.config,
    ),
    port: 0,
    review: {
      ...configured,
      selected: {
        async generate(...args) {
          screenCaptures++;
          return configured.selected!.generate(...args);
        },
      },
      pagePreview: {
        async generate(...args) {
          pageCaptures++;
          return configured.pagePreview!.generate(...args);
        },
      },
    },
  });
  t.after(() => server.close());

  for (const route of [
    "/",
    "/?filter=changes&search=removed",
    "/view/screens/current.html",
    "/__mokly/catalogue.json",
  ])
    assert.equal((await fetch(`${server.url}${route}`)).status, 200, route);
  assert.equal(pageCaptures, 0);
  assert.equal(screenCaptures, 0);

  const beforeCapture = readCatalogue(
    await (await fetch(`${server.url}/__mokly/catalogue.json`)).json(),
  );
  assert.equal(beforeCapture.comparisonUrl, null);
  assert.ok(beforeCapture.removedEntries.every((entry) => !entry.preview));

  const screenResponse = await fetch(
    `${server.url}/__mokly/diffs/review.json?route=screens%2Fremoved.html`,
  );
  assert.equal(screenResponse.status, 200, await screenResponse.clone().text());
  const screen = parseReviewResult(await screenResponse.json()).screens[0]!;
  assert.equal(screen.state, "removed");
  assert.ok(screen.views.every((view) => view.beforePath && !view.afterPath));
  assert.match(
    await (
      await fetch(new URL(screen.views[0]!.beforePath!, screenResponse.url))
    ).text(),
    /Previous/,
  );
  assert.equal(screenCaptures, 1);

  const pageResponse = await fetch(
    `${server.url}/__mokly/diffs/review.json?page=archive%2Fremoved.html`,
  );
  assert.equal(pageResponse.status, 200, await pageResponse.clone().text());
  const preview = parseRemovedPagePreview(await pageResponse.json());
  assert.equal(preview.baseCommit, fixture.baseCommit);
  assert.match(
    await (await fetch(new URL(preview.documentPath, pageResponse.url))).text(),
    /Previous page/,
  );
  assert.deepEqual(
    Buffer.from(
      await (
        await fetch(
          new URL("snapshots/before/assets/past.png", pageResponse.url),
        )
      ).arrayBuffer(),
    ),
    REMOVED_BASELINE_IMAGE_BYTES,
  );
  assert.equal(pageCaptures, 1);

  const complete = await fetch(`${server.url}/__mokly/diffs/review.json`);
  assert.equal(complete.status, 200, await complete.clone().text());
  const advertised = readCatalogue(
    await (await fetch(`${server.url}/__mokly/catalogue.json`)).json(),
  );
  assert.ok(advertised.comparisonUrl);
  assert.deepEqual(
    advertised.removedEntries.map(({ entry, preview }) => [
      entry.kind,
      preview,
    ]),
    [
      ["page", undefined],
      ["screen", { kind: "screen" }],
    ],
  );
  server.publishUpdate({ kind: "evidence", changesStatus: "pending" });
  const pending = readCatalogue(
    await (await fetch(`${server.url}/__mokly/catalogue.json`)).json(),
  );
  assert.equal(pending.comparisonUrl, null);
  assert.deepEqual(pending.removedEntries, []);
});
