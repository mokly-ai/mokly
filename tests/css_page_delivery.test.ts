import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { exportCatalogue } from "../dist/export/run.js";
import { committedReviewRepository } from "../dist/review/repository.js";
import { readCatalogueChanges } from "../dist/server/component_changes.js";
import { readCatalogue } from "../packages/viewer/dist/index.js";
import { buildPreview } from "../scripts/preview/catalogue.mjs";

import { changedFixture } from "./helpers/changed_fixture.js";
import { membershipSource } from "./helpers/css_membership_fixture.js";

test("whole-document page evidence shares component facts across live and exported catalogues", async (t) => {
  const source =
    membershipSource +
    `
import { definePage } from "@mokly/mokly";
mockups.push(definePage({id:"guide", title:"Guide", description:"Guide", relatedDocs:[], render: () => '<html><head><link rel="stylesheet" href="../rule.css"></head><body><b class="action">Guide action</b></body></html>'}));`;
  const fixture = await changedFixture(
    t,
    source,
    {
      extraConfig: 'stylesheets: [{ match: "**", stylesheets: ["rule.css"] }],',
    },
    async (item) => {
      await fs.writeFile(
        path.join(item.mockupsDir, "rule.css"),
        ".action{color:red}",
      );
    },
  );
  await fs.writeFile(
    path.join(fixture.mockupsDir, "rule.css"),
    ".action{color:blue}",
  );
  await fixture.build();
  const compiled = await compileCatalogue(fixture.config);
  const git = committedReviewRepository(fixture.config);
  const commit = await git.evidence.mergeBase("HEAD", "HEAD");
  const evidence = await readCatalogueChanges(
    fixture.config,
    compiled.manifest,
    "HEAD",
    git,
    commit,
  );
  assert.deepEqual(evidence.changedIds, ["action", "action-default", "guide"]);
  const page = evidence.pageEvidence?.find((entry) => entry.id === "guide");
  assert.ok(page?.reasons?.length);
  assert.deepEqual(page.reasons[0]!.analysis!.rules[0]!.changedComponentIds, [
    "action",
  ]);
  assert.deepEqual(page.reasons[0]!.analysis!.pageEvidence, {
    selectors: [".action"],
  });
  assert.ok(!evidence.result!.screens.some((entry) => entry.id === "guide"));
  const output = path.join(fixture.root, "site");
  await exportCatalogue(fixture.config, { outDir: output, base: "HEAD" });
  const catalogue = readCatalogue(
    JSON.parse(
      await fs.readFile(path.join(output, "__mokly/catalogue.json"), "utf8"),
    ),
  );
  assert.deepEqual(catalogue.pages[0]!.resourceEvidence, {
    reasons: page.reasons,
  });
  assert.deepEqual(catalogue.screens[0]!.views[0]!.resourceEvidence, {
    reasons: evidence.result!.screens[0]!.views[0]!.reasons,
  });
  const published = path.join(fixture.root, ".context/published");
  await buildPreview(fixture.config, published, {
    includeChanges: true,
    base: "HEAD",
  });
  const publication = readCatalogue(
    JSON.parse(
      await fs.readFile(path.join(published, "__mokly/catalogue.json"), "utf8"),
    ),
  );
  assert.deepEqual(
    publication.pages[0]!.resourceEvidence,
    catalogue.pages[0]!.resourceEvidence,
  );
  assert.deepEqual(
    publication.screens[0]!.views.map((view) => view.resourceEvidence),
    catalogue.screens[0]!.views.map((view) => view.resourceEvidence),
  );
});
