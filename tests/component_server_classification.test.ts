import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { compareReview } from "../dist/review/compare.js";
import { startCatalogueServer } from "../dist/server/http.js";

import { componentReviewFixture } from "./helpers/component_review_fixture.js";

test("Browse responds before separately computed component evidence arrives", async (t) => {
  const fixture = await componentReviewFixture(t, (source) =>
    source.replace(
      "<button data-viewport=",
      '<button className="changed" data-viewport=',
    ),
  );
  const { result } = await compareReview(
    fixture.after,
    fixture.config,
    fixture.git,
    "main",
  );
  assert.equal(result.schemaVersion, 5);
  if (result.schemaVersion !== 5) return;
  const server = await startCatalogueServer(fixture.config, {
    base: "main",
    port: 0,
    changesStatus: "pending",
  });
  fixture.beforeRemove(() => server.close());
  const initial = await (await fetch(server.url)).text();
  assert.match(initial, /data-mokly-filter/);
  assert.match(initial, /data-changes-status="pending"/);

  server.publishUpdate({
    changedRoutes: result.changes.map(
      (entry) => (entry.after ?? entry.before)!.route,
    ),
    componentChanges: { baseline: fixture.before.manifest, result },
    version: 2,
  });
  const classified = await waitForClassifiedShell(server.url);
  assert.match(classified, /data-mokly-update-version="2"/);
  assert.match(classified, /data-mokly-filter/);
});

test("ordinary Browse serves cached component evidence without generating or writing comparisons", async (t) => {
  const fixture = await componentReviewFixture(t, (source) =>
    source.replace(
      "<button data-viewport=",
      '<button className="changed" data-viewport=',
    ),
  );
  const { result } = await compareReview(
    fixture.after,
    fixture.config,
    fixture.git,
    "main",
  );
  assert.equal(result.schemaVersion, 5);
  if (result.schemaVersion !== 5) return;
  let comparisons = 0;
  const server = await startCatalogueServer(fixture.config, {
    base: "main",
    port: 0,
    componentChanges: { baseline: fixture.before.manifest, result },
    review: {
      base: "main",
      outDir: path.join(fixture.root, ".review"),
      generate: async () => {
        comparisons++;
        throw new Error("Ordinary Browse must not generate comparisons");
      },
    },
  });
  fixture.beforeRemove(() => server.close());
  for (const route of [
    "/",
    "/view/screens/home.html",
    "/static/screens/home.mobile.html",
    "/view/screens/home.html",
  ])
    assert.equal((await fetch(server.url + route)).status, 200);
  assert.equal(comparisons, 0);
  server.publishUpdate({
    changedRoutes: ["components/action.html"],
    componentChanges: { baseline: fixture.before.manifest, result },
    version: 2,
  });
  assert.equal(
    (await fetch(server.url + "/view/screens/home.html")).status,
    200,
  );
  assert.equal(comparisons, 0);
  await assert.rejects(fs.stat(path.join(fixture.root, ".review")), {
    code: "ENOENT",
  });
  for (const [route, html] of fixture.after.outputs)
    assert.equal(
      await fs.readFile(path.join(fixture.mockupsDir, route), "utf8"),
      html,
    );
});

async function waitForClassifiedShell(url: string): Promise<string> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const html = await (await fetch(url)).text();
    if (html.includes('data-mokly-update-version="2"')) return html;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("component classification did not publish");
}
