import assert from "node:assert/strict";
import test from "node:test";

import { capturePublicFiles } from "../dist/export/public_files.js";
import { assembleExport } from "../dist/export/site.js";
import { compareReview } from "../dist/review/compare.js";
import { changedContentPaths } from "../dist/server/changed_content.js";
import { readCatalogueChanges } from "../dist/server/component_changes.js";
import { startCatalogueServer } from "../dist/server/http.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { componentReviewFixture } from "./helpers/component_review_fixture.js";

const page = `import { definePage } from "@mokly/mokly";
mockups.push(definePage({ id: "handbook", title: "Handbook", description: "Document", relatedDocs: [], route: "handbook.html", render: () => "<html><body>Original handbook</body></html>" }));`;

for (const editComponent of [false, true]) {
  test(`page material Changes survive component classification and static export: component edit=${editComponent}`, async (t) => {
    const fixture = await componentReviewFixture(
      t,
      (source) => {
        const edited = source.replace("Original handbook", "Updated handbook");
        return editComponent
          ? edited.replace(
              "<button data-viewport=",
              '<button className="updated" data-viewport=',
            )
          : edited;
      },
      componentEntrySource() + page,
    );
    const changed = await readCatalogueChanges(
      fixture.config,
      fixture.after.manifest,
      "main",
      fixture.git,
      "a".repeat(40),
    );
    assert.deepEqual(
      changed.changedRoutes,
      editComponent
        ? ["components/action.html", "handbook.html"]
        : ["handbook.html"],
    );
    assert.ok(changed.result);
    assert.deepEqual(
      changed.result.changes.map((entry) => entry.kind),
      editComponent ? ["component"] : [],
    );
    const comparison = await compareReview(
      fixture.after,
      fixture.config,
      fixture.git,
      "main",
    );
    const material = await changedContentPaths(
      fixture.after.manifest,
      fixture.before.manifest,
      fixture.config,
      fixture.git.reader,
      "a".repeat(40),
      fixture.changedPaths,
      undefined,
      "pages",
    );
    const site = assembleExport(
      fixture.config,
      fixture.after,
      fixture.before.manifest,
      comparison,
      await capturePublicFiles(fixture.config),
      material,
    );
    const home = String(site.inventory.files.get("index.html"));
    assert.match(home, /data-changed="true"[^>]*data-route="handbook.html"/);
    assert.doesNotMatch(
      home,
      /data-changed="true"[^>]*data-route="screens\/home.html"/,
    );
    const document = String(site.inventory.files.get("view/handbook.html"));
    assert.match(document, /src="\/static\/handbook.html"/);
    assert.doesNotMatch(document, /data-workspace-data|data-diff-screen/);
  });
}

test("a component catalogue without review never asks for Git Changes", async (t) => {
  const fixture = await componentReviewFixture(
    t,
    (source) => source,
    componentEntrySource() + page,
  );
  let reads = 0;
  const server = await startCatalogueServer(fixture.config, {
    base: "unavailable",
    port: 0,
    componentChangeSource: {
      baseline: async () => {
        reads++;
        throw new Error("Git is unavailable");
      },
      read: async () => {
        reads++;
        throw new Error("Git is unavailable");
      },
    },
  });
  fixture.beforeRemove(() => server.close());
  for (const route of [
    "/",
    "/view/handbook.html",
    "/view/components/action.html",
  ]) {
    const response = await fetch(server.url + route);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /data-changes-status="unavailable"/);
    assert.doesNotMatch(html, /data-changed="true"/);
  }
  assert.equal(reads, 0);
});
