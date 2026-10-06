import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { readCatalogue } from "@mokly/viewer";

import { componentRuntime } from "../packages/mokly/dist/build/component_runtime.js";
import { exportCatalogue } from "../packages/mokly/dist/export/run.js";
import { catalogueWithChanges } from "../packages/mokly/dist/server/baseline_catalogue.js";
import { computeCatalogueChanges } from "../packages/mokly/dist/server/changed.js";
import { readCatalogueChanges } from "../packages/mokly/dist/server/component_changes.js";
import { startCatalogueServer } from "../packages/mokly/dist/server/http.js";
import { removedPagePreviewSource } from "../packages/mokly/dist/server/review_sources.js";

import { movedCatalogueFixture } from "./helpers/move_catalogue.js";

test("Serve and export retain all moves without old routes or removed document previews", async (t) => {
  const fixture = await movedCatalogueFixture(t);
  const changes = await computeCatalogueChanges(
    fixture.config,
    "main",
    fixture.git,
    fixture.after.manifest,
  );
  const evidence = changes.componentChanges!;
  const source = removedPagePreviewSource(
    catalogueWithChanges(fixture.after.manifest, evidence),
    evidence,
    "ready",
  )!;
  assert.deepEqual(source.removedEntries, []);
  assert.equal(source.movedEntries.length, 5);
  const server = await startCatalogueServer(fixture.config, {
    base: "main",
    port: 0,
    componentRuntime: componentRuntime(fixture.after),
    componentChanges: evidence,
    changedEntries: changes.changedEntries,
  });
  fixture.beforeRemove(() => server.close());
  const served = readCatalogue(
    await (await fetch(`${server.url}/__mokly/catalogue.json`)).json(),
  );
  assert.deepEqual(served.removedEntries, []);
  assert.equal(
    served.documents.filter((entry) => entry.previousPath).length,
    2,
  );
  const html = await (await fetch(`${server.url}/view/new/`)).text();
  assert.ok(!/<a\b[^>]*href="\/view\/old(?:\/|\?|")/.test(html));
  assert.equal(
    (await fetch(`${server.url}/static/old/screen/index.mobile.html`)).status,
    404,
  );
  await exportCatalogue(fixture.config, { outDir: "site", base: "HEAD" });
  const exported = readCatalogue(
    JSON.parse(
      await fs.readFile(
        path.join(fixture.root, "site/__mokly/catalogue.json"),
        "utf8",
      ),
    ),
  );
  assert.deepEqual(exported.removedEntries, []);
  for (const entries of [exported.documents, exported.pages, exported.screens])
    for (const entry of entries) {
      assert.equal(entry.previousPath, entry.path.replace(/^new/, "old"));
      assert.deepEqual(entry.changes, {
        status: "ready",
        included: true,
        kind: "unmodified",
      });
    }
  assert.ok(exported.comparisonUrl);
  const directory = path.dirname(
    path.join(fixture.root, "site", exported.comparisonUrl),
  );
  await assert.rejects(fs.stat(path.join(directory, "previews")), {
    code: "ENOENT",
  });
  assert.ok(
    (
      await fs.stat(
        path.join(directory, "snapshots/before/old/screen/index.mobile.html"),
      )
    ).isFile(),
  );
});

for (const derived of [false, true])
  for (const resourceChanged of [false, true])
    test(`moved document resources compare real bytes: derived=${derived}, edited=${resourceChanged}`, async (t) => {
      const fixture = await movedCatalogueFixture(t, {
        resource: true,
        resourceChanged,
      });
      const config = {
        ...fixture.config,
        generatedOutput: derived
          ? ("derived" as const)
          : ("committed" as const),
      };
      const evidence = await readCatalogueChanges(
        config,
        fixture.after.manifest,
        "main",
        fixture.git,
        "a".repeat(40),
        {
          outputs: fixture.after.outputs,
          routes: [...fixture.after.outputs.keys()],
          deliveredStyleSources: [],
        },
      );
      assert.equal(
        evidence.changedEntries?.includes("new/guide"),
        resourceChanged,
      );
    });

test("a moved document's equal resource does not hide another document's changed resource", async (t) => {
  const fixture = await movedCatalogueFixture(t, {
    resource: true,
    sharedResource: true,
  });
  const changes = await computeCatalogueChanges(
    fixture.config,
    "main",
    fixture.git,
    fixture.after.manifest,
  );
  assert.ok(!changes.componentChanges?.changedEntries?.includes("new/guide"));
  assert.ok(changes.componentChanges?.changedEntries?.includes("steady"));
});
