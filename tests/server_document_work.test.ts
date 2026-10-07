import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import {
  runWithTimings,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";
import { readCatalogueChanges } from "../dist/server/component_changes.js";

import { changedFixture } from "./helpers/changed_fixture.js";
import { committedReviewRepository } from "./helpers/committed_repository.js";
import { componentEntrySource } from "./helpers/component_fixture.js";

test("real Serve classification counts the page and component passes once, including linked and embedded HTML parses", async (testContext) => {
  const source =
    componentEntrySource().replace(
      "defineComponent, defineScreen",
      "defineComponent, definePage, defineScreen",
    ) +
    `
mockups.push(definePage({ path: "guide", title: "Guide", description: "Guide", dependencies: [], relatedDocs: [], render: () => '<!doctype html><html><head><link rel="stylesheet" href="../shared.css"></head><body><main>Guide</main><iframe src="../embedded.html"></iframe></body></html>' }));`;
  const fixture = await changedFixture(
    testContext,
    source,
    undefined,
    async (created) => {
      await fs.writeFile(
        path.join(created.mockupsDir, "shared.css"),
        "main{color:red}",
      );
      await fs.writeFile(
        path.join(created.mockupsDir, "embedded.html"),
        "<!doctype html><html><body><main>Embedded</main></body></html>",
      );
    },
  );
  const commit = fixture.git("rev-parse", "HEAD").toString().trim();
  await fs.writeFile(
    path.join(fixture.mockupsDir, "shared.css"),
    "main{color:blue}",
  );
  const { manifest } = await compileCatalogue(fixture.config);
  const events: TimingEvent[] = [];
  await runWithTimings(
    true,
    "background",
    () =>
      readCatalogueChanges(
        fixture.config,
        manifest,
        "main",
        committedReviewRepository(fixture.config),
        commit,
      ),
    { write: (event) => events.push(event) },
  );
  const records = events.filter(({ event }) => event === "counts");
  const document = records.filter(
    ({ stage }) => stage === "review.document-work",
  );
  const comparison = records.filter(
    ({ stage }) => stage === "review.compare-screens",
  );
  assert.equal(document.length, 1);
  assert.equal(comparison.length, 1);
  assert.equal(document[0]!.session, comparison[0]!.session);
  for (const step of [
    "legacyStylesheetMatching",
    "legacyResourceMatching",
    "pageAnalysis",
    "resourceReference",
  ])
    assert.ok(document[0]!.counts![`htmlParses.${step}`]! > 0, step);
});
