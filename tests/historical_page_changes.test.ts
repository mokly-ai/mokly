import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { committedReviewRepository } from "../dist/review/repository.js";
import { computeCatalogueChanges } from "../dist/server/changed.js";
import { changedContentPaths } from "../dist/server/changed_content.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";

import {
  historicalPageFixture,
  pageDocument,
} from "./helpers/historical_page_fixture.js";

for (const version of [2, 3] as const) {
  for (const change of [
    "identical",
    "ignored",
    "material",
    "resource",
    "one-sided-ignore",
  ] as const) {
    test(`v${version} preserved page applies paired document rules to ${change} edits`, async (context) => {
      const fixture = await historicalPageFixture(
        context,
        version,
        change === "one-sided-ignore"
          ? {
              document: pageDocument.replace(
                /<!--mokly-review-ignore:[^>]*-->/g,
                "",
              ),
            }
          : {},
      );
      const paths = ["mockups/handbook.html"];
      if (change === "resource") {
        await fs.writeFile(
          path.join(fixture.mockupsDir, "document.css"),
          "body { color: blue; }",
        );
        paths.push("mockups/document.css");
      } else if (
        change === "material" ||
        change === "ignored" ||
        change === "one-sided-ignore"
      ) {
        await fs.writeFile(
          fixture.currentPath,
          change === "material"
            ? fixture.currentDocument.replace(
                "Document content",
                "Changed document",
              )
            : fixture.currentDocument.replace(
                "Old navigation",
                "New navigation",
              ),
        );
      }
      assert.deepEqual(
        await changedContentPaths(
          fixture.manifest,
          fixture.baseline,
          fixture.config,
          fixture.client.reader,
          fixture.commit,
          paths,
        ),
        change === "identical" || change === "ignored"
          ? []
          : ["mockups/handbook.html"],
      );
    });
  }

  test(`v${version} page migration attributes Changes to current metadata without historical rows`, async (context) => {
    const fixture = await historicalPageFixture(context, version);
    const changes = await computeCatalogueChanges(
      fixture.config,
      "HEAD",
      committedReviewRepository(fixture.config),
    );
    assert.deepEqual(changes.changedRoutes, ["handbook.html"]);
    assert.deepEqual(changes.removedEntries, []);
    const catalogue = createCatalogue(fixture.manifest, changes.removedEntries);
    assert.equal(catalogue.byId.get("handbook")?.title, "Current handbook");
    assert.deepEqual(
      catalogue.hierarchy.ancestorsById
        .get("handbook")
        ?.map((entry) => entry.id),
      ["documents"],
    );
  });
}

for (const failure of ["symlink", "private", "invalid-ignore"] as const) {
  test(`preserved historical page rejects ${failure} artifacts`, async (context) => {
    const fixture = await historicalPageFixture(context, 3, {
      ...(failure === "symlink" ? { symlink: true } : {}),
      ...(failure === "private" ? { sourcePath: "mockups/handbook.html" } : {}),
      ...(failure === "invalid-ignore"
        ? { document: pageDocument.replace("end:nav", "end:other") }
        : {}),
    });
    await assert.rejects(
      changedContentPaths(
        fixture.manifest,
        fixture.baseline,
        fixture.config,
        fixture.client.reader,
        fixture.commit,
        ["mockups/handbook.html"],
      ),
      failure === "symlink"
        ? /not a regular Git file/
        : failure === "private"
          ? /not a public static file/
          : /does not match/,
    );
  });
}

test("a renamed legacy route is an added page without pairing or synthetic removal", async (context) => {
  const fixture = await historicalPageFixture(context, 3, {
    route: "old-handbook.html",
    document: pageDocument.replace("end:nav", "end:other"),
  });
  const changes = await computeCatalogueChanges(
    fixture.config,
    "HEAD",
    committedReviewRepository(fixture.config),
  );
  assert.deepEqual(changes.changedRoutes, ["handbook.html"]);
  assert.deepEqual(changes.removedEntries, []);
});
